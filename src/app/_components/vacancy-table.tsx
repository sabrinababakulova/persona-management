"use client";

import Image from "next/image";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { RouterOutputs } from "~/types/trpc/router-outputs";

type Vacancy = RouterOutputs["vacancies"]["list"]["items"][number];
type DashboardVacancy =
  RouterOutputs["dashboard"]["getDashboardData"]["recentVacancies"][number];
type VacancyTableItem = Vacancy | DashboardVacancy;

import { Checkbox } from "./checkbox";
import { ChevronDownIcon, FunnelIcon, MoreIcon, SortIcon } from "./icons";
import { LoadingState, motion } from "./motion-system";

type VacancyStatus = Vacancy["status"];

const VACANCY_CONNECTION_ICONS = {
  tg: { src: "/telegram.svg", label: "Telegram" },
  hh: { src: "/hh.svg", label: "hh.uz" },
  ln: { src: "/linkedin.svg", label: "LinkedIn" },
  ph: { src: "/person-hunter.svg", label: "PersonHunters" },
};

const vacancyStatusTone: Record<
  VacancyStatus,
  {
    containerClassName: string;
    textClassName: string;
  }
> = {
  active: {
    containerClassName: "bg-status-active-soft",
    textClassName: "text-status-active-strong",
  },
  draft: {
    containerClassName: "bg-status-draft-soft",
    textClassName: "text-text-placeholder",
  },
  paused: {
    containerClassName: "bg-status-neutral-bg",
    textClassName: "text-status-neutral",
  },
  closed: {
    containerClassName: "bg-status-danger-soft",
    textClassName: "text-accent-red",
  },
  archive: {
    containerClassName: "border border-status-outline-border bg-bg-light",
    textClassName: "text-text-placeholder",
  },
};

const getVacancyConnectionIconsMeta = (vacancy: VacancyTableItem) => {
  const connections = [];

  if (vacancy.hhVacancyId) {
    connections.push("hh");
  }

  if (vacancy.personHunterVacancyId) {
    connections.push("ph");
  }

  if (vacancy.telegramPostId) {
    connections.push("tg");
  }
  return connections;
};

interface VacancyTableProps {
  items: VacancyTableItem[];
  title?: ReactNode;
  headerAction?: ReactNode;
  isLoading?: boolean;
  loadingLabel?: string;
  emptyState?: ReactNode;
  pagination?: ReactNode;
  vacancyStatusOptions: Array<{ value: string; label: string }>;
  onToggleSelection?: (id: string) => void;
  onStatusChange?: (vacancyId: string, nextStatus: string) => void;
  isStatusPending?: (vacancy: VacancyTableItem) => boolean;
  getDetailPath?: (vacancy: VacancyTableItem) => string;
  getFunnelPath?: (vacancy: VacancyTableItem) => string;
  stripedRows?: boolean;
  containerClassName?: string;
  titleBarClassName?: string;
  columnHeaderClassName?: string;
  bodyClassName?: string;
  rowClassName?: string;
}

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getVacancyStatusLabel(
  status: VacancyStatus,
  statusOptions: Array<{ value: string; label: string }>,
) {
  return (
    statusOptions.find((option) => option.value === status)?.label ?? status
  );
}

function toVacancyDetailPath(vacancy: VacancyTableItem) {
  return `/vacancies/${vacancy.id}`;
}

function toVacancyFunnelPath(vacancy: VacancyTableItem) {
  return `/vacancies/${vacancy.id}/funnel`;
}

function MobileMeta({ item }: { item: VacancyTableItem }) {
  const t = useTranslations("Vacancies");

  return (
    <>
      <span>
        {t("region")}: {item.areaId || "-"}
      </span>
      <span>
        {t("responses")}: {item.responses}
      </span>
      <span>
        {t("employment")}: {item.employmentId || "-"}
      </span>
    </>
  );
}

