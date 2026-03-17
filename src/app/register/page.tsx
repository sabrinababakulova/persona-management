"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useMemo, useState } from "react";
import { registerFormSchema } from "~/schemas/register";
import MailVerificationPage from "./mail-verification";

const VERIFICATION_REQUIRED_CODE_PREFIX = "verification_required:";
const FLOW_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterPageContent />
    </Suspense>
  );
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verificationErrorMessage, setVerificationErrorMessage] = useState<
    string | null
  >(null);

  const verificationFlowId = useMemo(() => {
    const step = searchParams.get("step");
    const flow = searchParams.get("flow");

    if (step !== "mail-verification" || !flow || !FLOW_ID_REGEX.test(flow)) {
      return null;
    }

    return flow;
  }, [searchParams]);

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

      if (result?.code === "rate_limited") {
        setErrorMessage("Слишком много попыток. Попробуйте позже.");
        setIsSubmitting(false);
        return;
      }

      const responseCode = result?.code ?? "";
      if (!responseCode.startsWith(VERIFICATION_REQUIRED_CODE_PREFIX)) {
        setErrorMessage(
          "Не удалось создать аккаунт. Проверьте введенные данные.",
        );
        setIsSubmitting(false);
        return;
      }

      const flowId = responseCode.slice(
        VERIFICATION_REQUIRED_CODE_PREFIX.length,
      );
      if (!FLOW_ID_REGEX.test(flowId)) {
        setErrorMessage(
          "Не удалось начать подтверждение почты. Повторите попытку.",
        );
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      router.replace(
        `/register?step=mail-verification&flow=${encodeURIComponent(flowId)}`,
      );
    } catch {
      setErrorMessage("Что-то пошло не так!");
      setIsSubmitting(false);
    }
  };

  const handleCodeSubmit = async (code: string) => {
    if (!verificationFlowId) {
      return;
    }

    setVerificationErrorMessage(null);
    setIsVerifyingCode(true);

    try {
      const result = await signIn("credentials", {
        mode: "verify-code",
        flowId: verificationFlowId,
        code,
        redirect: false,
      });

      if (result?.code === "rate_limited") {
        setVerificationErrorMessage(
          "Слишком много попыток. Подождите и попробуйте снова.",
        );
        setIsVerifyingCode(false);
        return;
      }

      if (result?.error) {
        setVerificationErrorMessage("Неверный или истекший код подтверждения.");
        setIsVerifyingCode(false);
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setVerificationErrorMessage("Что-то пошло не так!");
      setIsVerifyingCode(false);
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
      {verificationFlowId ? (
        <MailVerificationPage
          errorMessage={verificationErrorMessage}
          isSubmitting={isVerifyingCode}
          onBack={() => {
            setVerificationErrorMessage(null);
            router.replace("/register");
          }}
          onSubmit={handleCodeSubmit}
        />
      ) : (
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
      )}
    </div>
  );
}
