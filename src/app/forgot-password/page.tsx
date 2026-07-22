"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Input } from "~/app/_components/input";
import {
  FeedbackPresence,
  LoadingButtonContent,
} from "~/app/_components/motion-system";
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
    <div className="auth-layout">
      <div className="auth-art">
        <Image
          alt="Logo"
          className="object-cover"
          fill
          priority
          src="/login-sidebar.svg"
        />
      </div>

      <div className="auth-content">
        <div className="auth-panel">
          <div className="mb-7 space-y-3">
            <h1 className="auth-title mb-0">Восстановление пароля</h1>
            <p className="text-sm text-text-secondary leading-6">
              {resetFlow
                ? maskedEmail
                  ? `Введите код из письма для ${maskedEmail} и задайте новый пароль.`
                  : "Введите код из письма и задайте новый пароль."
                : "Укажите почту, и мы отправим код для смены пароля."}
            </p>
          </div>

          {successMessage ? (
            <div className="space-y-6">
              <div className="rounded-lg border border-success-green/20 bg-success-green-bg px-4 py-3 text-sm text-success-green">
                {successMessage}
              </div>
              <Link className="ui-button ui-button-primary" href="/login">
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

              <FeedbackPresence show={Boolean(errorMessage)}>
                <div className="rounded-lg border border-danger-red/20 bg-danger-red-bg px-3 py-2 text-danger-red text-sm">
                  {errorMessage}
                </div>
              </FeedbackPresence>

              <div className="mt-2 flex items-center justify-between">
                <button
                  className="text-sm text-text-secondary transition-colors hover:text-text-heading"
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
                  className="ui-button ui-button-primary"
                  disabled={resetPassword.isPending}
                  type="submit"
                >
                  <LoadingButtonContent
                    isLoading={resetPassword.isPending}
                    label="Сохранить пароль"
                    loadingLabel="Сохранение..."
                  />
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

              <FeedbackPresence show={Boolean(errorMessage)}>
                <div className="rounded-lg border border-danger-red/20 bg-danger-red-bg px-3 py-2 text-danger-red text-sm">
                  {errorMessage}
                </div>
              </FeedbackPresence>

              <div className="mt-2 flex items-center justify-between">
                <Link
                  className="text-sm text-text-secondary transition-colors hover:text-text-heading"
                  href="/login"
                >
                  Назад ко входу
                </Link>
                <button
                  className="ui-button ui-button-primary"
                  disabled={requestPasswordReset.isPending}
                  type="submit"
                >
                  <LoadingButtonContent
                    isLoading={requestPasswordReset.isPending}
                    label="Получить код"
                    loadingLabel="Отправка..."
                  />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
