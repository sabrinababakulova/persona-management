"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  AIGenerationIcon,
  BriefcaseIcon,
  DollarIcon,
  DownloadIcon,
  MailIcon,
} from "~/app/_components/icons";
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
      <p className="font-medium text-[12px] leading-none tracking-[-0.24px]">
        {title}
      </p>
    </div>
  );
}

export function QuickOverview({
  candidateId,
  isOpen,
  onClose,
}: QuickOverviewProps) {
  const dialogPanelRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  const { data: candidate, isLoading } =
    api.candidates.getCandidateById.useQuery(
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

    return candidate.aiAnalysis.trim() || "AI-анализ пока недоступен";
  }, [candidate]);

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

  if (!isOpen) {
    return null;
  }

  return (
    <div
      aria-describedby="candidate-quick-overview-description"
      aria-labelledby="candidate-quick-overview-title"
      aria-modal="true"
      className="fixed inset-0 z-60 flex items-center justify-center p-5"
      role="dialog"
    >
      <button
        aria-label="Закрыть окно быстрого обзора кандидата"
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
        type="button"
      />

      <div
        className="relative flex w-full max-w-[500px] flex-col gap-6 overflow-hidden rounded-[8px] border border-border-input bg-white p-4 text-text-heading shadow-[6px_6px_26.2px_0px_rgba(43,48,66,0.10)]"
        ref={dialogPanelRef}
        tabIndex={-1}
      >
        {isLoading || !candidate ? (
          <p
            className="text-[14px] text-text-placeholder leading-[1.3] tracking-[-0.28px]"
            id="candidate-quick-overview-description"
          >
            {isLoading ? "Загрузка..." : "Данные кандидата не найдены"}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-[5px] text-[12px] text-text-placeholder uppercase leading-[1.3] tracking-[-0.24px]">
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
                  className="font-semibold text-[18px] leading-[1.1] tracking-[-0.36px]"
                  id="candidate-quick-overview-title"
                >
                  {candidate.name}
                </h2>
              </div>

              <div className="w-full rounded-[5px] bg-[rgba(151,71,255,0.07)] p-2 text-[#9747ff]">
                <div className="mb-[9px] flex items-center gap-1.5">
                  <AIGenerationIcon />
                  <span className="font-bold text-[12px] leading-none tracking-[-0.24px]">
                    AI сводка
                  </span>
                </div>
                <p
                  className="whitespace-pre-wrap font-normal text-[12px] leading-[1.3] tracking-[-0.24px]"
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
                  title="Текущая должность и навыки"
                />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] leading-[1.3] tracking-[-0.28px]">
                  {positionAndSkillTokens.length > 0 ? (
                    positionAndSkillTokens.map((token, index) => (
                      <div className="flex items-center gap-2" key={token}>
                        {index > 0 ? <DotSeparator /> : null}
                        <span>{token}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-text-placeholder">Нет данных</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <SectionTitle icon={<MailIcon />} title="Контакты" />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] leading-[1.3] tracking-[-0.28px]">
                  {contactTokens.length > 0 ? (
                    contactTokens.map((token, index) => (
                      <div className="flex items-center gap-2" key={token}>
                        {index > 0 ? <DotSeparator /> : null}
                        <span>{token}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-text-placeholder">Нет данных</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <SectionTitle
                  icon={<DollarIcon />}
                  title="Зарплатные ожидания"
                />
                <p className="text-[14px] leading-[1.3] tracking-[-0.28px]">
                  {candidate.salaryExpectation > 0
                    ? `${candidate.salaryCurrency === "USD" ? "$" : ""}${candidate.salaryExpectation}+`
                    : "Не указано"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-start gap-[6px]">
              {candidate.tags.slice(0, 3).map((tag) => (
                <div
                  className="rounded-[6px] bg-[rgba(242,51,115,0.1)] p-2"
                  key={tag}
                >
                  <p className="font-semibold text-[12px] text-accent-red uppercase leading-none tracking-[-0.24px] line-through">
                    {tag}
                  </p>
                </div>
              ))}
            </div>

            <p className="w-full text-[12px] leading-[1.3] tracking-[-0.24px]">
              Источник:{" "}
              <span className="text-primary-blue">
                {candidate.source || "Не указан"}
              </span>
            </p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-text-placeholder">
                <DownloadIcon />
                <p className="font-medium text-[16px] leading-none tracking-[-0.32px]">
                  CV
                </p>
              </div>

              <button
                className="h-11 w-[182px] rounded-[6px] bg-primary-blue px-3 py-2.5 font-medium text-[14px] text-white leading-none tracking-[-0.28px] transition-colors hover:bg-primary-blue-hover disabled:cursor-not-allowed disabled:bg-primary-blue/50"
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
                Быстрый просмотр CV
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
