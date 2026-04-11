"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AIGenerationIcon,
  BriefcaseIcon,
  GlobeIcon,
  type IconProps,
  MailIcon,
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
};

function DotSeparator() {
  return <span className="text-text-disabled">|</span>;
}

function VacancyResponsesIcon({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="16"
      viewBox="0 0 16 16"
      width="16"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M5.667 6.333a2.333 2.333 0 1 1 4.666 0 2.333 2.333 0 0 1-4.666 0Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
      <path
        d="M8 1.667v1.666M8 12.667v1.666M12.714 3.286l-1.178 1.178M4.464 11.536l-1.178 1.178M14.333 8h-1.666M3.333 8H1.667M12.714 12.714l-1.178-1.178M4.464 4.464 3.286 3.286"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}

function compactValues(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function formatSalary(
  salaryExpectation: number | undefined,
  salaryCurrency: string,
) {
  if (!salaryExpectation) {
    return "Не указано";
  }

  const formatted = new Intl.NumberFormat("ru-RU").format(salaryExpectation);
  return salaryCurrency === "USD" ? `$${formatted}` : `${formatted} UZS`;
}

function DetailSection({
  title,
  icon,
  values,
  emptyState = "Нет данных",
  valueClassName,
}: DetailSectionProps) {
  const visibleValues = compactValues(values);

  return (
    <div className="flex flex-col gap-[10px]">
      <div className="flex items-center gap-2 text-text-placeholder">
        <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
        <p className="font-medium text-[16px] leading-none tracking-[-0.32px]">
          {title}
        </p>
      </div>

      <div
        className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px] leading-[1.3] tracking-[-0.32px] ${valueClassName ?? "text-text-heading"}`}
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
}: CurrentPositionSectionProps) {
  const positionTokens = compactValues(
    (currentPosition ?? "").split("|").map((token) => token.trim()),
  );

  return (
    <div className="flex flex-col gap-[10px]">
      <div className="flex items-center gap-2 text-text-placeholder">
        <span className="flex h-4 w-4 items-center justify-center">
          <BriefcaseIcon className="h-4 w-4" />
        </span>
        <p className="font-medium text-[16px] leading-none tracking-[-0.32px]">
          Текущая должность
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px] text-text-heading leading-[1.3] tracking-[-0.32px]">
        {positionTokens.length > 0 ? (
          positionTokens.map((token, index) => (
            <div className="flex items-center gap-2" key={token}>
              {index > 0 ? <DotSeparator /> : null}
              <span>{token}</span>
            </div>
          ))
        ) : (
          <span className="text-text-placeholder">Не указано</span>
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
  const subtitleTokens = compactValues([city.toUpperCase(), experience ?? ""]);
  const summaryText =
    aiAnalysis?.trim() || "AI-анализ по кандидату пока недоступен.";
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
    <aside className="rounded-[8px] border border-border-input bg-white p-5">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold text-[24px] text-text-heading leading-[1.1] tracking-[-0.48px]">
            {fullName}
          </h2>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {subtitleTokens.map((token, index) => (
              <div className="flex items-center gap-2" key={token}>
                {index > 0 ? <DotSeparator /> : null}
                <p className="font-medium text-[16px] text-text-placeholder uppercase leading-[1.3] tracking-[-0.32px]">
                  {token}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex w-full items-center gap-[22px] rounded-[5px] bg-bg-input px-3 py-4">
            <div className="flex min-w-0 flex-col gap-[7px]">
              <p className="font-bold text-[41px] text-text-heading uppercase leading-none tracking-[-0.82px]">
                {matchScore}%
              </p>
              <p className="text-[16px] text-text-placeholder leading-none tracking-[-0.32px]">
                Соответствия
              </p>
            </div>

            <div className="h-12 w-px shrink-0 bg-border-input" />

            <div className="min-w-0 flex-1">
              <p className="font-bold text-[clamp(30px,5vw,41px)] text-text-heading leading-none tracking-[-0.82px]">
                {formatSalary(salaryExpectation, salaryCurrency)}
              </p>
              <p className="mt-[7px] text-[16px] text-text-placeholder leading-none tracking-[-0.32px]">
                Зарплатные ожидания
              </p>
            </div>
          </div>

          <div className="rounded-[5px] bg-[#9747ff]/7 p-3 text-[#9747ff]">
            <div className="mb-[9px] flex items-center gap-[6px]">
              <div className="flex items-center gap-1">
                <AIGenerationIcon className="h-4 w-4" />
                <span className="font-bold text-[14px] leading-none tracking-[-0.28px]">
                  AI
                </span>
              </div>
              <span className="font-semibold text-[14px] leading-none tracking-[-0.28px]">
                сводка
              </span>
            </div>

            <p className="text-[14px] leading-[1.3] tracking-[-0.28px]">
              {summaryText}
            </p>
          </div>

          {tags.length > 0 ? (
            <div className="flex flex-wrap items-start gap-[6px]">
              {tags.map((tag) => (
                <div
                  className="rounded-[6px] bg-[rgba(242,51,115,0.1)] px-2 py-2"
                  key={tag}
                >
                  <p className="font-semibold text-[14px] text-accent-red uppercase leading-none tracking-[-0.28px] line-through">
                    {tag}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-5">
          <CurrentPositionSection currentPosition={currentPosition} />

          <DetailSection
            emptyState="Навыки и языки не указаны"
            icon={<GlobeIcon className="h-4 w-4 text-text-placeholder" />}
            title="Навыки и языки"
            values={skillTokens}
          />

          <DetailSection
            emptyState="Контакты не указаны"
            icon={<MailIcon className="h-4 w-4" />}
            title="Контакты"
            values={contactTokens}
          />

          <div className="flex flex-col gap-[8px]">
            <div className="flex items-center gap-[6px] text-text-placeholder">
              <span className="flex h-4 w-4 items-center justify-center">
                <VacancyResponsesIcon className="h-4 w-4" />
              </span>
              <p className="font-medium text-[16px] leading-none tracking-[-0.32px]">
                Отклики на вакансии
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px] text-primary-blue leading-[1.3] tracking-[-0.32px]">
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
                  Отклики пока не добавлены
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
