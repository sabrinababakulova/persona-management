import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";

import { updateCompanySchema } from "~/schemas/company";
import {
  getCompanyMembership,
  requireCompanyAdmin,
  requireCompanyMaster,
} from "~/server/api/router-utils/company";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { toCompanyColumns } from "~/server/company/company-input";
import {
  findUsableInvitation,
  generateInvitationToken,
  INVITATION_TTL_MS,
  MAX_ACTIVE_INVITATIONS,
  markInvitationUsed,
} from "~/server/company/invitations";
import { companies, companyInvitations, users } from "~/server/db/schema";
import {
  buildDirectusAssetUrl,
  deleteDirectusFileById,
  getDirectusAssetUrl,
  isDirectusNotFoundError,
} from "~/server/storage/directus-storage";
import {
  COMPANY_ROLE_ADMIN,
  COMPANY_ROLE_MEMBER,
  COMPANY_ROLES,
  isCompanyAdmin,
} from "~/shared/company-roles";
import { DEFAULT_COMPANY_ID } from "~/shared/default-company";
import { isInvitationTokenValid } from "~/shared/invitation-token";

/**
 * Loads a colleague the master account is allowed to act on.
 *
 * Rejects anyone outside the company and the master account itself — the creator cannot be
 * demoted or locked out of their own company, not even by themselves.
 */
async function getManageableMember(
  ctx: { db: typeof import("~/server/db").db },
  companyId: string,
  userId: string,
) {
  const [member] = await ctx.db
    .select({
      id: users.id,
      isMasterAccount: users.isMasterAccount,
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.companyId, companyId)))
    .limit(1);

  if (!member) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Участник не найден в вашей компании",
    });
  }

  if (member.isMasterAccount) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Нельзя изменить владельца компании",
    });
  }

  return member;
}

