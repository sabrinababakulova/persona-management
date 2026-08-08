import { TRPCError } from "@trpc/server";
import { and, asc, eq, ilike } from "drizzle-orm";
import { z } from "zod";

import { env } from "~/env";
import { writeRecentActivityLog } from "~/server/activity/recent-activity";
import { getRequiredCompanyId } from "~/server/api/router-utils/company";
import { escapeLike } from "~/server/api/router-utils/sql";
import { protectedProcedure } from "~/server/api/trpc";
import { candidateMeetings, candidates } from "~/server/db/schema";
import { sendCandidateMeetingInvitation } from "~/server/mail/send-candidate-meeting-invitation";

import {
  candidateIdInputSchema,
  candidateMeetingInputSchema,
  meetingCandidateSearchInputSchema,
} from "./schemas";

const emailSchema = z.string().trim().email();

function getCandidateEmail(contacts: { type: string; value: string }[] | null) {
  for (const contact of contacts ?? []) {
    if (contact.type.trim().toLowerCase() !== "email") {
      continue;
    }

    const parsed = emailSchema.safeParse(contact.value);
    if (parsed.success) {
      return parsed.data.toLowerCase();
    }
  }

  return null;
}

export const listCandidateMeetingsProcedure = protectedProcedure
  .input(candidateIdInputSchema)
  .query(async ({ ctx, input }) => {
    const companyId = await getRequiredCompanyId(ctx.db, ctx.session.user.id);

    return ctx.db
      .select({
        id: candidateMeetings.id,
        title: candidateMeetings.title,
        description: candidateMeetings.description,
        location: candidateMeetings.location,
        startAt: candidateMeetings.startAt,
        endAt: candidateMeetings.endAt,
        timeZone: candidateMeetings.timeZone,
        invitationStatus: candidateMeetings.invitationStatus,
        invitationSentAt: candidateMeetings.invitationSentAt,
        organizerName: candidateMeetings.organizerName,
      })
      .from(candidateMeetings)
      .where(
        and(
          eq(candidateMeetings.candidateId, input.id),
          eq(candidateMeetings.companyId, companyId),
        ),
      )
      .orderBy(asc(candidateMeetings.startAt));
  });

/** All candidate meetings organized by the signed-in recruiter. */
export const listMyMeetingsProcedure = protectedProcedure.query(
  async ({ ctx }) => {
    const companyId = await getRequiredCompanyId(ctx.db, ctx.session.user.id);

    return ctx.db
      .select({
        id: candidateMeetings.id,
        candidateId: candidateMeetings.candidateId,
        candidateName: candidates.fullName,
        candidateEmail: candidateMeetings.candidateEmail,
        title: candidateMeetings.title,
        description: candidateMeetings.description,
        location: candidateMeetings.location,
        startAt: candidateMeetings.startAt,
        endAt: candidateMeetings.endAt,
        timeZone: candidateMeetings.timeZone,
        invitationStatus: candidateMeetings.invitationStatus,
        invitationSentAt: candidateMeetings.invitationSentAt,
      })
      .from(candidateMeetings)
      .innerJoin(candidates, eq(candidateMeetings.candidateId, candidates.id))
      .where(
        and(
          eq(candidateMeetings.companyId, companyId),
          eq(candidateMeetings.organizerUserId, ctx.session.user.id),
        ),
      )
      .orderBy(asc(candidateMeetings.startAt));
  },
);

/** Searchable, email-ready candidates shown in the global meeting modal. */
export const searchMeetingCandidatesProcedure = protectedProcedure
  .input(meetingCandidateSearchInputSchema)
  .query(async ({ ctx, input }) => {
    const companyId = await getRequiredCompanyId(ctx.db, ctx.session.user.id);
    const query = input?.query?.trim() ?? "";
    const conditions = [eq(candidates.companyId, companyId)];

    if (query) {
      conditions.push(ilike(candidates.fullName, `%${escapeLike(query)}%`));
    }

    const rows = await ctx.db
      .select({
        id: candidates.id,
        fullName: candidates.fullName,
        currentPosition: candidates.currentPosition,
        city: candidates.city,
        contacts: candidates.contacts,
      })
      .from(candidates)
      .where(and(...conditions))
      .orderBy(asc(candidates.fullName))
      .limit(60);

    return rows.flatMap((candidate) => {
      const email = getCandidateEmail(candidate.contacts);
      return email
        ? [
            {
              id: candidate.id,
              fullName: candidate.fullName,
              email,
              currentPosition: candidate.currentPosition,
              city: candidate.city,
            },
          ]
        : [];
    });
  });

