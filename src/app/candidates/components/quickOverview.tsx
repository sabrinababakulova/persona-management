"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import {
  AIGenerationIcon,
  BriefcaseIcon,
  DollarIcon,
  DownloadIcon,
  MailIcon,
} from "~/app/_components/icons";
import {
  AnimatePresence,
  LoadingState,
  motion,
} from "~/app/_components/motion-system";
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
  const dialogPanelRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  const { data: candidate, isLoading } = api.candidates.get.useQuery(
    { id: candidateId ?? "" },
    {
      enabled: isOpen && Boolean(candidateId),
      retry: false,
    },
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousActiveElementRef.current =
      document.activeElement as HTMLElement | null;
    dialogPanelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const panel = dialogPanelRef.current;
      if (!panel) {
        return;
      }

      const focusableSelectors = [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ];

      const focusableElements = Array.from(
        panel.querySelectorAll<HTMLElement>(focusableSelectors.join(",")),
      ).filter((element) => !element.hasAttribute("disabled"));

      if (focusableElements.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousActiveElementRef.current?.focus();
    };
  }, [isOpen, onClose]);

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
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          animate={{ opacity: 1 }}
          aria-describedby="candidate-quick-overview-description"
          aria-labelledby="candidate-quick-overview-title"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center p-5"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          role="dialog"
        >
          <motion.button
            animate={{ opacity: 1 }}
            aria-label={t("quickClose")}
            className="absolute inset-0 bg-text-heading/20"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={onClose}
            type="button"
          />

          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative flex w-full max-w-[500px] flex-col gap-6 overflow-hidden rounded-xl border border-border-input bg-bg-light p-4 text-text-heading shadow-toast"
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            initial={{ opacity: 0, scale: 0.965, y: 18 }}
            ref={dialogPanelRef}
            tabIndex={-1}
          >
            {isLoading || !candidate ? (
              isLoading ? (
                <LoadingState
                  className="min-h-[180px] text-text-placeholder"
                  label={t("quickLoading")}
                />
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
                  <div className="flex flex-col gap-2">
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
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
