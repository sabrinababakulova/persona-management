"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  AIGenerationIcon,
  BriefcaseIcon,
  GlobeIcon,
  MailIcon,
  VacancyResponsesIcon,
} from "~/app/_components/icons";

type CandidateSummaryCardProps = {
  fullName: string;
  city: string;
  experience?: string;
  matchScore: number;
  salaryExpectation?: number;
  salaryCurrency: string;
  aiAnalysis?: string;
  tags: string[];
  currentPosition?: string;
  languages: { name: string; level: string }[];
  skills: string[];
  contacts: {
    phone?: string;
    telegram?: string;
    email?: string;
  };
  relatedVacancies: { id: string; title: string }[];
};

type DetailSectionProps = {
  title: string;
  icon: ReactNode;
  values: string[];
  emptyState?: string;
  valueClassName?: string;
};

type CurrentPositionSectionProps = {
  currentPosition?: string;
  emptyState: string;
  title: string;
};

function DotSeparator() {
  return <span className="text-text-disabled">|</span>;
}

function compactValues(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function DetailSection({
  title,
  icon,
  values,
  emptyState,
  valueClassName,
}: DetailSectionProps) {
  const visibleValues = compactValues(values);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 text-text-placeholder">
        <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
        <p className="font-medium text-base leading-none">{title}</p>
      </div>

      <div
        className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-base leading-[1.3] ${valueClassName ?? "text-text-heading"}`}
      >
        {visibleValues.length > 0 ? (
          visibleValues.map((value, index) => (
            <div className="flex items-center gap-2" key={`${title}-${value}`}>
              {index > 0 ? <DotSeparator /> : null}
              <span>{value}</span>
            </div>
          ))
        ) : (
          <span className="text-text-placeholder">{emptyState}</span>
        )}
      </div>
    </div>
  );
}

function CurrentPositionSection({
  currentPosition,
  emptyState,
  title,
}: CurrentPositionSectionProps) {
  const positionTokens = compactValues(
    (currentPosition ?? "").split("|").map((token) => token.trim()),
  );

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 text-text-placeholder">
        <span className="flex h-4 w-4 items-center justify-center">
          <BriefcaseIcon className="h-4 w-4" />
        </span>
        <p className="font-medium text-base leading-none">{title}</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-text-heading leading-[1.3]">
        {positionTokens.length > 0 ? (
          positionTokens.map((token, index) => (
            <div className="flex items-center gap-2" key={token}>
              {index > 0 ? <DotSeparator /> : null}
              <span>{token}</span>
            </div>
          ))
        ) : (
          <span className="text-text-placeholder">{emptyState}</span>
        )}
      </div>
    </div>
  );
}

export function CandidateSummaryCard({
  fullName,
  city,
  experience,
  matchScore,
  salaryExpectation,
  salaryCurrency,
  aiAnalysis,
  tags,
  currentPosition,
  languages,
  skills,
  contacts,
  relatedVacancies,
}: CandidateSummaryCardProps) {
  const format = useFormatter();
  const t = useTranslations("CandidateDetail");
  const subtitleTokens = compactValues([city.toUpperCase(), experience ?? ""]);
  const summaryText = aiAnalysis?.trim() || t("aiUnavailable");
  const formattedSalary = salaryExpectation
    ? `${salaryCurrency === "USD" ? "$" : ""}${format.number(salaryExpectation)}${
        salaryCurrency === "USD" ? "" : ` ${salaryCurrency || "UZS"}`
      }`
    : t("notSpecified");
  const skillTokens = compactValues([
    ...languages
      .slice(0, 1)
      .map((language) =>
        language.level ? `${language.name} ${language.level}` : language.name,
      ),
    ...skills.slice(0, 2),
  ]);
  const contactTokens = compactValues([
    contacts.phone ?? "",
    contacts.telegram ?? "",
    contacts.email ?? "",
  ]);

  return (
    <aside className="surface-card p-5">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold text-2xl text-text-heading leading-tight tracking-tight">
            {fullName}
          </h2>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {subtitleTokens.map((token, index) => (
              <div className="flex items-center gap-2" key={token}>
                {index > 0 ? <DotSeparator /> : null}
                <p className="font-semibold text-text-placeholder text-xs uppercase leading-5">
                  {token}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex w-full items-center gap-3 rounded-lg bg-bg-input px-3 py-3">
            <div className="flex min-w-0 flex-col gap-1.75">
              <p className="font-bold text-text-heading text-xl uppercase leading-none tracking-tight">
                {matchScore}%
              </p>
              <p className="mt-1 text-text-placeholder text-xs leading-none">
                {t("match")}
              </p>
            </div>

            <div className="h-12 w-px shrink-0 bg-border-input" />

            <div className="min-w-0 flex-1">
              <p className="font-bold text-text-heading text-xl leading-none tracking-tight">
                {formattedSalary}
              </p>
              <p className="mt-1.5 text-text-placeholder text-xs leading-none">
                {t("salaryExpectation")}
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-chart-purple/10 p-3 text-chart-purple">
            <div className="mb-2.25 flex items-center gap-1.5">
              <div className="flex items-center gap-1">
                <AIGenerationIcon className="h-4 w-4" />
                <span className="font-bold text-sm leading-none">AI</span>
              </div>
              <span className="font-semibold text-sm leading-none">
                {t("aiSummary")}
              </span>
            </div>

            <p className="text-sm leading-5">{summaryText}</p>
          </div>

          {tags.length > 0 ? (
            <div className="flex flex-wrap items-start gap-1.5">
              {tags.map((tag) => (
                <div
                  className="rounded-md bg-danger-red-bg px-2 py-2"
                  key={tag}
                >
                  <p className="font-semibold text-accent-red text-xs uppercase leading-none line-through">
                    {tag}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-5">
          <CurrentPositionSection
            currentPosition={currentPosition}
            emptyState={t("notSpecified")}
            title={t("currentPosition")}
          />

          <DetailSection
            emptyState={t("skillsAndLanguagesEmpty")}
            icon={<GlobeIcon className="h-4 w-4 text-text-placeholder" />}
            title={t("skillsAndLanguages")}
            values={skillTokens}
          />

          <DetailSection
            emptyState={t("contactsEmpty")}
            icon={<MailIcon className="h-4 w-4" />}
            title={t("contacts")}
            values={contactTokens}
          />

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-text-placeholder">
              <span className="flex h-4 w-4 items-center justify-center">
                <VacancyResponsesIcon className="h-4 w-4" />
              </span>
              <p className="font-semibold text-sm leading-none">
                {t("vacancyApplications")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-primary-blue text-sm leading-5">
              {relatedVacancies.length > 0 ? (
                relatedVacancies.map((vacancy, index) => (
                  <div
                    className="flex items-center gap-2"
                    key={`${vacancy.id}-${vacancy.title}`}
                  >
                    {index > 0 ? <DotSeparator /> : null}
                    <Link
                      className="transition-colors hover:text-primary-blue-hover"
                      href={`/vacancies/${vacancy.id}`}
                    >
                      {vacancy.title}
                    </Link>
                  </div>
                ))
              ) : (
                <span className="text-text-placeholder">
                  {t("vacancyApplicationsEmpty")}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