export function VacancyTable({
  items,
  title,
  headerAction,
  isLoading = false,
  loadingLabel,
  emptyState,
  pagination,
  vacancyStatusOptions,
  onToggleSelection,
  onStatusChange,
  isStatusPending,
  getDetailPath = toVacancyDetailPath,
  getFunnelPath = toVacancyFunnelPath,
  stripedRows = false,
  containerClassName,
  titleBarClassName,
  columnHeaderClassName,
  bodyClassName,
  rowClassName,
}: VacancyTableProps) {
  const t = useTranslations("Vacancies");
  const common = useTranslations("Common");
  const format = useFormatter();
  const showTitleBar = Boolean(title) || Boolean(headerAction);
  const resolvedLoadingLabel = loadingLabel ?? t("loading");

  return (
    <div
      className={cn(
        "surface-card flex min-h-0 flex-1 flex-col overflow-hidden",
        containerClassName,
      )}
    >
      {showTitleBar && (
        <div
          className={cn(
            "flex items-center justify-between border-border-input border-b px-5 py-4",
            titleBarClassName,
          )}
        >
          <div className="font-semibold text-lg text-text-heading">{title}</div>
          {headerAction}
        </div>
      )}

      <div
        className={cn(
          "hidden grid-cols-12 border-border-input border-b bg-bg-input px-4 py-3 lg:grid",
          columnHeaderClassName,
        )}
      >
        <div className="col-span-3 flex items-center gap-1 font-semibold text-text-muted text-xs">
          <span>{common("name")}</span>
          <SortIcon className="h-4 w-4" />
        </div>
        <div className="col-span-2 flex items-center gap-1 font-semibold text-text-muted text-xs">
          <span>{common("status")}</span>
          <SortIcon className="h-4 w-4" />
        </div>
        <div className="col-span-2 flex items-center gap-1 font-semibold text-text-muted text-xs">
          <span>{t("region")}</span>
          <SortIcon className="h-4 w-4" />
        </div>
        <div className="col-span-1 flex items-center gap-1 font-semibold text-text-muted text-xs">
          <span>{t("responses")}</span>
          <SortIcon className="h-4 w-4" />
        </div>
        <div className="col-span-2 flex items-center gap-1 font-semibold text-text-muted text-xs">
          <span>{t("employment")}</span>
          <SortIcon className="h-4 w-4" />
        </div>
        <div className="col-span-1 flex items-center gap-1 font-semibold text-text-muted text-xs">
          <span>{t("links")}</span>
        </div>
        <div className="col-span-1" />
      </div>

      {isLoading ? (
        <LoadingState
          className="min-h-0 flex-1 px-4 py-10 text-text-placeholder"
          label={resolvedLoadingLabel}
        />
      ) : (
        <>
          <div className={cn("min-h-0 flex-1 overflow-auto", bodyClassName)}>
            {items.map((item, index) =>
              (() => {
                const statusTone =
                  vacancyStatusTone[item.status] ?? vacancyStatusTone.active;
                const connections = getVacancyConnectionIconsMeta(item);
                const isHhVacancy = item.source === "hh.uz";
                const publishedDate = item.publishedAt
                  ? new Date(item.publishedAt)
                  : null;
                const publishedAtLabel =
                  publishedDate && !Number.isNaN(publishedDate.getTime())
                    ? format.dateTime(publishedDate, {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : null;
                const statusPending = isStatusPending?.(item) ?? false;

                return (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "grid grid-cols-12 items-start border-border-input border-b px-4 py-3.5 last:border-b-0 lg:items-center",
                      stripedRows &&
                        (index % 2 === 0 ? "bg-bg-light" : "bg-bg-input"),
                      rowClassName,
                    )}
                    initial={{ opacity: 0, y: 7 }}
                    key={item.id}
                    layout
                    transition={{
                      delay: Math.min(index * 0.025, 0.18),
                      duration: 0.24,
                    }}
                  >
                    <div className="col-span-12 flex items-start gap-2.5 lg:col-span-3">
                      {onToggleSelection && (
                        <Checkbox
                          //TODO: fix it when selection will be implemented
                          checked={false}
                          onChange={() => onToggleSelection(item.id)}
                        />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            className="block max-w-[220px] truncate font-semibold text-sm text-text-heading leading-5 hover:text-primary-blue lg:max-w-[180px]"
                            href={getDetailPath(item)}
                            title={item.title}
                          >
                            {item.title}
                          </Link>
                        </div>
                        {item.experienceId && (
                          <div className="mt-1 truncate text-text-placeholder text-xs leading-none">
                            {item.experienceId}
                          </div>
                        )}
                        {publishedAtLabel && (
                          <div className="mt-1 truncate text-text-placeholder text-xs leading-none">
                            {t("published")} {publishedAtLabel}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="col-span-6 mt-3 lg:col-span-2 lg:mt-0">
                      {isHhVacancy || !onStatusChange ? (
                        <span
                          className={`inline-flex min-h-8 min-w-28 items-center rounded-md px-3 font-semibold text-xs uppercase leading-none ${statusTone.containerClassName} ${statusTone.textClassName}`}
                        >
                          {getVacancyStatusLabel(
                            item.status,
                            vacancyStatusOptions,
                          )}
                        </span>
                      ) : (
                        <div
                          className={`${statusTone.containerClassName} relative inline-flex min-w-28 items-center overflow-hidden rounded-md px-1`}
                        >
                          <select
                            aria-label={t("statusFor", {
                              title: item.title,
                            })}
                            className={`h-8 w-full ${statusTone.textClassName} appearance-none bg-transparent px-2 pr-6 font-semibold text-xs uppercase leading-none disabled:cursor-not-allowed disabled:opacity-70`}
                            disabled={statusPending}
                            onChange={(event) => {
                              onStatusChange(item.id, event.target.value);
                            }}
                            value={item.status}
                          >
                            {vacancyStatusOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDownIcon
                            className={`pointer-events-none absolute right-2 h-3.5 w-3.5 ${statusTone.textClassName}`}
                          />
                        </div>
                      )}
                    </div>

                    <div className="hidden text-sm text-text-heading leading-none lg:col-span-2 lg:block">
                      {item.areaId || "-"}
                    </div>

                    <div className="hidden text-sm text-text-heading leading-none lg:col-span-1 lg:block">
                      {item.responses}
                    </div>

                    <div className="hidden text-sm text-text-heading leading-none lg:col-span-2 lg:block">
                      {item.employmentId || "-"}
                    </div>

                    <div className="hidden lg:col-span-1 lg:flex lg:items-center lg:gap-1.5">
                      {connections.length === 0 ? (
                        <span className="text-sm text-text-heading leading-none">
                          -
                        </span>
                      ) : (
                        connections.map((connection) => {
                          const meta =
                            VACANCY_CONNECTION_ICONS[
                              connection as keyof typeof VACANCY_CONNECTION_ICONS
                            ];
                          return (
                            <Image
                              alt={meta.label}
                              className="h-4 w-4"
                              height={16}
                              key={connection}
                              src={meta.src}
                              title={meta.label}
                              unoptimized
                              width={16}
                            />
                          );
                        })
                      )}
                    </div>

                    <div className="col-span-6 mt-3 flex items-center justify-end gap-3 lg:col-span-1 lg:mt-0">
                      <Link
                        className="flex items-center gap-1 font-medium text-primary-blue text-sm leading-none hover:text-primary-blue-hover"
                        href={getFunnelPath(item)}
                      >
                        <FunnelIcon className="h-3.5 w-3.5" />
                        <span className="hidden xl:inline">{t("funnel")}</span>
                      </Link>
                      <button
                        className="p-1 text-text-placeholder transition-colors hover:text-text-secondary"
                        type="button"
                      >
                        <MoreIcon className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="col-span-12 mt-3 flex flex-wrap gap-4 text-text-placeholder text-xs lg:hidden">
                      <MobileMeta item={item} />
                    </div>
                  </motion.div>
                );
              })(),
            )}

            {items.length === 0 &&
              (emptyState ?? (
                <div className="px-4 py-10 text-center text-sm text-text-placeholder">
                  {t("empty")}
                </div>
              ))}
          </div>

          {pagination}
        </>
      )}
    </div>
  );
}
