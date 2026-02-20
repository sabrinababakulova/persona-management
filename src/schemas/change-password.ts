import { z } from "zod";

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Введите старый пароль")
      .max(255, "Слишком длинный пароль"),
    newPassword: z
      .string()
      .min(8, "Пароль должен быть не менее 8 символов")
      .max(255, "Слишком длинный пароль")
      .regex(/[^A-Za-z0-9]/, "Пароль должен содержать специальные символы")
      .regex(/[A-ZА-ЯЁ]/, "Пароль должен содержать символы верхнего регистра"),
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

    if (data.currentPassword === data.newPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Новый пароль должен отличаться от старого",
        path: ["newPassword"],
      });
    }
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
