"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { getProviders, signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Suspense, useEffect, useMemo, useState } from "react";
import { CompanySetupSteps } from "~/app/_components/company-setup-steps";
import {
  FeedbackPresence,
  LoadingButtonContent,
} from "~/app/_components/motion-system";
import type { UpdateCompanyInput } from "~/schemas/company";
import { createRegisterFormSchema } from "~/schemas/register";
import {
  buildInvitePath,
  isInvitationTokenValid,
} from "~/shared/invitation-token";
import { api } from "~/trpc/react";
import MailVerificationPage from "./mail-verification";

const VERIFICATION_REQUIRED_CODE_PREFIX = "verification_required:";
const FLOW_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const AUTH_INPUT_CLASS =
  "h-11 w-full rounded-xl border border-border-input bg-bg-input px-3.5 text-sm text-text-heading leading-5 placeholder:text-text-placeholder hover:border-border-control hover:bg-white focus:border-primary-blue focus:bg-white focus:outline-none";

/**
 * Sign-up runs in two steps: personal details, then the company (create one or hear how to
 * join). An invite token skips the company step — the company is already decided.
 */
type RegisterStep = "account" | "company";

function getRegisterErrorKey(code?: string | null) {
  switch (code) {
    case "rate_limited":
      return "registerErrors.rateLimited" as const;
    case "invalid_data":
      return "registerErrors.invalidData" as const;
    case "registration_failed":
      return "registerErrors.failedExisting" as const;
    default:
      return "registerErrors.failed" as const;
  }
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterPageContent />
    </Suspense>
  );
}

