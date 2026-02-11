"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { z } from "zod";

const registerFormSchema = z
  .object({
    firstName: z.string().trim().min(1, "Имя обязательно"),
    lastName: z.string().trim().min(1, "Фамилия обязательна"),
    email: z.string().trim().email("Неверный формат почты"),
    password: z.string().min(8, "Пароль должен быть не менее 8 символов"),
    confirmPassword: z
      .string()
      .min(8, "Пароль должен быть не менее 8 символов"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const parsed = registerFormSchema.safeParse({
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
    });

    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? "Неверные данные");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        mode: "register",
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });

      if (result?.code === "email_exists") {
        setErrorMessage("Пользователь с такой почтой уже существует");
        setIsSubmitting(false);
        return;
      }

      if (result?.error) {
        setErrorMessage(
          "Не удалось создать аккаунт. Проверьте введенные данные.",
        );
        setIsSubmitting(false);
        return;
      }

      router.replace("/dashboard");
    } catch {
      setErrorMessage("Что-то пошло не так!");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex min-h-screen bg-white">
      <div className="relative hidden h-screen w-[695px] shrink-0 lg:block">
        <Image
          alt="Logo"
          className="object-cover"
          fill
          priority
          src="/login-sidebar.svg"
        />
      </div>

      <div className="flex flex-1 items-center justify-center px-6 lg:px-[120px]">
        <div className="w-full max-w-[505px]">
          <h1 className="mb-8 font-bold text-[32px] text-text-heading leading-none tracking-[-0.64px]">
            Зарегестрироваться
          </h1>

          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6 lg:flex-row">
              <div className="flex flex-1 flex-col gap-1">
                <label
                  className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]"
                  htmlFor="register-first-name"
                >
                  Имя
                </label>
                <input
                  className="h-12 w-full rounded-[6px] border border-border-input bg-bg-input px-3 text-[16px] text-text-heading leading-[1.4] tracking-[-0.32px] placeholder:text-text-placeholder focus:border-primary-blue focus:outline-none"
                  id="register-first-name"
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Ваше имя"
                  type="text"
                  value={firstName}
                />
              </div>

              <div className="flex flex-1 flex-col gap-1">
                <label
                  className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]"
                  htmlFor="register-last-name"
                >
                  Фамилия
                </label>
                <input
                  className="h-12 w-full rounded-[6px] border border-border-input bg-bg-input px-3 text-[16px] text-text-heading leading-[1.4] tracking-[-0.32px] placeholder:text-text-placeholder focus:border-primary-blue focus:outline-none"
                  id="register-last-name"
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ваша фамилия"
                  type="text"
                  value={lastName}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label
                className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]"
                htmlFor="register-email"
              >
                Корпоративная почта
              </label>
              <input
                className="h-12 w-full rounded-[6px] border border-border-input bg-bg-input px-3 text-[16px] text-text-heading leading-[1.4] tracking-[-0.32px] placeholder:text-text-placeholder focus:border-primary-blue focus:outline-none"
                id="register-email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Адрес электронной почты"
                type="email"
                value={email}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]"
                htmlFor="register-password"
              >
                Пароль
              </label>
              <input
                className="h-12 w-full rounded-[6px] border border-border-input bg-bg-input px-3 text-[16px] text-text-heading leading-[1.4] tracking-[-0.32px] placeholder:text-text-placeholder focus:border-primary-blue focus:outline-none"
                id="register-password"
                minLength={8}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите ваш пароль"
                type="password"
                value={password}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]"
                htmlFor="register-confirm-password"
              >
                Повторите пароль
              </label>
              <input
                className="h-12 w-full rounded-[6px] border border-border-input bg-bg-input px-3 text-[16px] text-text-heading leading-[1.4] tracking-[-0.32px] placeholder:text-text-placeholder focus:border-primary-blue focus:outline-none"
                id="register-confirm-password"
                minLength={8}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Введите ваш пароль"
                type="password"
                value={confirmPassword}
              />
            </div>

            {errorMessage && (
              <div className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[14px] text-red-700">
                {errorMessage}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end">
              <button
                className="flex h-10 w-[174px] items-center justify-center rounded-[6px] bg-primary-blue font-medium text-[16px] text-white leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-hover"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Создание..." : "Создать аккаунт"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
