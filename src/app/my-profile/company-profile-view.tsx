"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { UsersIcon } from "~/app/_components/icons";
import { ImageUploader } from "~/app/_components/image-uploader";
import { Input } from "~/app/_components/input";
import { LoadingButtonContent } from "~/app/_components/motion-system";
import { Textarea } from "~/app/_components/textarea";
import type { UpdateCompanyInput } from "~/schemas/company";
import type { RouterOutputs } from "~/types/trpc/router-outputs";

type Company = RouterOutputs["company"]["get"];

type CompanyProfileViewProps = {
  company: Company;
};

type CompanyProfileEditorProps = {
  company: Company;
  error: string | null;
  isLogoUpdating: boolean;
  isSaving: boolean;
  message: string | null;
  onFieldChange: (field: keyof UpdateCompanyInput, value: string) => void;
  onLogoUploaded: (logoFileId: string) => Promise<void>;
  onSave: () => void;
  values: UpdateCompanyInput;
};

type CompanyProfileSkeletonProps = {
  label: string;
  variant: "admin" | "member";
};

const SKELETON_DETAILS = [
  {
    className: "border-border-light border-b sm:border-r",
    id: "city",
  },
  { className: "border-border-light border-b", id: "country" },
  {
    className: "border-border-light border-b sm:border-r sm:border-b-0",
    id: "website",
  },
  { className: "", id: "phone" },
] as const;

function DetailTile({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div className={`min-w-0 px-4 py-4 sm:px-5 ${className ?? ""}`}>
      <p className="font-semibold text-[11px] text-text-secondary uppercase leading-4 tracking-[0.06em]">
        {label}
      </p>
      <div className="mt-1.5 break-words font-semibold text-sm text-text-heading leading-5">
        {children}
      </div>
    </div>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return <span className={`block rounded-lg bg-border-light ${className}`} />;
}

function EditorInputField({
  disabled,
  field,
  label,
  onFieldChange,
  placeholder,
  type,
  value,
}: {
  disabled: boolean;
  field: keyof UpdateCompanyInput;
  label: string;
  onFieldChange: (field: keyof UpdateCompanyInput, value: string) => void;
  placeholder: string;
  type?: "tel" | "url";
  value: string;
}) {
  return (
    <>
      <p className="font-semibold text-[11px] text-text-secondary uppercase leading-4 tracking-[0.06em]">
        {label}
      </p>
      <Input
        className="mt-2 bg-bg-light/70"
        disabled={disabled}
        hideLabel
        id={`company-${field}`}
        label={label}
        onChange={(event) => onFieldChange(field, event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </>
  );
}

function CompanyProfileMemberSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-light bg-bg-input">
      <div className="flex items-center gap-4 p-4 sm:p-5">
        <SkeletonBlock className="h-[72px] w-[72px] shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <SkeletonBlock className="h-6 w-2/3 max-w-64" />
          <SkeletonBlock className="h-4 w-1/2 max-w-44" />
          <SkeletonBlock className="h-3.5 w-28" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2">
        {SKELETON_DETAILS.map((detail) => (
          <div
            className={`px-4 py-4 sm:px-5 ${detail.className}`}
            key={detail.id}
          >
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="mt-2 h-4 w-3/4" />
          </div>
        ))}
      </div>

      <div className="space-y-2.5 border-border-light border-t px-4 py-5 sm:px-5">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-3.5 w-full" />
        <SkeletonBlock className="h-3.5 w-5/6" />
      </div>
    </div>
  );
}

function CompanyProfileAdminSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-light bg-bg-input">
      <div className="flex items-start gap-4 border-border-light border-b p-4 sm:p-5">
        <SkeletonBlock className="h-[72px] w-[72px] shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-6 w-24 rounded-full" />
          </div>
          <span className="mt-2.5 block h-11 rounded-xl border border-border-light bg-bg-light/70" />
          <SkeletonBlock className="mt-2.5 h-3 w-3/5 max-w-64" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2">
        {SKELETON_DETAILS.map((detail) => (
          <div
            className={`px-4 py-4 sm:px-5 ${detail.className}`}
            key={detail.id}
          >
            <SkeletonBlock className="h-3 w-16" />
            <span className="mt-2 block h-11 rounded-xl border border-border-light bg-bg-light/70" />
          </div>
        ))}
      </div>

      <div className="border-border-light border-t px-4 py-5 sm:px-5">
        <SkeletonBlock className="h-3 w-24" />
        <span className="mt-2 block h-24 rounded-xl border border-border-light bg-bg-light/70" />
      </div>

      <div className="flex flex-col gap-3 border-border-light border-t bg-bg-hover/45 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <SkeletonBlock className="h-3.5 w-3/5 max-w-72" />
        <SkeletonBlock className="h-10 w-full rounded-xl sm:w-36" />
      </div>
    </div>
  );
}

