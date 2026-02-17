"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
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
          <div className="flex flex-col gap-4 text-text-heading">
            <h1 className="font-bold text-[32px] leading-none tracking-[-0.64px]">
              Подтвердите почту
            </h1>
            <p className="text-[16px] leading-[1.2] tracking-[-0.32px]">
              {maskedEmail
                ? `Мы отправили 6-значный код на почту ${maskedEmail}`
                : "Мы отправили 6-значный код на вашу почту"}
            </p>
          </div>

          <div className="mt-8 flex items-start gap-4">
            {CODE_SLOTS.map((slot) => (
              <input
                aria-label={`Код ${slot + 1}`}
                className="h-12 w-10 rounded-[6px] border border-border-input bg-bg-input text-center text-[20px] text-text-heading outline-none focus:border-primary-blue"
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

          {errorMessage && (
            <div className="mt-6 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[14px] text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="mt-12 flex items-center justify-between">
            <button
              className="flex h-10 w-[104px] items-center justify-center rounded-[6px] font-semibold text-[16px] text-text-placeholder leading-none tracking-[-0.32px]"
              onClick={onBack}
              type="button"
            >
              Назад
            </button>

            <button
              className="flex h-10 w-[174px] items-center justify-center rounded-[6px] bg-primary-blue font-medium text-[16px] text-white leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-hover disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!isCodeComplete || isSubmitting}
              onClick={handleSubmit}
              type="button"
            >
              {isSubmitting ? "Проверка..." : "Подтвердить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
