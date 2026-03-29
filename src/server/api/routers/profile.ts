import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
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
  PASSWORD_RESET_REQUEST_MAX_ATTEMPTS,
  PASSWORD_RESET_REQUEST_WINDOW_MS,
  PASSWORD_RESET_RESEND_COOLDOWN_MS,
  PASSWORD_RESET_VERIFY_MAX_ATTEMPTS,
  PASSWORD_RESET_VERIFY_WINDOW_MS,
} from "~/server/auth/email-verification";
import {
  clearIdentifier,
  hasActiveRecord,
  isRateLimited,
  recordAttempt,
  setMarker,
} from "~/server/auth/rate-limit";
import { users, verificationTokens } from "~/server/db/schema";
import { sendPasswordResetCode } from "~/server/mail/send-password-reset-code";
import { buildDirectusAssetUrl } from "~/server/storage/directus-storage";

const CHANGE_PASSWORD_RATE_LIMIT_MAX_ATTEMPTS = 5;
const CHANGE_PASSWORD_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function getClientIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
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

      if (
        await isRateLimited(
          requestIdentifier,
          PASSWORD_RESET_REQUEST_MAX_ATTEMPTS,
        )
      ) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Слишком много запросов. Попробуйте позже.",
          cause: {
            retryAfter: Math.ceil(PASSWORD_RESET_REQUEST_WINDOW_MS / 1000),
          },
        });
      }

      if (
        await isRateLimited(
          requestByIpIdentifier,
          PASSWORD_RESET_REQUEST_MAX_ATTEMPTS,
        )
      ) {
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
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        await recordAttempt(
          requestIdentifier,
          PASSWORD_RESET_REQUEST_WINDOW_MS,
        );
        await recordAttempt(
          requestByIpIdentifier,
          PASSWORD_RESET_REQUEST_WINDOW_MS,
        );

        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Пользователь с такой почтой не найден.",
        });
      }

      if (!user.emailVerified) {
        await recordAttempt(
          requestIdentifier,
          PASSWORD_RESET_REQUEST_WINDOW_MS,
        );
        await recordAttempt(
          requestByIpIdentifier,
          PASSWORD_RESET_REQUEST_WINDOW_MS,
        );

        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Сначала подтвердите почту для этого аккаунта.",
        });
      }

      const verificationCode = generateEmailVerificationCode();
      const flowId = generateEmailVerificationFlowId();
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

      await recordAttempt(requestIdentifier, PASSWORD_RESET_REQUEST_WINDOW_MS);
      await recordAttempt(
        requestByIpIdentifier,
        PASSWORD_RESET_REQUEST_WINDOW_MS,
      );
      await setMarker(cooldownIdentifier, PASSWORD_RESET_RESEND_COOLDOWN_MS);

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

      if (
        await isRateLimited(
          verifyIdentifier,
          PASSWORD_RESET_VERIFY_MAX_ATTEMPTS,
        )
      ) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Слишком много попыток. Попробуйте позже.",
          cause: {
            retryAfter: Math.ceil(PASSWORD_RESET_VERIFY_WINDOW_MS / 1000),
          },
        });
      }

      if (
        await isRateLimited(
          verifyByIpIdentifier,
          PASSWORD_RESET_VERIFY_MAX_ATTEMPTS,
        )
      ) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Слишком много попыток. Попробуйте позже.",
          cause: {
            retryAfter: Math.ceil(PASSWORD_RESET_VERIFY_WINDOW_MS / 1000),
          },
        });
      }

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
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Код истек. Запросите новый код.",
        });
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
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Пользователь не найден.",
        });
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

      if (!verificationCodeRecord) {
        await recordAttempt(verifyIdentifier, PASSWORD_RESET_VERIFY_WINDOW_MS);
        await recordAttempt(
          verifyByIpIdentifier,
          PASSWORD_RESET_VERIFY_WINDOW_MS,
        );

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Неверный или истекший код.",
        });
      }

      if (user.password) {
        const isSamePassword = await bcrypt.compare(
          input.newPassword,
          user.password,
        );

        if (isSamePassword) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Новый пароль должен отличаться от текущего.",
          });
        }
      }

      const hashedPassword = await bcrypt.hash(input.newPassword, 12);

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
        clearIdentifier(verifyByIpIdentifier),
      ]);

      return {
        success: true,
        message: "Пароль успешно обновлен. Теперь вы можете войти.",
      };
    }),

  updateAvatar: protectedProcedure
    .input(
      z.object({
        avatarFileId: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(users)
        .set({ avatarFileId: input.avatarFileId })
        .where(eq(users.id, ctx.session.user.id));

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
        await isRateLimited(
          rateLimitIdentifier,
          CHANGE_PASSWORD_RATE_LIMIT_MAX_ATTEMPTS,
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

      const isCurrentPasswordValid = await bcrypt.compare(
        input.currentPassword,
        currentUser.password,
      );

      if (!isCurrentPasswordValid) {
        await recordAttempt(
          rateLimitIdentifier,
          CHANGE_PASSWORD_RATE_LIMIT_WINDOW_MS,
        );

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Старый пароль введен неверно",
        });
      }

      const hashedPassword = await bcrypt.hash(input.newPassword, 12);

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
