"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FeedbackPresence,
  LoadingButtonContent,
} from "~/app/_components/motion-system";
import type { MailVerificationPageProps } from "~/types/register/mail-verification-page-props";

const CODE_LENGTH = 6;
const CODE_SLOTS = [0, 1, 2, 3, 4, 5] as const;

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

export default function MailVerificationPage({
  email,
  errorMessage,
  isSubmitting = false,
  onBack,
  onSubmit,
}: MailVerificationPageProps) {
  const t = useTranslations("Auth");
  const [code, setCode] = useState<string[]>(() => Array(CODE_LENGTH).fill(""));
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const maskedEmail = useMemo(() => maskEmail(email), [email]);

  const isCodeComplete = useMemo(
    () => code.every((digit) => digit.length === 1),
    [code],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: codex seems to think it's necessary
  useEffect(() => {
    setCode(Array(CODE_LENGTH).fill(""));
  }, [email]);

  const focusInput = (index: number) => {
    inputRefs.current[index]?.focus();
  };

  const updateDigit = (index: number, value: string) => {
    const nextDigit = value.replace(/\D/g, "").slice(-1);
    setCode((prev) => {
      const next = [...prev];
      next[index] = nextDigit;
      return next;
    });

    if (nextDigit && index < CODE_LENGTH - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key !== "Backspace") {
      return;
    }

    if (code[index]) {
      updateDigit(index, "");
      return;
    }

    if (index > 0) {
      focusInput(index - 1);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedDigits = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, CODE_LENGTH)
      .split("");

    if (pastedDigits.length === 0) {
      return;
    }

    event.preventDefault();
    const next = Array(CODE_LENGTH).fill("");

    for (const [index, digit] of pastedDigits.entries()) {
      next[index] = digit;
    }

    setCode(next);
    focusInput(Math.min(pastedDigits.length, CODE_LENGTH - 1));
  };

  const handleSubmit = async () => {
    if (!isCodeComplete || isSubmitting) {
      return;
    }

    await onSubmit(code.join(""));
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
          <div className="flex flex-col gap-4 text-text-heading">
            <h1 className="auth-title mb-0">{t("verification.title")}</h1>
            <p className="text-sm text-text-secondary leading-6">
              {maskedEmail
                ? t("verification.sentTo", { email: maskedEmail })
                : t("verification.sent")}
            </p>
          </div>

          <div className="mt-8 flex items-start gap-2.5 sm:gap-4">
            {CODE_SLOTS.map((slot) => (
              <input
                aria-label={t("verification.digitLabel", {
                  position: slot + 1,
                })}
                className="h-12 min-w-0 flex-1 rounded-lg border border-border-input bg-bg-input text-center font-semibold text-text-heading text-xl outline-none focus:border-primary-blue sm:w-12 sm:flex-none"
                inputMode="numeric"
                key={`verification-digit-${slot}`}
                maxLength={1}
                onChange={(event) => updateDigit(slot, event.target.value)}
                onKeyDown={(event) => handleKeyDown(slot, event)}
                onPaste={handlePaste}
                ref={(element) => {
                  inputRefs.current[slot] = element;
                }}
                type="text"
                value={code[slot]}
              />
            ))}
          </div>

          <FeedbackPresence className="mt-6" show={Boolean(errorMessage)}>
            <div className="rounded-lg border border-danger-red/20 bg-danger-red-bg px-3 py-2 text-danger-red text-sm">
              {errorMessage}
            </div>
          </FeedbackPresence>

          <div className="mt-10 flex items-center justify-between gap-3">
            <button
              className="ui-button ui-button-secondary"
              onClick={onBack}
              type="button"
            >
              {t("back")}
            </button>

            <button
              className="ui-button ui-button-primary"
              disabled={!isCodeComplete || isSubmitting}
              onClick={handleSubmit}
              type="button"
            >
              <LoadingButtonContent
                isLoading={isSubmitting}
                label={t("verification.submit")}
                loadingLabel={t("verification.submitting")}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
