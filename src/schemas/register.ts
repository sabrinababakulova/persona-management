import { z } from "zod";

export type RegisterValidationMessages = {
  firstNameRequired: string;
  lastNameRequired: string;
  invalidEmail: string;
  passwordMin: string;
  passwordMax: string;
  passwordSpecial: string;
  passwordUppercase: string;
  passwordsMismatch: string;
};

const russianMessages: RegisterValidationMessages = {
  firstNameRequired: "Имя обязательно",
  lastNameRequired: "Фамилия обязательна",
  invalidEmail: "Неверный формат почты",
  passwordMin: "Пароль должен быть не менее 8 символов",
  passwordMax: "Слишком длинный пароль",
  passwordSpecial: "Пароль должен содержать специальные символы",
  passwordUppercase: "Пароль должен содержать символы верхнего регистра",
  passwordsMismatch: "Пароли не совпадают",
};

export function createRegisterSchema(
  messages: RegisterValidationMessages = russianMessages,
) {
  return z.object({
    firstName: z.string().trim().min(1, messages.firstNameRequired),
    lastName: z.string().trim().min(1, messages.lastNameRequired),
    email: z.string().trim().email(messages.invalidEmail).toLowerCase(),
    password: z
      .string()
      .min(8, messages.passwordMin)
      .max(255, messages.passwordMax)
      .regex(/[^A-Za-z0-9]/, messages.passwordSpecial)
      .regex(/[A-ZА-ЯЁ]/, messages.passwordUppercase),
  });
}

export function createRegisterFormSchema(
  messages: RegisterValidationMessages = russianMessages,
) {
  return createRegisterSchema(messages)
    .extend({
      confirmPassword: z.string().min(8, messages.passwordMin),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: messages.passwordsMismatch,
      path: ["confirmPassword"],
    });
}

export const registerSchema = createRegisterSchema();
export const registerFormSchema = createRegisterFormSchema();
