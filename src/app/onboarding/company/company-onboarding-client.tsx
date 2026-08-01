"use client";

import { signOut, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { CompanySetupSteps } from "~/app/_components/company-setup-steps";
import { LoadingState } from "~/app/_components/motion-system";
import { api } from "~/trpc/react";

type CompanyOnboardingClientProps = {
  /** True when the account already belongs to a company — only a stale session lands here. */
  hasCompany: boolean;
};

export function CompanyOnboardingClient({
  hasCompany,
}: CompanyOnboardingClientProps) {
  const t = useTranslations("Auth");
  const { update: updateSession } = useSession();
  const [error, setError] = useState<string | null>(null);

  /**
   * Leaves onboarding for good: refresh the session first so the token stops saying "no
   * company", then reload, otherwise the middleware would send us straight back here.
   */
  const goToDashboard = useCallback(async () => {
    try {
      await updateSession();
    } catch {
      // A failed refresh is not fatal — the next session read rebuilds the token.
    }
    window.location.href = "/dashboard";
  }, [updateSession]);

  // Already onboarded (stale cookie): heal the session and move on without user interaction.
  useEffect(() => {
    if (hasCompany) {
      void goToDashboard();
    }
  }, [hasCompany, goToDashboard]);

  const createCompany = api.company.createForCurrentUser.useMutation({
    onSuccess: () => {
      void goToDashboard();
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  if (hasCompany) {
    return <LoadingState label={t("redirecting")} />;
  }

  return (
    <>
      <CompanySetupSteps
        errorMessage={error}
        isSubmitting={createCompany.isPending || createCompany.isSuccess}
        onErrorDismiss={() => setError(null)}
        onSubmit={(company) => createCompany.mutate(company)}
        submitLabel={t("createCompany")}
        submittingLabel={t("creatingCompany")}
      />

      <button
        className="mt-6 text-sm text-text-muted transition-colors hover:text-text-heading"
        onClick={() => void signOut({ callbackUrl: "/login" })}
        type="button"
      >
        {t("signOutAndUseAnotherAccount")}
      </button>
    </>
  );
}
