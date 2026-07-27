import { z } from "zod";

export type ForgotPasswordValidationMessages = {
  invalidEmail: string;
  passwordMin: string;
  passwordMax: string;
  passwordSpecial: string;
  passwordUppercase: string;
  invalidFlow: string;
  invalidCode: string;
  confirmPassword: string;
  passwordsMismatch: string;
};

const russianMessages: ForgotPasswordValidationMessages = {
  invalidEmail: "Неверный формат почты",
  passwordMin: "Пароль должен быть не менее 8 символов",
  passwordMax: "Слишком длинный пароль",
  passwordSpecial: "Пароль должен содержать специальные символы",
  passwordUppercase: "Пароль должен содержать символы верхнего регистра",
  invalidFlow: "Некорректный идентификатор сброса",
  invalidCode: "Введите 6-значный код",
  confirmPassword: "Повторите новый пароль",
  passwordsMismatch: "Новый пароль и подтверждение не совпадают",
};

export function createForgotPasswordRequestSchema(
  messages: ForgotPasswordValidationMessages = russianMessages,
) {
  return z.object({
    email: z.string().trim().email(messages.invalidEmail).toLowerCase(),
  });
}

export function createForgotPasswordResetSchema(
  messages: ForgotPasswordValidationMessages = russianMessages,
) {
  const passwordSchema = z
    .string()
    .min(8, messages.passwordMin)
    .max(255, messages.passwordMax)
    .regex(/[^A-Za-z0-9]/, messages.passwordSpecial)
    .regex(/[A-ZА-ЯЁ]/, messages.passwordUppercase);

  return z
    .object({
      flowId: z.string().uuid(messages.invalidFlow),
      code: z.string().regex(/^\d{6}$/, messages.invalidCode),
      newPassword: passwordSchema,
      confirmPassword: z
        .string()
        .min(1, messages.confirmPassword)
        .max(255, messages.passwordMax),
    })
    .superRefine((data, ctx) => {
      if (data.newPassword !== data.confirmPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: messages.passwordsMismatch,
          path: ["confirmPassword"],
        });
      }
    });
}

export const forgotPasswordRequestSchema = createForgotPasswordRequestSchema();
export const forgotPasswordResetSchema = createForgotPasswordResetSchema();

export type ForgotPasswordRequestInput = z.infer<
  typeof forgotPasswordRequestSchema
>;
export type ForgotPasswordResetInput = z.infer<
  typeof forgotPasswordResetSchema
>;