export function CompanyProfileSkeleton({
  label,
  variant,
}: CompanyProfileSkeletonProps) {
  return (
    <div aria-live="polite" role="status">
      <span className="sr-only">{label}</span>

      <div
        aria-hidden="true"
        className="animate-pulse motion-reduce:animate-none"
      >
        {variant === "admin" ? (
          <CompanyProfileAdminSkeleton />
        ) : (
          <CompanyProfileMemberSkeleton />
        )}
      </div>
    </div>
  );
}

export function CompanyProfileEditor({
  company,
  error,
  isLogoUpdating,
  isSaving,
  message,
  onFieldChange,
  onLogoUploaded,
  onSave,
  values,
}: CompanyProfileEditorProps) {
  const t = useTranslations("Company");
  const common = useTranslations("Common");
  const statusMessage = error ?? message ?? t("adminEditHint");
  const statusClassName = error
    ? "text-danger-red"
    : message
      ? "text-success-green"
      : "text-text-secondary";

  return (
    <div className="overflow-hidden rounded-2xl border border-border-light bg-bg-input">
      <div className="flex items-start gap-4 border-border-light border-b p-4 sm:p-5">
        <ImageUploader
          avatarShape="rounded"
          disabled={isLogoUpdating}
          initialImageUrl={company.logoUrl}
          onUploaded={onLogoUploaded}
          variant="avatar"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-[11px] text-text-secondary uppercase leading-4 tracking-[0.06em]">
              {t("name")}
            </p>
          </div>
          <Input
            className="mt-2 bg-bg-light/70"
            disabled={isSaving}
            hideLabel
            id="company-name"
            inputClassName="font-bold text-base"
            label={t("name")}
            onChange={(event) => onFieldChange("name", event.target.value)}
            placeholder={t("namePlaceholder")}
            value={values.name}
          />{" "}
        </div>
      </div>

      <div className="grid sm:grid-cols-2">
        <div className="border-border-light border-b px-4 py-4 sm:border-r sm:px-5">
          <EditorInputField
            disabled={isSaving}
            field="city"
            label={t("city")}
            onFieldChange={onFieldChange}
            placeholder={t("cityPlaceholder")}
            value={values.city}
          />
        </div>
        <div className="border-border-light border-b px-4 py-4 sm:px-5">
          <EditorInputField
            disabled={isSaving}
            field="country"
            label={t("country")}
            onFieldChange={onFieldChange}
            placeholder={t("countryPlaceholder")}
            value={values.country}
          />
        </div>
        <div className="border-border-light border-b px-4 py-4 sm:border-r sm:border-b-0 sm:px-5">
          <EditorInputField
            disabled={isSaving}
            field="website"
            label={t("website")}
            onFieldChange={onFieldChange}
            placeholder={t("websitePlaceholder")}
            type="url"
            value={values.website}
          />
        </div>
        <div className="px-4 py-4 sm:px-5">
          <EditorInputField
            disabled={isSaving}
            field="phone"
            label={t("phone")}
            onFieldChange={onFieldChange}
            placeholder={t("phonePlaceholder")}
            type="tel"
            value={values.phone}
          />
        </div>
      </div>

      <div className="border-border-light border-t px-4 py-5 sm:px-5">
        <p className="font-semibold text-[11px] text-text-secondary uppercase leading-4 tracking-[0.06em]">
          {t("description")}
        </p>
        <Textarea
          className="mt-2 bg-bg-light/70"
          disabled={isSaving}
          hideLabel
          id="company-description"
          label={t("description")}
          onChange={(event) => onFieldChange("description", event.target.value)}
          placeholder={t("descriptionPlaceholder")}
          value={values.description}
        />
      </div>

      <div className="flex flex-col gap-3 border-border-light border-t bg-bg-hover/45 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p
          aria-live="polite"
          className={`min-w-0 text-xs leading-5 ${statusClassName}`}
        >
          {statusMessage}
        </p>
        <button
          className="ui-button ui-button-primary w-full shrink-0 sm:w-auto"
          disabled={isSaving || values.name.trim().length === 0}
          onClick={onSave}
          type="button"
        >
          <LoadingButtonContent
            isLoading={isSaving}
            label={common("saveChanges")}
            loadingLabel={common("saving")}
          />
        </button>
      </div>
    </div>
  );
}

