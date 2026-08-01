"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Input } from "~/app/_components/input";
import {
  FeedbackPresence,
  LoadingButtonContent,
} from "~/app/_components/motion-system";
import {
  createForgotPasswordRequestSchema,
  createForgotPasswordResetSchema,
} from "~/schemas/forgot-password";
import { api } from "~/trpc/react";
import { resolveTrpcError } from "~/utils/trpc-error";

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
  const t = useTranslations("Auth");
  const validation = useTranslations("Validation");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const validationMessages = useMemo(
    () => ({
      invalidEmail: validation("invalidEmail"),
      passwordMin: validation("passwordMin"),
      passwordMax: validation("passwordMax"),
      passwordSpecial: validation("passwordSpecial"),
      passwordUppercase: validation("passwordUppercase"),
      invalidFlow: validation("invalidResetFlow"),
      invalidCode: validation("invalidCode"),
      confirmPassword: validation("confirmNewPassword"),
      passwordsMismatch: validation("newPasswordsMismatch"),
    }),
    [validation],
  );
  const forgotPasswordRequestSchema = useMemo(
    () => createForgotPasswordRequestSchema(validationMessages),
    [validationMessages],
  );
  const forgotPasswordResetSchema = useMemo(
    () => createForgotPasswordResetSchema(validationMessages),
    [validationMessages],
  );

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

  // Both render their failure inline above the form; the global toast would repeat it.
  const requestPasswordReset = api.profile.requestPasswordReset.useMutation({
    meta: { errorHandled: true },
  });
  const resetPassword = api.profile.resetPassword.useMutation({
    meta: { errorHandled: true },
  });

  const handleRequestSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const parsed = forgotPasswordRequestSchema.safeParse({ email });
    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? t("invalidData"));
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
      setErrorMessage(resolveTrpcError(error).message ?? t("unknownError"));
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
      setErrorMessage(parsed.error.issues[0]?.message ?? t("invalidData"));
      return;
    }

    try {
      await resetPassword.mutateAsync(parsed.data);
      setSuccessMessage(t("forgot.success"));
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setErrorMessage(resolveTrpcError(error).message ?? t("unknownError"));
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
            <h1 className="auth-title mb-0">{t("forgot.title")}</h1>
            <p className="text-sm text-text-secondary leading-6">
              {resetFlow
                ? maskedEmail
                  ? t("forgot.resetDescriptionEmail", { email: maskedEmail })
                  : t("forgot.resetDescription")
                : t("forgot.requestDescription")}
            </p>
          </div>

          {successMessage ? (
            <div className="space-y-6">
              <div className="rounded-lg border border-success-green/20 bg-success-green-bg px-4 py-3 text-sm text-success-green">
                {successMessage}
              </div>
              <Link className="ui-button ui-button-primary" href="/login">
                {t("backToSignIn")}
              </Link>
            </div>
          ) : resetFlow ? (
            <form className="flex flex-col gap-6" onSubmit={handleResetSubmit}>
              <Input
                autoComplete="one-time-code"
                inputMode="numeric"
                label={t("forgot.code")}
                maxLength={6}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder={t("forgot.codePlaceholder")}
                value={code}
              />
              <Input
                autoComplete="new-password"
                label={t("forgot.newPassword")}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder={t("forgot.newPasswordPlaceholder")}
                type="password"
                value={newPassword}
              />
              <Input
                autoComplete="new-password"
                label={t("forgot.confirmNewPassword")}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={t("forgot.confirmNewPasswordPlaceholder")}
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
                  {t("forgot.changeEmail")}
                </button>
                <button
                  className="ui-button ui-button-primary"
                  disabled={resetPassword.isPending}
                  type="submit"
                >
                  <LoadingButtonContent
                    isLoading={resetPassword.isPending}
                    label={t("forgot.savePassword")}
                    loadingLabel={t("forgot.saving")}
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
                label={t("email")}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("emailPlaceholder")}
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
                  {t("forgot.back")}
                </Link>
                <button
                  className="ui-button ui-button-primary"
                  disabled={requestPasswordReset.isPending}
                  type="submit"
                >
                  <LoadingButtonContent
                    isLoading={requestPasswordReset.isPending}
                    label={t("forgot.getCode")}
                    loadingLabel={t("forgot.sending")}
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
