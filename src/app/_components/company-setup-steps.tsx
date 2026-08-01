"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Input } from "~/app/_components/input";
import {
  FeedbackPresence,
  LoadingButtonContent,
} from "~/app/_components/motion-system";
import { Textarea } from "~/app/_components/textarea";
import type { UpdateCompanyInput } from "~/schemas/company";
import { createUpdateCompanySchema } from "~/schemas/company";

const EMPTY_COMPANY: UpdateCompanyInput = {
  name: "",
  city: "",
  country: "",
  description: "",
  website: "",
  phone: "",
};

type CompanySetupStepsProps = {
  /** Error from the caller's submit — shown under the form. */
  errorMessage: string | null;
  isSubmitting: boolean;
  /** Label of the confirming button, e.g. "Create account" or "Create company". */
  submitLabel: string;
  submittingLabel: string;
  /** Rendered as a "back" link on the first step; omitted when there is nowhere to go back to. */
  onBack?: () => void;
  onErrorDismiss: () => void;
  onSubmit: (company: UpdateCompanyInput) => void;
};

/**
 * "Create a company or join one" plus the company form.
 *
 * Shared by registration (where the company travels with the sign-up request) and by
 * `/onboarding/company`, which is where Google sign-ups land — they never see the registration
 * form, so this is the only place they can pick a company.
 */
export function CompanySetupSteps({
  errorMessage,
  isSubmitting,
  submitLabel,
  submittingLabel,
  onBack,
  onErrorDismiss,
  onSubmit,
}: CompanySetupStepsProps) {
  const t = useTranslations("Auth");
  const companyText = useTranslations("Company");

  const [isCreating, setIsCreating] = useState(false);
  const [showJoinHint, setShowJoinHint] = useState(false);
  const [company, setCompany] = useState<UpdateCompanyInput>(EMPTY_COMPANY);
  const [validationError, setValidationError] = useState<string | null>(null);

  const companySchema = useMemo(
    () =>
      createUpdateCompanySchema({
        nameRequired: companyText("validation.nameRequired"),
        nameTooLong: companyText("validation.nameTooLong"),
        cityTooLong: companyText("validation.cityTooLong"),
        countryTooLong: companyText("validation.countryTooLong"),
        descriptionTooLong: companyText("validation.descriptionTooLong"),
        websiteInvalid: companyText("validation.websiteInvalid"),
        phoneTooLong: companyText("validation.phoneTooLong"),
      }),
    [companyText],
  );

  const setField = (field: keyof UpdateCompanyInput, value: string) => {
    setValidationError(null);
    onErrorDismiss();
    setCompany((previous) => ({ ...previous, [field]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const parsed = companySchema.safeParse(company);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? t("invalidData"));
      return;
    }

    setValidationError(null);
    onSubmit(parsed.data);
  };

  const shownError = validationError ?? errorMessage;
  const errorBanner = (
    <FeedbackPresence show={Boolean(shownError)}>
      <div className="rounded-lg border border-danger-red/20 bg-danger-red-bg px-3 py-2 text-danger-red text-sm">
        {shownError}
      </div>
    </FeedbackPresence>
  );

  if (!isCreating) {
    return (
      <>
        <h1 className="auth-title">{t("companyStepTitle")}</h1>
        <p className="mb-6 text-sm text-text-secondary leading-[1.5]">
          {t("companyStepDescription")}
        </p>

        <div className="flex flex-col gap-3">
          <button
            className="ui-button ui-button-primary w-full"
            onClick={() => {
              setShowJoinHint(false);
              onErrorDismiss();
              setIsCreating(true);
            }}
            type="button"
          >
            {t("createCompany")}
          </button>

          <button
            className="ui-button ui-button-secondary w-full"
            onClick={() => setShowJoinHint(true)}
            type="button"
          >
            {t("joinCompany")}
          </button>
        </div>

        <FeedbackPresence show={showJoinHint}>
          <p className="mt-4 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-sm text-text-secondary leading-[1.4]">
            {t("joinCompanyHint")}
          </p>
        </FeedbackPresence>

        {errorBanner}

        {onBack ? (
          <button
            className="mt-6 text-sm text-text-muted transition-colors hover:text-text-heading"
            onClick={onBack}
            type="button"
          >
            {t("back")}
          </button>
        ) : null}
      </>
    );
  }

  return (
    <>
      <h1 className="auth-title">{t("createCompany")}</h1>
      <p className="mb-6 text-sm text-text-secondary leading-[1.5]">
        {t("createCompanyDescription")}
      </p>

      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <Input
          label={companyText("name")}
          onChange={(event) => setField("name", event.target.value)}
          placeholder={companyText("namePlaceholder")}
          value={company.name}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={companyText("city")}
            onChange={(event) => setField("city", event.target.value)}
            placeholder={companyText("cityPlaceholder")}
            value={company.city}
          />
          <Input
            label={companyText("country")}
            onChange={(event) => setField("country", event.target.value)}
            placeholder={companyText("countryPlaceholder")}
            value={company.country}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={companyText("website")}
            onChange={(event) => setField("website", event.target.value)}
            placeholder={companyText("websitePlaceholder")}
            type="url"
            value={company.website}
          />
          <Input
            label={companyText("phone")}
            onChange={(event) => setField("phone", event.target.value)}
            placeholder={companyText("phonePlaceholder")}
            type="tel"
            value={company.phone}
          />
        </div>

        <Textarea
          label={companyText("description")}
          onChange={(event) => setField("description", event.target.value)}
          placeholder={companyText("descriptionPlaceholder")}
          value={company.description}
        />

        {errorBanner}

        <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="text-sm text-text-muted transition-colors hover:text-text-heading"
            disabled={isSubmitting}
            onClick={() => setIsCreating(false)}
            type="button"
          >
            {t("back")}
          </button>

          <button
            className="ui-button ui-button-primary w-full sm:w-auto"
            disabled={isSubmitting}
            type="submit"
          >
            <LoadingButtonContent
              isLoading={isSubmitting}
              label={submitLabel}
              loadingLabel={submittingLabel}
            />
          </button>
        </div>
      </form>
    </>
  );
}