export const companyRouter = createTRPCRouter({
  /** The current user's company, as shown in the "company settings" form. */
  get: protectedProcedure.query(async ({ ctx }) => {
    const { companyId, role, isAdmin, isMaster } = await getCompanyMembership(
      ctx.db,
      ctx.session.user.id,
    );

    const [company] = await ctx.db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Компания не найдена",
      });
    }

    const [members] = await ctx.db
      .select({ value: count() })
      .from(users)
      .where(eq(users.companyId, companyId));

    return {
      id: company.id,
      name: company.name,
      city: company.city ?? "",
      country: company.country ?? "",
      description: company.description ?? "",
      website: company.website ?? "",
      phone: company.phone ?? "",
      logoUrl: getDirectusAssetUrl(company.logoFileId) ?? company.logoUrl,
      memberCount: members?.value ?? 0,
      role,
      isMaster,
      /** Members see the same data, but the form is read-only for them. */
      canEdit: isAdmin,
      /** Roles and access belong to the master account alone. */
      canManageMembers: isMaster,
    };
  }),

  /**
   * Creates a company for an account that does not have one yet.
   *
   * The registration form normally does this, but a Google sign-up skips it — those accounts
   * finish the step at `/onboarding/company`. Like registration, the creator becomes the
   * company's admin and its master account.
   */
  createForCurrentUser: protectedProcedure
    .input(updateCompanySchema)
    .mutation(async ({ ctx, input }) => {
      const [currentUser] = await ctx.db
        .select({ companyId: users.companyId })
        .from(users)
        .where(eq(users.id, ctx.session.user.id))
        .limit(1);

      if (!currentUser) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Пользователь не найден",
        });
      }

      if (currentUser.companyId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Вы уже состоите в компании",
        });
      }

      const [company] = await ctx.db
        .insert(companies)
        .values(toCompanyColumns(input))
        .returning({ id: companies.id });

      if (!company) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Не удалось создать компанию",
        });
      }

      await ctx.db
        .update(users)
        .set({
          companyId: company.id,
          role: COMPANY_ROLE_ADMIN,
          isMasterAccount: true,
        })
        .where(eq(users.id, ctx.session.user.id));

      return { success: true, companyId: company.id };
    }),

  update: protectedProcedure
    .input(updateCompanySchema)
    .mutation(async ({ ctx, input }) => {
      const { companyId } = await requireCompanyAdmin(
        ctx.db,
        ctx.session.user.id,
      );

      await ctx.db
        .update(companies)
        .set(toCompanyColumns(input))
        .where(eq(companies.id, companyId));

      return { success: true };
    }),

  /** Persists an already-uploaded logo (see `storage.uploadImage`) on the company. */
  updateLogo: protectedProcedure
    .input(z.object({ logoFileId: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const { companyId } = await requireCompanyAdmin(
        ctx.db,
        ctx.session.user.id,
      );

      const [company] = await ctx.db
        .select({ logoFileId: companies.logoFileId })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

      const previousLogoFileId = company?.logoFileId ?? null;

      try {
        await ctx.db
          .update(companies)
          .set({
            logoFileId: input.logoFileId,
            logoUrl: buildDirectusAssetUrl(input.logoFileId),
          })
          .where(eq(companies.id, companyId));
      } catch (error) {
        try {
          await deleteDirectusFileById(input.logoFileId);
        } catch (cleanupError) {
          if (!isDirectusNotFoundError(cleanupError)) {
            console.error(
              "Failed to clean up uploaded logo after database update error",
              cleanupError,
            );
          }
        }

        throw error;
      }

      if (previousLogoFileId && previousLogoFileId !== input.logoFileId) {
        try {
          await deleteDirectusFileById(previousLogoFileId);
        } catch (error) {
          if (!isDirectusNotFoundError(error)) {
            console.error("Failed to delete previous logo from Directus", {
              error,
              previousLogoFileId,
              companyId,
            });
          }
        }
      }

      return {
        success: true,
        logoUrl: buildDirectusAssetUrl(input.logoFileId),
      };
    }),

  /** Everyone who currently belongs to the company — shown next to the invite link. */
  listMembers: protectedProcedure.query(async ({ ctx }) => {
    const { companyId } = await getCompanyMembership(
      ctx.db,
      ctx.session.user.id,
    );

    const members = await ctx.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarFileId: users.avatarFileId,
        image: users.image,
        role: users.role,
        isMasterAccount: users.isMasterAccount,
        deactivatedAt: users.deactivatedAt,
      })
      .from(users)
      .where(eq(users.companyId, companyId))
      .orderBy(users.email)
      .limit(200);

    return members.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      avatarUrl: getDirectusAssetUrl(member.avatarFileId) ?? member.image,
      role: member.isMasterAccount ? COMPANY_ROLE_ADMIN : member.role,
      isMaster: member.isMasterAccount,
      isAdmin: member.isMasterAccount || isCompanyAdmin(member.role),
      isActive: member.deactivatedAt === null,
      isCurrentUser: member.id === ctx.session.user.id,
    }));
  }),

  /** Promotes a member to admin or demotes them back. Master account only. */
  updateMemberRole: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1).max(255),
        role: z.enum(COMPANY_ROLES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { companyId } = await requireCompanyMaster(
        ctx.db,
        ctx.session.user.id,
      );
      const member = await getManageableMember(ctx, companyId, input.userId);

      await ctx.db
        .update(users)
        .set({ role: input.role })
        .where(eq(users.id, member.id));

      return { success: true, role: input.role };
    }),

  /**
   * Removes someone from the company, or lets them back in.
   *
   * Deactivation keeps the row — the person's name, email and history stay visible — but the
   * account can no longer sign in anywhere in the app, so it cannot join another company
   * either. Master account only.
   */
  setMemberActive: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1).max(255),
        isActive: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { companyId } = await requireCompanyMaster(
        ctx.db,
        ctx.session.user.id,
      );
      const member = await getManageableMember(ctx, companyId, input.userId);

      await ctx.db
        .update(users)
        .set({ deactivatedAt: input.isActive ? null : new Date() })
        .where(eq(users.id, member.id));

      return { success: true, isActive: input.isActive };
    }),

  listInvitations: protectedProcedure.query(async ({ ctx }) => {
    const { companyId } = await requireCompanyAdmin(
      ctx.db,
      ctx.session.user.id,
    );

    return ctx.db
      .select({
        id: companyInvitations.id,
        token: companyInvitations.token,
        expiresAt: companyInvitations.expiresAt,
        usesCount: companyInvitations.usesCount,
        createdAt: companyInvitations.createdAt,
      })
      .from(companyInvitations)
      .where(
        and(
          eq(companyInvitations.companyId, companyId),
          isNull(companyInvitations.revokedAt),
          gt(companyInvitations.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(companyInvitations.createdAt));
  }),

  createInvitation: protectedProcedure.mutation(async ({ ctx }) => {
    const { companyId } = await requireCompanyAdmin(
      ctx.db,
      ctx.session.user.id,
    );

    const [active] = await ctx.db
      .select({ value: count() })
      .from(companyInvitations)
      .where(
        and(
          eq(companyInvitations.companyId, companyId),
          isNull(companyInvitations.revokedAt),
          gt(companyInvitations.expiresAt, new Date()),
        ),
      );

    if ((active?.value ?? 0) >= MAX_ACTIVE_INVITATIONS) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message:
          "Слишком много активных ссылок. Отзовите одну из них, чтобы создать новую.",
      });
    }

    const [invitation] = await ctx.db
      .insert(companyInvitations)
      .values({
        companyId,
        token: generateInvitationToken(),
        createdById: ctx.session.user.id,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      })
      .returning({
        id: companyInvitations.id,
        token: companyInvitations.token,
        expiresAt: companyInvitations.expiresAt,
        usesCount: companyInvitations.usesCount,
        createdAt: companyInvitations.createdAt,
      });

    if (!invitation) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Не удалось создать ссылку-приглашение",
      });
    }

    return invitation;
  }),

  revokeInvitation: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const { companyId } = await requireCompanyAdmin(
        ctx.db,
        ctx.session.user.id,
      );

      await ctx.db
        .update(companyInvitations)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(companyInvitations.id, input.id),
            eq(companyInvitations.companyId, companyId),
          ),
        );

      return { success: true };
    }),

  /** Public preview used by the invite landing page and the register form. */
  getInvitation: publicProcedure
    .input(z.object({ token: z.string().min(1).max(64) }))
    .query(async ({ input }) => {
      if (!isInvitationTokenValid(input.token)) {
        return null;
      }

      const invitation = await findUsableInvitation(input.token);
      return invitation ? { companyName: invitation.companyName } : null;
    }),

  /**
   * Moves the signed-in user into the inviting company.
   *
   * Only users who never left the shared default company can join this way — someone already
   * working inside another company would leave their data behind, so they need a new account.
   */
  acceptInvitation: protectedProcedure
    .input(z.object({ token: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await findUsableInvitation(input.token);

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ссылка-приглашение недействительна или истекла",
        });
      }

      const [currentUser] = await ctx.db
        .select({ companyId: users.companyId })
        .from(users)
        .where(eq(users.id, ctx.session.user.id))
        .limit(1);

      if (!currentUser) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Пользователь не найден",
        });
      }

      if (currentUser.companyId === invitation.companyId) {
        return { alreadyMember: true, companyName: invitation.companyName };
      }

      if (
        currentUser.companyId &&
        currentUser.companyId !== DEFAULT_COMPANY_ID
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Вы уже состоите в другой компании. Используйте другой аккаунт, чтобы принять приглашение.",
        });
      }

      await ctx.db
        .update(users)
        .set({
          companyId: invitation.companyId,
          role: COMPANY_ROLE_MEMBER,
          // Joining a company never makes you its creator.
          isMasterAccount: false,
        })
        .where(eq(users.id, ctx.session.user.id));

      await markInvitationUsed(invitation.id);

      return { alreadyMember: false, companyName: invitation.companyName };
    }),
});