function RegisterPageContent() {
  const t = useTranslations("Auth");
  const validation = useTranslations("Validation");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<RegisterStep>("account");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isGoogleAvailable, setIsGoogleAvailable] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verificationErrorMessage, setVerificationErrorMessage] = useState<
    string | null
  >(null);

  const registerFormSchema = useMemo(
    () =>
      createRegisterFormSchema({
        firstNameRequired: validation("firstNameRequired"),
        lastNameRequired: validation("lastNameRequired"),
        invalidEmail: validation("invalidEmail"),
        passwordMin: validation("passwordMin"),
        passwordMax: validation("passwordMax"),
        passwordSpecial: validation("passwordSpecial"),
        passwordUppercase: validation("passwordUppercase"),
        passwordsMismatch: validation("passwordsMismatch"),
      }),
    [validation],
  );

  // Registering from an invite link puts the new account straight into the inviting company.
  const inviteToken = useMemo(() => {
    const token = searchParams.get("invite");
    return token && isInvitationTokenValid(token) ? token : null;
  }, [searchParams]);

  const { data: invitation } = api.company.getInvitation.useQuery(
    { token: inviteToken ?? "" },
    { enabled: Boolean(inviteToken), retry: false },
  );

  const verificationFlowId = useMemo(() => {
    const verificationStep = searchParams.get("step");
    const flow = searchParams.get("flow");

    if (
      verificationStep !== "mail-verification" ||
      !flow ||
      !FLOW_ID_REGEX.test(flow)
    ) {
      return null;
    }

    return flow;
  }, [searchParams]);

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

  const submitRegistration = async (newCompany: UpdateCompanyInput | null) => {
    const parsed = registerFormSchema.safeParse({
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
    });

    if (!parsed.success) {
      setStep("account");
      setErrorMessage(parsed.error.issues[0]?.message ?? t("invalidData"));
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
        inviteToken: inviteToken ?? "",
        companyName: newCompany?.name ?? "",
        companyCity: newCompany?.city ?? "",
        companyCountry: newCompany?.country ?? "",
        companyDescription: newCompany?.description ?? "",
        companyWebsite: newCompany?.website ?? "",
        companyPhone: newCompany?.phone ?? "",
        redirect: false,
      });

      if (result?.code === "rate_limited") {
        setErrorMessage(t("registerErrors.rateLimited"));
        setIsSubmitting(false);
        return;
      }

      // With SKIP_EMAIL_VERIFICATION (local development) the server signs the account in
      // instead of asking for a code, so there is no verification step to move to.
      if (result?.ok && !result.error && !result.code) {
        window.location.href = "/dashboard";
        return;
      }

      const responseCode = result?.code ?? "";
      if (!responseCode.startsWith(VERIFICATION_REQUIRED_CODE_PREFIX)) {
        setErrorMessage(t(getRegisterErrorKey(responseCode || result?.error)));
        setIsSubmitting(false);
        return;
      }

      const flowId = responseCode.slice(
        VERIFICATION_REQUIRED_CODE_PREFIX.length,
      );
      if (!FLOW_ID_REGEX.test(flowId)) {
        setErrorMessage(t("registerErrors.verificationStart"));
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      const inviteParam = inviteToken
        ? `&invite=${encodeURIComponent(inviteToken)}`
        : "";
      router.replace(
        `/register?step=mail-verification&flow=${encodeURIComponent(flowId)}${inviteParam}`,
      );
    } catch {
      setErrorMessage(t("unknownError"));
      setIsSubmitting(false);
    }
  };

  const handleAccountSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    const parsed = registerFormSchema.safeParse({
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
    });

    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? t("invalidData"));
      return;
    }

    // The invite link already answers "which company?" — skip straight to account creation.
    if (inviteToken) {
      void submitRegistration(null);
      return;
    }

    setStep("company");
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
          t("registerErrors.verificationRateLimited"),
        );
        setIsVerifyingCode(false);
        return;
      }

      if (result?.error) {
        setVerificationErrorMessage(t("registerErrors.invalidCode"));
        setIsVerifyingCode(false);
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setVerificationErrorMessage(t("unknownError"));
      setIsVerifyingCode(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsGoogleSubmitting(true);

    try {
      await signIn("google", {
        callbackUrl: inviteToken ? buildInvitePath(inviteToken) : "/dashboard",
      });
    } catch {
      setErrorMessage(t("registerErrors.google"));
      setIsGoogleSubmitting(false);
    }
  };

  const errorBanner = (
    <FeedbackPresence show={Boolean(errorMessage)}>
      <div className="rounded-lg border border-danger-red/20 bg-danger-red-bg px-3 py-2 text-danger-red text-sm">
        {errorMessage}
      </div>
    </FeedbackPresence>
  );

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
      {verificationFlowId ? (
        <MailVerificationPage
          errorMessage={verificationErrorMessage}
          isSubmitting={isVerifyingCode}
          onBack={() => {
            setVerificationErrorMessage(null);
            router.replace(
              inviteToken
                ? `/register?invite=${encodeURIComponent(inviteToken)}`
                : "/register",
            );
          }}
          onSubmit={handleCodeSubmit}
        />
      ) : (
        <div className="auth-content">
          <div className="auth-panel">
            {step === "account" && (
              <>
                <h1 className="auth-title">{t("createAccount")}</h1>

                {invitation && (
                  <p className="mb-6 rounded-lg border border-primary-blue/20 bg-primary-blue-light px-3 py-2 text-primary-blue text-sm leading-[1.4]">
                    {t("invitedToCompany", { company: invitation.companyName })}
                  </p>
                )}

                {isGoogleAvailable && (
                  <>
                    <button
                      className="ui-button ui-button-secondary mb-6 w-full"
                      disabled={isGoogleSubmitting || isSubmitting}
                      onClick={() => void handleGoogleSignIn()}
                      type="button"
                    >
                      <span className="text-lg">G</span>
                      <span>
                        {isGoogleSubmitting
                          ? t("redirecting")
                          : t("continueGoogle")}
                      </span>
                    </button>

                    <div className="mb-6 flex items-center gap-3">
                      <div className="h-px flex-1 bg-border-input" />
                      <span className="text-text-muted text-xs">{t("or")}</span>
                      <div className="h-px flex-1 bg-border-input" />
                    </div>
                  </>
                )}

                <form
                  className="flex flex-col gap-5"
                  onSubmit={handleAccountSubmit}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-1 flex-col gap-1.5">
                      <label
                        className="font-semibold text-sm text-text-label leading-5"
                        htmlFor="register-first-name"
                      >
                        {t("firstName")}
                      </label>
                      <input
                        className={AUTH_INPUT_CLASS}
                        id="register-first-name"
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder={t("firstNamePlaceholder")}
                        type="text"
                        value={firstName}
                      />
                    </div>

                    <div className="flex flex-1 flex-col gap-1.5">
                      <label
                        className="font-semibold text-sm text-text-label leading-5"
                        htmlFor="register-last-name"
                      >
                        {t("lastName")}
                      </label>
                      <input
                        className={AUTH_INPUT_CLASS}
                        id="register-last-name"
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder={t("lastNamePlaceholder")}
                        type="text"
                        value={lastName}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      className="font-semibold text-sm text-text-label leading-5"
                      htmlFor="register-email"
                    >
                      {t("corporateEmail")}
                    </label>
                    <input
                      className={AUTH_INPUT_CLASS}
                      id="register-email"
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("emailPlaceholder")}
                      type="email"
                      value={email}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      className="font-semibold text-sm text-text-label leading-5"
                      htmlFor="register-password"
                    >
                      {t("password")}
                    </label>
                    <input
                      className={AUTH_INPUT_CLASS}
                      id="register-password"
                      minLength={8}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t("passwordPlaceholder")}
                      type="password"
                      value={password}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      className="font-semibold text-sm text-text-label leading-5"
                      htmlFor="register-confirm-password"
                    >
                      {t("confirmPassword")}
                    </label>
                    <input
                      className={AUTH_INPUT_CLASS}
                      id="register-confirm-password"
                      minLength={8}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t("passwordPlaceholder")}
                      type="password"
                      value={confirmPassword}
                    />
                  </div>

                  {errorBanner}

                  <div className="mt-2 flex items-center justify-end">
                    <button
                      className="ui-button ui-button-primary w-full sm:w-auto"
                      disabled={isSubmitting}
                      type="submit"
                    >
                      <LoadingButtonContent
                        isLoading={isSubmitting}
                        label={inviteToken ? t("createAccount") : t("continue")}
                        loadingLabel={t("creatingAccount")}
                      />
                    </button>
                  </div>
                </form>
              </>
            )}

            {step === "company" && (
              <CompanySetupSteps
                errorMessage={errorMessage}
                isSubmitting={isSubmitting}
                onBack={() => setStep("account")}
                onErrorDismiss={() => setErrorMessage(null)}
                onSubmit={(newCompany) => void submitRegistration(newCompany)}
                submitLabel={t("createAccount")}
                submittingLabel={t("creatingAccount")}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
