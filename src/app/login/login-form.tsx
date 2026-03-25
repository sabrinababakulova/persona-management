"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getProviders, signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isGoogleAvailable, setIsGoogleAvailable] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [router, status]);

  useEffect(() => {
    let isMounted = true;

    void getProviders().then((providers) => {
      if (!isMounted) return;
      setIsGoogleAvailable(Boolean(providers?.google));
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await signIn("credentials", {
        mode: "login",
        email,
        password,
        redirect: false,
      });

      if (result?.code === "rate_limited") {
        setErrorMessage("Слишком много попыток входа. Попробуйте позже.");
        setPassword("");
        setIsSubmitting(false);
        return;
      }

      if (result?.error) {
        setErrorMessage("Неверная почта или пароль.");
        setPassword("");
        setIsSubmitting(false);
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setErrorMessage("Что-то пошло не так!");
      setIsSubmitting(false);
    }
  };
  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsGoogleSubmitting(true);

    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch {
      setErrorMessage("Не удалось войти через Google.");
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex min-h-screen bg-white">
      {/* Left Sidebar with Logo */}
      <div className="relative hidden h-screen w-[695px] shrink-0 lg:block">
        <Image
          alt="Logo"
          className="object-cover"
          fill
          priority
          src="/login-sidebar.svg"
        />
      </div>

      {/* Right Content Area */}
      <div className="flex flex-1 items-center justify-center px-6 lg:px-[120px]">
        <div className="w-full max-w-[505px]">
          {/* Title */}
          <h1 className="mb-8 font-bold text-[32px] text-text-heading leading-none tracking-[-0.64px]">
            Войти
          </h1>
          {isGoogleAvailable && (
            <>
              <button
                className="mb-6 flex h-12 w-full items-center justify-center gap-3 rounded-[6px] border border-border-input bg-white font-medium text-[16px] text-text-heading tracking-[-0.32px] transition-colors hover:bg-bg-input disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isGoogleSubmitting || isSubmitting}
                onClick={() => void handleGoogleSignIn()}
                type="button"
              >
                <Image
                  alt="Google Icon"
                  className="object-cover"
                  height={24}
                  src="/google-icon.svg"
                  width={24}
                />
                <span>
                  {isGoogleSubmitting ? "Переход..." : "Войти через Google"}
                </span>
              </button>

              <div className="mb-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border-input" />
                <span className="text-[12px] text-text-muted">или</span>
                <div className="h-px flex-1 bg-border-input" />
              </div>
            </>
          )}
          {/* Form */}
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            {/* Email Field */}
            <div className="flex flex-col gap-1">
              <label
                className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]"
                htmlFor="login-email"
              >
                Почта
              </label>
              <input
                className="h-12 w-full rounded-[6px] border border-border-input bg-bg-input px-3 text-[16px] text-text-heading leading-[1.4] tracking-[-0.32px] placeholder:text-text-placeholder focus:border-primary-blue focus:outline-none"
                id="login-email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Адрес электронной почты"
                type="email"
                value={email}
              />
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1">
              <label
                className="font-medium text-[16px] text-text-label leading-[1.4] tracking-[-0.32px]"
                htmlFor="login-password"
              >
                Пароль
              </label>
              <input
                className="h-12 w-full rounded-[6px] border border-border-input bg-bg-input px-3 text-[16px] text-text-heading leading-[1.4] tracking-[-0.32px] placeholder:text-text-placeholder focus:border-primary-blue focus:outline-none"
                id="login-password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите ваш пароль"
                type="password"
                value={password}
              />
              <Link
                className="mt-1 text-right text-[12px] text-text-muted leading-[1.4] tracking-[-0.24px] transition-colors hover:text-text-heading"
                href="/forgot-password"
              >
                Забыли пароль?
              </Link>
            </div>

            {/* Buttons */}
            {errorMessage && (
              <div className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[14px] text-red-700">
                {errorMessage}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <Link
                className="flex h-10 w-[174px] items-center justify-center rounded-[6px] bg-primary-blue-light font-semibold text-[16px] text-primary-blue tracking-[-0.32px] transition-colors hover:bg-primary-blue-light-hover"
                href="/register"
              >
                Создать аккаунт
              </Link>
              <button
                className="flex h-10 w-[174px] items-center justify-center rounded-[6px] bg-primary-blue font-medium text-[16px] text-white tracking-[-0.32px] transition-colors hover:bg-primary-blue-hover"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Вход..." : "Войти"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
