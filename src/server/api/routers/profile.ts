import { TRPCError } from "@trpc/server";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { changePasswordSchema } from "~/schemas/change-password";
import {
  forgotPasswordRequestSchema,
  forgotPasswordResetSchema,
} from "~/schemas/forgot-password";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  createPasswordResetFlowIdentifier,
  createPasswordResetIdentifier,
  createRateLimitIdentifier,
  generateEmailVerificationCode,
  generateEmailVerificationFlowId,
  hashPasswordResetCode,
  normalizeEmail,
  PASSWORD_RESET_CODE_TTL_MS,
  PASSWORD_RESET_FLOW_TTL_MS,
  PASSWORD_RESET_REQUEST_IP_MAX_ATTEMPTS,
  PASSWORD_RESET_REQUEST_MAX_ATTEMPTS,
  PASSWORD_RESET_REQUEST_WINDOW_MS,
  PASSWORD_RESET_RESEND_COOLDOWN_MS,
  PASSWORD_RESET_VERIFY_IP_MAX_ATTEMPTS,
  PASSWORD_RESET_VERIFY_MAX_ATTEMPTS,
  PASSWORD_RESET_VERIFY_WINDOW_MS,
} from "~/server/auth/email-verification";
import { hashPassword, verifyPassword } from "~/server/auth/password";
import {
  clearIdentifier,
  hasActiveRecord,
  setMarker,
  takeRateLimitSlot,
} from "~/server/auth/rate-limit";
import { users, verificationTokens } from "~/server/db/schema";
import { sendPasswordResetCode } from "~/server/mail/send-password-reset-code";
import {
  buildDirectusAssetUrl,
  deleteDirectusFileById,
  getDirectusAssetUrl,
  isDirectusNotFoundError,
} from "~/server/storage/directus-storage";
import { verifyUploadToken } from "~/server/storage/upload-token";
import { getClientIp } from "~/server/utils/client-ip";

const CHANGE_PASSWORD_RATE_LIMIT_MAX_ATTEMPTS = 5;
const CHANGE_PASSWORD_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Charges one slot and reports whether the window is now full.
 *
 * `takeRateLimitSlot` counts and inserts under an advisory lock, so parallel requests each
 * consume a slot instead of all observing the same pre-write count. The per-identity windows
 * are released on success, so only failures accumulate there.
 */
async function isRateLimitExceeded(
  identifier: string,
  maxAttempts: number,
  windowMs: number,
) {
  return !(await takeRateLimitSlot(identifier, maxAttempts, windowMs));
}