export const createCandidateMeetingProcedure = protectedProcedure
  .input(candidateMeetingInputSchema)
  .mutation(async ({ ctx, input }) => {
    const companyId = await getRequiredCompanyId(ctx.db, ctx.session.user.id);
    const [candidate] = await ctx.db
      .select({
        id: candidates.id,
        fullName: candidates.fullName,
        contacts: candidates.contacts,
      })
      .from(candidates)
      .where(
        and(
          eq(candidates.id, input.candidateId),
          eq(candidates.companyId, companyId),
        ),
      )
      .limit(1);

    if (!candidate) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Кандидат не найден",
      });
    }

    const candidateEmail = getCandidateEmail(candidate.contacts);
    if (!candidateEmail) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "У кандидата не указан корректный email",
      });
    }

    const organizerName =
      ctx.session.user.name?.trim() ||
      ctx.session.user.email?.trim() ||
      "Рекрутер";
    const parsedOrganizerEmail = emailSchema.safeParse(
      ctx.session.user.email?.trim(),
    );
    const organizerEmail = parsedOrganizerEmail.success
      ? parsedOrganizerEmail.data.toLowerCase()
      : env.MAIL_LOGIN;
    const invitationUid = `${crypto.randomUUID()}@talanty.uz`;
    const meetingId = crypto.randomUUID();
    const createdAt = new Date();

    await ctx.db.insert(candidateMeetings).values({
      id: meetingId,
      candidateId: candidate.id,
      companyId,
      organizerUserId: ctx.session.user.id,
      organizerName,
      organizerEmail,
      candidateEmail,
      title: input.title,
      description: input.description || null,
      location: input.location || null,
      startAt: input.startAt,
      endAt: input.endAt,
      timeZone: input.timeZone,
      invitationUid,
      invitationStatus: "pending",
      createdAt,
    });

    try {
      await sendCandidateMeetingInvitation({
        candidateName: candidate.fullName,
        candidateEmail,
        organizerName,
        organizerEmail,
        organizerReplyToEmail: organizerEmail,
        title: input.title,
        description: input.description,
        location: input.location,
        startAt: input.startAt,
        endAt: input.endAt,
        timeZone: input.timeZone,
        invitationUid,
        createdAt,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message.slice(0, 2000) : String(error);
      await ctx.db
        .update(candidateMeetings)
        .set({
          invitationStatus: "failed",
          invitationError: errorMessage,
        })
        .where(eq(candidateMeetings.id, meetingId));

      console.error("Failed to send candidate meeting invitation", {
        candidateId: candidate.id,
        meetingId,
        error,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Встреча сохранена, но приглашение не отправлено. Проверьте настройки почты.",
      });
    }

    const invitationSentAt = new Date();
    const [meeting] = await ctx.db
      .update(candidateMeetings)
      .set({
        invitationStatus: "sent",
        invitationSentAt,
        invitationError: null,
      })
      .where(eq(candidateMeetings.id, meetingId))
      .returning({
        id: candidateMeetings.id,
        title: candidateMeetings.title,
        description: candidateMeetings.description,
        location: candidateMeetings.location,
        startAt: candidateMeetings.startAt,
        endAt: candidateMeetings.endAt,
        timeZone: candidateMeetings.timeZone,
        invitationStatus: candidateMeetings.invitationStatus,
        invitationSentAt: candidateMeetings.invitationSentAt,
        organizerName: candidateMeetings.organizerName,
      });

    await writeRecentActivityLog(ctx.db, {
      entityType: "candidate",
      entityId: candidate.id,
      companyId,
      actorUserId: ctx.session.user.id,
      actorName: organizerName,
      action: "запланировал(а) встречу с",
      targetName: candidate.fullName,
      targetStatus: input.title,
    });

    if (!meeting) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Приглашение отправлено, но встречу не удалось обновить",
      });
    }

    return meeting;
  });
