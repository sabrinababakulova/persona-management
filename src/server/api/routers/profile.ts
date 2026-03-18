import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { changePasswordSchema } from "~/schemas/change-password";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { createRateLimitIdentifier } from "~/server/auth/email-verification";
import {
  clearIdentifier,
  isRateLimited,
  recordAttempt,
} from "~/server/auth/rate-limit";
import { users } from "~/server/db/schema";

const CHANGE_PASSWORD_RATE_LIMIT_MAX_ATTEMPTS = 5;
const CHANGE_PASSWORD_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export const profileRouter = createTRPCRouter({
  updateAvatar: protectedProcedure
    .input(
      z.object({
        imageUrl: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(users)
        .set({ image: input.imageUrl })
        .where(eq(users.id, ctx.session.user.id));

      return { success: true, imageUrl: input.imageUrl };
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