export const profileRouter = createTRPCRouter({
  requestPasswordReset: publicProcedure
    .input(forgotPasswordRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const email = normalizeEmail(input.email);
      const clientIp = getClientIp(ctx.headers);
      const requestIdentifier = createRateLimitIdentifier(
        "password-reset-request",
        email,
      );
      const requestByIpIdentifier = createRateLimitIdentifier(
        "password-reset-request-ip",
        clientIp,
      );
      const cooldownIdentifier = createRateLimitIdentifier(
        "password-reset-cooldown",
        email,
      );

      // Both windows are charged atomically before anything is looked up, so a burst of
      // parallel requests cannot all read the same pre-write count.
      const overRequestLimit =
        (await isRateLimitExceeded(
          requestIdentifier,
          PASSWORD_RESET_REQUEST_MAX_ATTEMPTS,
          PASSWORD_RESET_REQUEST_WINDOW_MS,
        )) ||
        (await isRateLimitExceeded(
          requestByIpIdentifier,
          PASSWORD_RESET_REQUEST_IP_MAX_ATTEMPTS,
          PASSWORD_RESET_REQUEST_WINDOW_MS,
        ));

      if (overRequestLimit) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Слишком много запросов. Попробуйте позже.",
          cause: {
            retryAfter: Math.ceil(PASSWORD_RESET_REQUEST_WINDOW_MS / 1000),
          },
        });
      }

      if (await hasActiveRecord(cooldownIdentifier)) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message:
            "Код уже был отправлен. Подождите минуту и попробуйте снова.",
          cause: {
            retryAfter: Math.ceil(PASSWORD_RESET_RESEND_COOLDOWN_MS / 1000),
          },
        });
      }

      const [user] = await ctx.db
        .select({
          id: users.id,
          emailVerified: users.emailVerified,
          deactivatedAt: users.deactivatedAt,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      // An unknown address, an unverified one, and an account the master removed from its
      // company all take the same path as a real request: a flow id is minted and returned,
      // no mail is sent, and any code entered against it fails like an expired one.
      //
      // Registration goes to real lengths to avoid leaking which addresses exist — hashing a
      // dummy password purely to equalise timing. Answering "Пользователь с такой почтой не
      // найден" here handed that back for free.
      const isEligible = Boolean(user?.emailVerified && !user.deactivatedAt);
      const flowId = generateEmailVerificationFlowId();
      await setMarker(cooldownIdentifier, PASSWORD_RESET_RESEND_COOLDOWN_MS);

      if (!user || !isEligible) {
        return { email, flowId };
      }

      const verificationCode = generateEmailVerificationCode();
      const resetIdentifier = createPasswordResetIdentifier(user.id);
      const resetFlowIdentifier = createPasswordResetFlowIdentifier(flowId);

      try {
        await ctx.db
          .delete(verificationTokens)
          .where(eq(verificationTokens.identifier, resetIdentifier));

        await ctx.db.insert(verificationTokens).values({
          identifier: resetIdentifier,
          token: hashPasswordResetCode(verificationCode, user.id),
          expires: new Date(Date.now() + PASSWORD_RESET_CODE_TTL_MS),
        });

        await ctx.db.insert(verificationTokens).values({
          identifier: resetFlowIdentifier,
          token: user.id,
          expires: new Date(Date.now() + PASSWORD_RESET_FLOW_TTL_MS),
        });

        await sendPasswordResetCode(email, verificationCode);
      } catch (error) {
        await Promise.all([
          clearIdentifier(resetIdentifier).catch(() => undefined),
          clearIdentifier(resetFlowIdentifier).catch(() => undefined),
        ]);

        console.error("Failed to request password reset", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Не удалось отправить код. Попробуйте позже.",
        });
      }

      return {
        email,
        flowId,
      };
    }),

  resetPassword: publicProcedure
    .input(forgotPasswordResetSchema)
    .mutation(async ({ ctx, input }) => {
      const clientIp = getClientIp(ctx.headers);
      const verifyIdentifier = createRateLimitIdentifier(
        "password-reset-verify",
        input.flowId,
      );
      const verifyByIpIdentifier = createRateLimitIdentifier(
        "password-reset-verify-ip",
        clientIp,
      );

      const overVerifyLimit =
        (await isRateLimitExceeded(
          verifyIdentifier,
          PASSWORD_RESET_VERIFY_MAX_ATTEMPTS,
          PASSWORD_RESET_VERIFY_WINDOW_MS,
        )) ||
        (await isRateLimitExceeded(
          verifyByIpIdentifier,
          PASSWORD_RESET_VERIFY_IP_MAX_ATTEMPTS,
          PASSWORD_RESET_VERIFY_WINDOW_MS,
        ));

      if (overVerifyLimit) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Слишком много попыток. Попробуйте позже.",
          cause: {
            retryAfter: Math.ceil(PASSWORD_RESET_VERIFY_WINDOW_MS / 1000),
          },
        });
      }

      /**
       * One message for every way this can fail.
       *
       * A flow id minted for an address with no eligible account is indistinguishable from an
       * expired one, and both have to read the same as a wrong code — otherwise the reset
       * screen answers the existence question the request step refuses to.
       */
      const invalidCodeError = new TRPCError({
        code: "BAD_REQUEST",
        message: "Неверный или истекший код. Запросите новый код.",
      });

      const resetFlowIdentifier = createPasswordResetFlowIdentifier(
        input.flowId,
      );
      const [flowRecord] = await ctx.db
        .select({ userId: verificationTokens.token })
        .from(verificationTokens)
        .where(
          and(
            eq(verificationTokens.identifier, resetFlowIdentifier),
            gt(verificationTokens.expires, new Date()),
          ),
        )
        .limit(1);

      const userId = flowRecord?.userId;
      if (!userId) {
        throw invalidCodeError;
      }

      const [user] = await ctx.db
        .select({
          id: users.id,
          password: users.password,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        throw invalidCodeError;
      }

      const resetIdentifier = createPasswordResetIdentifier(user.id);
      const [verificationCodeRecord] = await ctx.db
        .select({ token: verificationTokens.token })
        .from(verificationTokens)
        .where(
          and(
            eq(verificationTokens.identifier, resetIdentifier),
            eq(
              verificationTokens.token,
              hashPasswordResetCode(input.code, user.id),
            ),
            gt(verificationTokens.expires, new Date()),
          ),
        )
        .limit(1);

      // The attempt was charged against both windows at the top of the procedure.
      if (!verificationCodeRecord) {
        throw invalidCodeError;
      }

      if (user.password) {
        const isSamePassword = await verifyPassword(
          user.password,
          input.newPassword,
        );

        if (isSamePassword) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Новый пароль должен отличаться от текущего.",
          });
        }
      }

      const hashedPassword = await hashPassword(input.newPassword);

      await ctx.db
        .update(users)
        .set({
          password: hashedPassword,
          passwordChangedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      await Promise.all([
        clearIdentifier(resetIdentifier),
        clearIdentifier(resetFlowIdentifier),
        clearIdentifier(verifyIdentifier),
      ]);

      return {
        success: true,
        message: "Пароль успешно обновлен. Теперь вы можете войти.",
      };
    }),

  getAvatar: protectedProcedure.query(async ({ ctx }) => {
    const [currentUser] = await ctx.db
      .select({
        avatarFileId: users.avatarFileId,
        image: users.image,
      })
      .from(users)
      .where(eq(users.id, ctx.session.user.id))
      .limit(1);

    return {
      avatarUrl:
        getDirectusAssetUrl(currentUser?.avatarFileId) ??
        currentUser?.image ??
        null,
    };
  }),

  updateAvatar: protectedProcedure
    .input(
      z.object({
        avatarFileId: z.string().min(1).max(255),
        /** Signed handle from `storage.uploadImage`, proving this user uploaded the file. */
        uploadToken: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        !verifyUploadToken(
          ctx.session.user.id,
          input.avatarFileId,
          input.uploadToken,
        )
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Некорректная ссылка на загруженный файл",
        });
      }

      const [currentUser] = await ctx.db
        .select({
          avatarFileId: users.avatarFileId,
        })
        .from(users)
        .where(eq(users.id, ctx.session.user.id))
        .limit(1);

      const previousAvatarFileId = currentUser?.avatarFileId ?? null;

      try {
        await ctx.db
          .update(users)
          .set({ avatarFileId: input.avatarFileId })
          .where(eq(users.id, ctx.session.user.id));
      } catch (error) {
        try {
          await deleteDirectusFileById(input.avatarFileId);
        } catch (cleanupError) {
          if (!isDirectusNotFoundError(cleanupError)) {
            console.error(
              "Failed to clean up uploaded avatar after database update error",
              cleanupError,
            );
          }
        }

        throw error;
      }

      if (previousAvatarFileId && previousAvatarFileId !== input.avatarFileId) {
        try {
          await deleteDirectusFileById(previousAvatarFileId);
        } catch (error) {
          if (!isDirectusNotFoundError(error)) {
            console.error("Failed to delete previous avatar from Directus", {
              error,
              previousAvatarFileId,
              userId: ctx.session.user.id,
            });
          }
        }
      }

      return {
        success: true,
        avatarFileId: input.avatarFileId,
        imageUrl: buildDirectusAssetUrl(input.avatarFileId),
      };
    }),

  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ ctx, input }) => {
      const rateLimitIdentifier = createRateLimitIdentifier(
        "change-password",
        ctx.session.user.id,
      );

      if (
        await isRateLimitExceeded(
          rateLimitIdentifier,
          CHANGE_PASSWORD_RATE_LIMIT_MAX_ATTEMPTS,
          CHANGE_PASSWORD_RATE_LIMIT_WINDOW_MS,
        )
      ) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Слишком много попыток смены пароля. Попробуйте позже.",
          cause: {
            retryAfter: Math.ceil(CHANGE_PASSWORD_RATE_LIMIT_WINDOW_MS / 1000),
          },
        });
      }

      const [currentUser] = await ctx.db
        .select({
          id: users.id,
          password: users.password,
        })
        .from(users)
        .where(eq(users.id, ctx.session.user.id))
        .limit(1);

      if (!currentUser) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Пользователь не авторизован",
        });
      }

      if (!currentUser.password) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Для данного аккаунта пароль не установлен",
        });
      }

      const isCurrentPasswordValid = await verifyPassword(
        currentUser.password,
        input.currentPassword,
      );

      if (!isCurrentPasswordValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Старый пароль введен неверно",
        });
      }

      const hashedPassword = await hashPassword(input.newPassword);

      await ctx.db
        .update(users)
        .set({
          password: hashedPassword,
          passwordChangedAt: new Date(),
        })
        .where(eq(users.id, currentUser.id));

      await clearIdentifier(rateLimitIdentifier);

      return {
        success: true,
        message: "Пароль успешно изменен",
      };
    }),
});
