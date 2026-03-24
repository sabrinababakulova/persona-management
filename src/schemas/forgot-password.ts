import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Пароль должен быть не менее 8 символов")
  .max(255, "Слишком длинный пароль")
  .regex(/[^A-Za-z0-9]/, "Пароль должен содержать специальные символы")
  .regex(/[A-ZА-ЯЁ]/, "Пароль должен содержать символы верхнего регистра");

export const forgotPasswordRequestSchema = z.object({
  email: z.string().trim().email("Неверный формат почты").toLowerCase(),
});

export const forgotPasswordResetSchema = z
  .object({
    flowId: z.string().uuid("Некорректный идентификатор сброса"),
    code: z.string().regex(/^\d{6}$/, "Введите 6-значный код"),
    newPassword: passwordSchema,
    confirmPassword: z
      .string()
      .min(1, "Повторите новый пароль")
      .max(255, "Слишком длинный пароль"),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Новый пароль и подтверждение не совпадают",
        path: ["confirmPassword"],
      });
    }
  });

export type ForgotPasswordRequestInput = z.infer<
  typeof forgotPasswordRequestSchema
>;
export type ForgotPasswordResetInput = z.infer<
  typeof forgotPasswordResetSchema
>;
