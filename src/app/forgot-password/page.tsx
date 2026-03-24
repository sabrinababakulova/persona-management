"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Input } from "~/app/_components/input";
import {
  forgotPasswordRequestSchema,
  forgotPasswordResetSchema,
} from "~/schemas/forgot-password";
import { api } from "~/trpc/react";

const FLOW_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function maskEmail(email?: string) {
  if (!email) {
    return null;
  }

  const [localPart, domainPart] = email.split("@");
  if (!localPart || !domainPart) {
    return null;
  }

  if (localPart.length <= 2) {
    return `${localPart[0] ?? ""}***@${domainPart}`;
  }

  return `${localPart.slice(0, 2)}${"*".repeat(localPart.length - 2)}@${domainPart}`;
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordPageContent />
    </Suspense>
  );
}

function ForgotPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetFlow = useMemo(() => {
    const step = searchParams.get("step");
    const flowId = searchParams.get("flow");
    const flowEmail = searchParams.get("email");

    if (step !== "reset" || !flowId || !FLOW_ID_REGEX.test(flowId)) {
      return null;
    }

    return {
      flowId,
      email: flowEmail ?? "",
    };
  }, [searchParams]);

  useEffect(() => {
    if (resetFlow?.email) {
      setEmail(resetFlow.email);
    }
  }, [resetFlow?.email]);

  const maskedEmail = useMemo(
    () => maskEmail(resetFlow?.email || email),
    [email, resetFlow?.email],
  );

  const requestPasswordReset = api.profile.requestPasswordReset.useMutation();
  const resetPassword = api.profile.resetPassword.useMutation();

  const handleRequestSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const parsed = forgotPasswordRequestSchema.safeParse({ email });
    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? "Неверные данные");
      return;
    }

    try {
      const response = await requestPasswordReset.mutateAsync(parsed.data);
      router.replace(
        `/forgot-password?step=reset&flow=${encodeURIComponent(response.flowId)}&email=${encodeURIComponent(response.email)}`,
      );
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Что-то пошло не так!",
      );
    }
  };

  const handleResetSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resetFlow) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const parsed = forgotPasswordResetSchema.safeParse({
      flowId: resetFlow.flowId,
      code,
      newPassword,
      confirmPassword,
    });

    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? "Неверные данные");
      return;
    }

    try {
      const response = await resetPassword.mutateAsync(parsed.data);
      setSuccessMessage(response.message);
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Что-то пошло не так!",
      );
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
          <div className="mb-8 space-y-3">
            <h1 className="font-bold text-[32px] text-text-heading leading-none tracking-[-0.64px]">
              Восстановление пароля
            </h1>
            <p className="text-[16px] text-text-secondary leading-[1.4] tracking-[-0.32px]">
              {resetFlow
                ? maskedEmail
                  ? `Введите код из письма для ${maskedEmail} и задайте новый пароль.`
                  : "Введите код из письма и задайте новый пароль."
                : "Укажите почту, и мы отправим код для смены пароля."}
            </p>
          </div>

          {successMessage ? (
            <div className="space-y-6">
              <div className="rounded-[6px] border border-green-200 bg-green-50 px-4 py-3 text-[14px] text-green-700">
                {successMessage}
              </div>
              <Link
                className="flex h-10 w-[174px] items-center justify-center rounded-[6px] bg-primary-blue font-medium text-[16px] text-white leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-hover"
                href="/login"
              >
                Вернуться ко входу
              </Link>
            </div>
          ) : resetFlow ? (
            <form className="flex flex-col gap-6" onSubmit={handleResetSubmit}>
              <Input
                autoComplete="one-time-code"
                inputMode="numeric"
                label="Код из письма"
                maxLength={6}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="Введите 6-значный код"
                value={code}
              />
              <Input
                autoComplete="new-password"
                label="Новый пароль"
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Введите новый пароль"
                type="password"
                value={newPassword}
              />
              <Input
                autoComplete="new-password"
                label="Повторите новый пароль"
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Повторите новый пароль"
                type="password"
                value={confirmPassword}
              />

              {errorMessage && (
                <div className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[14px] text-red-700">
                  {errorMessage}
                </div>
              )}

              <div className="mt-2 flex items-center justify-between">
                <button
                  className="text-[14px] text-text-secondary transition-colors hover:text-text-heading"
                  onClick={() => {
                    setErrorMessage(null);
                    setCode("");
                    setNewPassword("");
                    setConfirmPassword("");
                    router.replace("/forgot-password");
                  }}
                  type="button"
                >
                  Изменить почту
                </button>
                <button
                  className="flex h-10 w-[174px] items-center justify-center rounded-[6px] bg-primary-blue font-medium text-[16px] text-white leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-hover disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={resetPassword.isPending}
                  type="submit"
                >
                  {resetPassword.isPending
                    ? "Сохранение..."
                    : "Сохранить пароль"}
                </button>
              </div>
            </form>
          ) : (
            <form
              className="flex flex-col gap-6"
              onSubmit={handleRequestSubmit}
            >
              <Input
                autoComplete="email"
                label="Почта"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Адрес электронной почты"
                type="email"
                value={email}
              />

              {errorMessage && (
                <div className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[14px] text-red-700">
                  {errorMessage}
                </div>
              )}

              <div className="mt-2 flex items-center justify-between">
                <Link
                  className="text-[14px] text-text-secondary transition-colors hover:text-text-heading"
                  href="/login"
                >
                  Назад ко входу
                </Link>
                <button
                  className="flex h-10 w-[174px] items-center justify-center rounded-[6px] bg-primary-blue font-medium text-[16px] text-white leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-hover disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={requestPasswordReset.isPending}
                  type="submit"
                >
                  {requestPasswordReset.isPending
                    ? "Отправка..."
                    : "Получить код"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