/**
 * Read-only company card shown to members.
 *
 * Deliberately not a disabled form: members never edit these fields, so they get a compact
 * profile card instead of greyed-out inputs.
 */
export function CompanyProfileView({ company }: CompanyProfileViewProps) {
  const t = useTranslations("Company");
  const common = useTranslations("Common");

  const location = [company.city, company.country].filter(Boolean).join(", ");
  const companyInitial =
    Array.from(company.name.trim())[0]?.toLocaleUpperCase() ?? "—";
  const websiteLabel = company.website
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const notSpecified = (
    <span className="font-normal text-text-placeholder">
      {common("notSpecified")}
    </span>
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border-light bg-bg-input">
      <div className="flex flex-col gap-4 bg-bg-input p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-4">
          {company.logoUrl ? (
            <Image
              alt={company.name}
              className="h-[72px] w-[72px] shrink-0 rounded-2xl border border-border-light bg-bg-light object-cover shadow-[0_3px_12px_rgba(28,28,30,0.06)]"
              height={72}
              src={company.logoUrl}
              unoptimized
              width={72}
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl bg-bg-active-menu font-bold text-2xl text-primary-blue"
            >
              {companyInitial}
            </span>
          )}

          <div className="min-w-0">
            <h3 className="break-words font-bold text-[21px] text-text-heading leading-7 tracking-[-0.02em]">
              {company.name}
            </h3>

            {location ? (
              <p className="mt-1 text-sm text-text-secondary leading-5">
                {location}
              </p>
            ) : null}

            <p className="mt-1.5 flex items-center gap-1.5 text-text-secondary text-xs leading-4">
              <UsersIcon aria-hidden="true" className="h-3.5 w-3.5" />
              {t("members", { count: company.memberCount })}
            </p>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2">
        <DetailTile
          className="border-border-light border-b sm:border-r"
          label={t("city")}
        >
          {company.city || notSpecified}
        </DetailTile>
        <DetailTile
          className="border-border-light border-b"
          label={t("country")}
        >
          {company.country || notSpecified}
        </DetailTile>
        <DetailTile
          className="border-border-light border-b sm:border-r sm:border-b-0"
          label={t("website")}
        >
          {company.website ? (
            <a
              className="break-all text-primary-blue underline decoration-primary-blue/25 underline-offset-4 hover:text-primary-blue-hover hover:decoration-primary-blue-hover"
              href={company.website}
              rel="noopener noreferrer"
              target="_blank"
            >
              {websiteLabel}
            </a>
          ) : (
            notSpecified
          )}
        </DetailTile>
        <DetailTile label={t("phone")}>
          {company.phone ? (
            <a
              className="text-primary-blue underline decoration-primary-blue/25 underline-offset-4 hover:text-primary-blue-hover hover:decoration-primary-blue-hover"
              href={`tel:${company.phone.replace(/\s/g, "")}`}
            >
              {company.phone}
            </a>
          ) : (
            notSpecified
          )}
        </DetailTile>
      </div>

      <div className="border-border-light border-t px-4 py-5 sm:px-5">
        <p className="font-semibold text-[11px] text-text-secondary uppercase leading-4 tracking-[0.06em]">
          {t("description")}
        </p>
        {company.description ? (
          <p className="mt-2 whitespace-pre-line text-sm text-text-heading leading-6">
            {company.description}
          </p>
        ) : (
          <p className="mt-2 text-sm text-text-placeholder leading-6">
            {common("notSpecified")}
          </p>
        )}
      </div>
    </div>
  );
}
