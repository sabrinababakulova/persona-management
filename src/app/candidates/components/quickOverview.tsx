"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useMemo } from "react";
import {
  AIGenerationIcon,
  BriefcaseIcon,
  DollarIcon,
  DownloadIcon,
  MailIcon,
} from "~/app/_components/icons";
import { Modal } from "~/app/_components/modal";
import { SkeletonBlock } from "~/app/_components/page-skeleton";
import { api } from "~/trpc/react";
import type {
  QuickOverviewProps,
  SectionTitleProps,
} from "~/types/candidates/quick-overview";

function DotSeparator() {
  return <span className="text-text-placeholder">|</span>;
}

function SectionTitle({ icon, title }: SectionTitleProps) {
  return (
    <div className="flex items-center gap-1.5 text-text-placeholder">
      {icon}
      <p className="font-medium text-xs leading-none">{title}</p>
    </div>
  );
}

export function QuickOverview({
  candidateId,
  isOpen,
  onClose,
}: QuickOverviewProps) {
  const format = useFormatter();
  const t = useTranslations("CandidateDetail");

  const { data: candidate, isLoading } = api.candidates.get.useQuery(
    { id: candidateId ?? "" },
    {
      enabled: isOpen && Boolean(candidateId),
      retry: false,
    },
  );

  const aiSummaryText = useMemo(() => {
    if (!candidate) {
      return "";
    }

    return candidate.aiAnalysis.trim() || t("aiUnavailable");
  }, [candidate, t]);

  const positionAndSkillTokens = useMemo(() => {
    if (!candidate) {
      return [];
    }

    const tokens = [
      candidate.currentPosition,
      ...candidate.languages.slice(0, 1).map((l) => `${l.name} ${l.level}`),
      ...candidate.skills.slice(0, 2),
    ]
      .map((value) => value.trim())
      .filter(
        (value, index, arr) => value.length > 0 && arr.indexOf(value) === index,
      );

    return tokens;
  }, [candidate]);

  const contactTokens = useMemo(() => {
    if (!candidate) {
      return [];
    }

    return [
      candidate.contacts.phone,
      candidate.contacts.telegram,
      candidate.contacts.email,
    ]
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }, [candidate]);

  return (
    <Modal
      ariaDescribedBy={
        candidate ? "candidate-quick-overview-description" : undefined
      }
      ariaLabel={
        isLoading ? t("quickLoading") : (candidate?.name ?? t("quickNotFound"))
      }
      closeButtonLabel={t("quickClose")}
      contentClassName="gap-6"
      isOpen={isOpen}
      maxWidthClassName="max-w-[500px]"
      onClose={onClose}
      panelClassName="text-text-heading"
    >
      {isLoading || !candidate ? (
        isLoading ? (
          <div aria-busy="true" className="min-h-[180px] space-y-4">
            <SkeletonBlock className="h-8 w-3/4" />
            <SkeletonBlock className="h-4 w-full rounded-md" />
            <SkeletonBlock className="h-4 w-5/6 rounded-md" />
            <SkeletonBlock className="h-24 w-full" />
          </div>
        ) : (
          <p
            className="text-sm text-text-placeholder leading-[1.3]"
            id="candidate-quick-overview-description"
          >
            {t("quickNotFound")}
          </p>
        )
      ) : (
        <>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 pr-10">
              <div className="flex flex-wrap items-center gap-1.5 text-text-placeholder text-xs uppercase leading-[1.3]">
                {candidate.location && (
                  <p className="font-medium">{candidate.location}</p>
                )}
                {candidate.location && candidate.experience ? (
                  <DotSeparator />
                ) : null}
                {candidate.experience ? (
                  <p className="font-medium">{candidate.experience}</p>
                ) : null}
              </div>
              <h2
                className="font-semibold text-lg leading-[1.1]"
                id="candidate-quick-overview-title"
              >
                {candidate.name}
              </h2>
            </div>

            <div className="w-full rounded-md bg-chart-purple/10 p-2 text-chart-purple">
              <div className="mb-2 flex items-center gap-1.5">
                <AIGenerationIcon />
                <span className="font-bold text-xs leading-none">
                  AI {t("aiSummary")}
                </span>
              </div>
              <p
                className="whitespace-pre-wrap font-normal text-xs leading-[1.3]"
                id="candidate-quick-overview-description"
              >
                {aiSummaryText}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <SectionTitle
                icon={<BriefcaseIcon />}
                title={t("currentPositionAndSkills")}
              />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-[1.3]">
                {positionAndSkillTokens.length > 0 ? (
                  positionAndSkillTokens.map((token, index) => (
                    <div className="flex items-center gap-2" key={token}>
                      {index > 0 ? <DotSeparator /> : null}
                      <span>{token}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-text-placeholder">
                    {t("emptySection")}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <SectionTitle icon={<MailIcon />} title={t("contacts")} />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-[1.3]">
                {contactTokens.length > 0 ? (
                  contactTokens.map((token, index) => (
                    <div className="flex items-center gap-2" key={token}>
                      {index > 0 ? <DotSeparator /> : null}
                      <span>{token}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-text-placeholder">
                    {t("emptySection")}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <SectionTitle
                icon={<DollarIcon />}
                title={t("salaryExpectation")}
              />
              <p className="text-sm leading-[1.3]">
                {candidate.salaryExpectation > 0
                  ? `${candidate.salaryCurrency === "USD" ? "$" : ""}${format.number(candidate.salaryExpectation)}+`
                  : t("notSpecified")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-1.5">
            {candidate.tags.slice(0, 3).map((tag) => (
              <div className="rounded-lg bg-danger-red-bg p-2" key={tag}>
                <p className="font-semibold text-accent-red text-xs uppercase leading-none line-through">
                  {tag}
                </p>
              </div>
            ))}
          </div>

          <p className="w-full text-xs leading-[1.3]">
            {t("source")}{" "}
            <span className="text-primary-blue">
              {candidate.source || t("notSpecified")}
            </span>
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-text-placeholder">
              <DownloadIcon />
              <p className="font-medium text-base leading-none">CV</p>
            </div>

            <button
              className="ui-button ui-button-primary"
              disabled={!candidate.resumeFile.url}
              onClick={() => {
                if (candidate.resumeFile.url) {
                  window.open(
                    candidate.resumeFile.url,
                    "_blank",
                    "noopener,noreferrer",
                  );
                }
              }}
              type="button"
            >
              {t("quickCv")}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
