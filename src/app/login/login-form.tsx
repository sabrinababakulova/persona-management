"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getProviders, signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  FeedbackPresence,
  LoadingButtonContent,
} from "~/app/_components/motion-system";

function getLoginErrorMessage(code?: string | null) {
  switch (code) {
    case "missing_credentials":
      return "Введите почту и пароль.";
    case "rate_limited":
      return "Слишком много попыток входа. Попробуйте позже.";
    case "user_not_found":
      return "Пользователь с такой почтой не найден.";
    case "password_incorrect":
      return "Неверный пароль. Попробуйте еще раз.";
    case "email_not_verified":
      return "Подтвердите почту перед входом в аккаунт.";
    case "password_sign_in_unavailable":
      return "Для этого аккаунта вход по паролю недоступен.";
    default:
      return "Не удалось войти. Проверьте введенные данные.";
  }
}

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

      const authCode = result?.code ?? result?.error;
      if (authCode) {
        setErrorMessage(getLoginErrorMessage(authCode));
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
    <div className="auth-layout">
      {/* Left Sidebar with Logo */}
      <div className="auth-art">
        <Image
          alt="Logo"
          className="object-cover"
          fill
          priority
          src="/login-sidebar.svg"
        />
      </div>

      {/* Right Content Area */}
      <div className="auth-content">
        <div className="auth-panel">
          {/* Title */}
          <h1 className="auth-title">Войти</h1>
          {isGoogleAvailable && (
            <>
              <button
                className="ui-button ui-button-secondary mb-6 h-11 w-full"
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
                <span className="text-text-muted text-xs">или</span>
                <div className="h-px flex-1 bg-border-input" />
              </div>
            </>
          )}
          {/* Form */}
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            {/* Email Field */}
            <div className="flex flex-col gap-1.5">
              <label
                className="font-semibold text-sm text-text-label leading-5"
                htmlFor="login-email"
              >
                Почта
              </label>
              <input
                className="h-11 w-full rounded-xl border border-border-input bg-bg-input px-3.5 text-sm text-text-heading leading-5 placeholder:text-text-placeholder hover:border-border-control hover:bg-white focus:border-primary-blue focus:bg-white focus:outline-none"
                id="login-email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Адрес электронной почты"
                type="email"
                value={email}
              />
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1.5">
              <label
                className="font-semibold text-sm text-text-label leading-5"
                htmlFor="login-password"
              >
                Пароль
              </label>
              <input
                className="h-11 w-full rounded-xl border border-border-input bg-bg-input px-3.5 text-sm text-text-heading leading-5 placeholder:text-text-placeholder hover:border-border-control hover:bg-white focus:border-primary-blue focus:bg-white focus:outline-none"
                id="login-password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите ваш пароль"
                type="password"
                value={password}
              />
              <Link
                className="mt-1 text-right text-text-muted text-xs leading-[1.4] transition-colors hover:text-text-heading"
                href="/forgot-password"
              >
                Забыли пароль?
              </Link>
            </div>

            {/* Buttons */}
            <FeedbackPresence show={Boolean(errorMessage)}>
              <div className="rounded-lg border border-danger-red/20 bg-danger-red-bg px-3 py-2 text-danger-red text-sm">
                {errorMessage}
              </div>
            </FeedbackPresence>

            <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row">
              <Link
                className="ui-button ui-button-soft flex-1"
                href="/register"
              >
                Создать аккаунт
              </Link>
              <button
                className="ui-button ui-button-primary flex-1"
                disabled={isSubmitting}
                type="submit"
              >
                <LoadingButtonContent
                  isLoading={isSubmitting}
                  label="Войти"
                  loadingLabel="Вход..."
                />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
