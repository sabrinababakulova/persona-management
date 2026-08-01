"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { ClosableSection } from "~/app/_components/closable-section";
import { ImageUploader } from "~/app/_components/image-uploader";
import { Input } from "~/app/_components/input";
import {
  FeedbackPresence,
  LoadingButtonContent,
  LoadingState,
} from "~/app/_components/motion-system";
import { Textarea } from "~/app/_components/textarea";
import type { UpdateCompanyInput } from "~/schemas/company";
import { createUpdateCompanySchema } from "~/schemas/company";
import { api } from "~/trpc/react";

const EMPTY_FORM: UpdateCompanyInput = {
  name: "",
  city: "",
  country: "",
  description: "",
  website: "",
  phone: "",
};

export function CompanyProfileSection() {
  const t = useTranslations("Company");
  const common = useTranslations("Common");
  const router = useRouter();
  const utils = api.useUtils();

  const [form, setForm] = useState<UpdateCompanyInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const {
    data: company,
    isLoading,
    error: loadError,
  } = api.company.get.useQuery();

  const schema = useMemo(
    () =>
      createUpdateCompanySchema({
        nameRequired: t("validation.nameRequired"),
        nameTooLong: t("validation.nameTooLong"),
        cityTooLong: t("validation.cityTooLong"),
        countryTooLong: t("validation.countryTooLong"),
        descriptionTooLong: t("validation.descriptionTooLong"),
        websiteInvalid: t("validation.websiteInvalid"),
        phoneTooLong: t("validation.phoneTooLong"),
      }),
    [t],
  );

  // Seed the form once the company arrives; later refetches must not discard edits.
  useEffect(() => {
    if (company && !form) {
      setForm({
        name: company.name,
        city: company.city,
        country: company.country,
        description: company.description,
        website: company.website,
        phone: company.phone,
      });
    }
  }, [company, form]);

  const updateCompany = api.company.update.useMutation({
    onSuccess: () => {
      setError(null);
      setMessage(t("saved"));
      void utils.company.get.invalidate();
      // The header and profile heading render the company name server-side.
      router.refresh();
    },
    onError: (mutationError) => {
      setMessage(null);
      setError(mutationError.message);
    },
  });

  const updateLogo = api.company.updateLogo.useMutation({
    onSuccess: () => {
      setError(null);
      setMessage(t("logoUpdated"));
      void utils.company.get.invalidate();
      router.refresh();
    },
    onError: (mutationError) => {
      setMessage(null);
      setError(mutationError.message);
    },
  });

  const values = form ?? EMPTY_FORM;
  const isDisabled = !form || updateCompany.isPending;

  const setField = (field: keyof UpdateCompanyInput, value: string) => {
    setMessage(null);
    setError(null);
    setForm((previous) => ({ ...(previous ?? EMPTY_FORM), [field]: value }));
  };

  const handleSave = () => {
    if (!form) {
      return;
    }

    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setMessage(null);
      setError(parsed.error.issues[0]?.message ?? common("invalidData"));
      return;
    }

    updateCompany.mutate(parsed.data);
  };

  return (
    <ClosableSection title={t("companyProfile")}>
      {isLoading ? <LoadingState compact label={t("loading")} /> : null}

      {loadError && (
        <p className="text-danger-red text-sm leading-[1.4]">
          {loadError.message}
        </p>
      )}

      {company && (
        <>
          <div className="flex items-center gap-4">
            <ImageUploader
              disabled={updateLogo.isPending}
              initialImageUrl={company.logoUrl}
              onUploaded={async (logoFileId) => {
                await updateLogo.mutateAsync({ logoFileId });
              }}
              variant="avatar"
            />
            <div className="min-w-0">
              <p className="font-semibold text-sm text-text-heading leading-5">
                {t("logo")}
              </p>
              <p className="mt-0.5 text-text-secondary text-xs leading-[1.4]">
                {t("logoHint")}
              </p>
            </div>
          </div>

          <Input
            disabled={isDisabled}
            label={t("name")}
            onChange={(event) => setField("name", event.target.value)}
            placeholder={t("namePlaceholder")}
            value={values.name}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              disabled={isDisabled}
              label={t("city")}
              onChange={(event) => setField("city", event.target.value)}
              placeholder={t("cityPlaceholder")}
              value={values.city}
            />
            <Input
              disabled={isDisabled}
              label={t("country")}
              onChange={(event) => setField("country", event.target.value)}
              placeholder={t("countryPlaceholder")}
              value={values.country}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              disabled={isDisabled}
              label={t("website")}
              onChange={(event) => setField("website", event.target.value)}
              placeholder={t("websitePlaceholder")}
              type="url"
              value={values.website}
            />
            <Input
              disabled={isDisabled}
              label={t("phone")}
              onChange={(event) => setField("phone", event.target.value)}
              placeholder={t("phonePlaceholder")}
              type="tel"
              value={values.phone}
            />
          </div>

          <Textarea
            disabled={isDisabled}
            label={t("description")}
            onChange={(event) => setField("description", event.target.value)}
            placeholder={t("descriptionPlaceholder")}
            value={values.description}
          />

          <FeedbackPresence show={Boolean(error)}>
            <p className="text-danger-red text-xs leading-[1.4]">{error}</p>
          </FeedbackPresence>

          <FeedbackPresence show={Boolean(message)}>
            <p className="text-success-green text-xs leading-[1.4]">
              {message}
            </p>
          </FeedbackPresence>

          <div className="flex justify-end">
            <button
              className="ui-button ui-button-primary w-full sm:w-auto"
              disabled={isDisabled || values.name.trim().length === 0}
              onClick={handleSave}
              type="button"
            >
              <LoadingButtonContent
                isLoading={updateCompany.isPending}
                label={common("saveChanges")}
                loadingLabel={common("saving")}
              />
            </button>
          </div>
        </>
      )}
    </ClosableSection>
  );
}
