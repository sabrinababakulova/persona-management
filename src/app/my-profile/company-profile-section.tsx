"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { ClosableSection } from "~/app/_components/closable-section";
import type { UpdateCompanyInput } from "~/schemas/company";
import { createUpdateCompanySchema } from "~/schemas/company";
import { api } from "~/trpc/react";
import {
  CompanyProfileEditor,
  CompanyProfileSkeleton,
  CompanyProfileView,
} from "./company-profile-view";

const EMPTY_FORM: UpdateCompanyInput = {
  name: "",
  city: "",
  country: "",
  description: "",
  website: "",
  phone: "",
};

type CompanyProfileSectionProps = {
  canEditCompany: boolean;
};

export function CompanyProfileSection({
  canEditCompany,
}: CompanyProfileSectionProps) {
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
    if (company?.canEdit && !form) {
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
  // Members get a read-only card instead of the form — only the admin who created the
  // company can change its details.
  const canEdit = company?.canEdit ?? false;
  const isPreparingEditor = Boolean(company?.canEdit && !form);

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
      {isLoading || isPreparingEditor ? (
        <CompanyProfileSkeleton
          label={t("loading")}
          variant={canEditCompany ? "admin" : "member"}
        />
      ) : null}

      {loadError && (
        <p className="text-danger-red text-sm leading-[1.4]">
          {loadError.message}
        </p>
      )}
      {company && !canEdit && <CompanyProfileView company={company} />}

      {company && canEdit && form ? (
        <CompanyProfileEditor
          company={company}
          error={error}
          isLogoUpdating={updateLogo.isPending}
          isSaving={updateCompany.isPending}
          message={message}
          onFieldChange={setField}
          onLogoUploaded={async (logoFileId) => {
            await updateLogo.mutateAsync({ logoFileId });
          }}
          onSave={handleSave}
          values={values}
        />
      ) : null}
    </ClosableSection>
  );
}
