import { z } from "zod";

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, "Имя обязательно"),
  lastName: z.string().trim().min(1, "Фамилия обязательна"),
  email: z.string().trim().email("Неверный формат почты").toLowerCase(),
  password: z.string().min(8, "Пароль должен быть не менее 8 символов"),
});

export const registerFormSchema = registerSchema
  .extend({
    confirmPassword: z
      .string()
      .min(8, "Пароль должен быть не менее 8 символов"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });
