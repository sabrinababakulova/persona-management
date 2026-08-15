"use client";

import Image from "next/image";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { RouterOutputs } from "~/types/trpc/router-outputs";
import {
  formatHhEmployment,
  formatHhExperience,
} from "~/utils/format-hh-experience";

type Vacancy = RouterOutputs["vacancies"]["list"]["items"][number];
type DashboardVacancy =
  RouterOutputs["dashboard"]["getDashboardData"]["recentVacancies"][number];
type VacancyTableItem = Vacancy | DashboardVacancy;

import { Checkbox } from "./checkbox";
import { ChevronDownIcon, MoreIcon, SortIcon } from "./icons";
import { motion } from "./motion-system";
import { TableRowsSkeleton } from "./page-skeleton";

type VacancyStatus = Vacancy["status"];

const VACANCY_CONNECTION_ICONS = {
  tg: { src: "/telegram.svg", label: "Telegram" },
  hh: { src: "/hh.svg", label: "hh.uz" },
  ln: { src: "/linkedin.svg", label: "LinkedIn" },
  ph: { src: "/person-hunter.svg", label: "PersonHunters" },
  olx: { src: "/olx.svg", label: "olx.uz" },
};

/** Publication `destination` values → platform chip keys. */
const DESTINATION_CONNECTION_KEYS: Record<
  string,
  keyof typeof VACANCY_CONNECTION_ICONS
> = {
  telegram: "tg",
  "hh.uz": "hh",
  linkedin: "ln",
  "person-hunter": "ph",
  "olx.uz": "olx",
};

const vacancyStatusTone: Record<
  VacancyStatus,
  {
    containerClassName: string;
  }
> = {
  active: {
    containerClassName: "bg-status-active-bg",
  },
  draft: {
    containerClassName: "bg-status-draft-bg",
  },
  paused: {
    containerClassName: "bg-status-paused-bg",
  },
  closed: {
    containerClassName: "bg-status-danger-soft",
  },
  archive: {
    containerClassName: "bg-status-archive-bg",
  },
};

const getVacancyConnectionIconsMeta = (vacancy: VacancyTableItem) => {
  const connections = new Set<keyof typeof VACANCY_CONNECTION_ICONS>();

  // Platform chips come from the vacancy's actual publications; the mirror
  // ids remain as a fallback for hh.uz-synced rows without local children.
  for (const channel of vacancy.publicationChannels ?? []) {
    const key = DESTINATION_CONNECTION_KEYS[channel];
    if (key) {
      connections.add(key);
    }
  }

  if (vacancy.hhVacancyId) {
    connections.add("hh");
  }

  if (vacancy.personHunterVacancyId) {
    connections.add("ph");
  }

  if (vacancy.telegramPostId) {
    connections.add("tg");
  }
  return [...connections];
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
  const common = useTranslations("Common");
  const connections = getVacancyConnectionIconsMeta(item);

  return (
    <>
      <div>
        <dt>{t("region")}</dt>
        <dd>{item.areaId || "-"}</dd>
      </div>
      <div>
        <dt>{t("responses")}</dt>
        <dd>{item.responses}</dd>
      </div>
      <div>
        <dt>{t("employment")}</dt>
        <dd>
          {item.employmentId
            ? formatHhEmployment(item.employmentId, common)
            : "-"}
        </dd>
      </div>
      <div>
        <dt>{t("links")}</dt>
        <dd className="flex min-h-5 items-center gap-2">
          {connections.length === 0 ? (
            <span>{t("localConnection")}</span>
          ) : (
            connections.map((connection) => {
              const meta = VACANCY_CONNECTION_ICONS[connection];
              return (
                <Image
                  alt={meta.label}
                  className="h-5 w-5"
                  height={20}
                  key={connection}
                  src={meta.src}
                  title={meta.label}
                  unoptimized
                  width={20}
                />
              );
            })
          )}
        </dd>
      </div>
    </>
  );
}

export function VacancyTable({
  items,
  title,
  headerAction,
  isLoading = false,
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
  return (
    <div
      className={cn(
        "vacancy-list-surface surface-card flex min-h-0 flex-1 flex-col overflow-hidden",
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
          "hidden grid-cols-[minmax(190px,1fr)_150px_minmax(104px,0.7fr)_88px_minmax(120px,0.9fr)_minmax(72px,0.4fr)_124px] gap-x-3 border-border-input border-b bg-table-header-bg px-4 py-3 xl:grid",
          columnHeaderClassName,
        )}
      >
        <div className="flex min-w-0 items-center gap-1 font-semibold text-text-muted text-xs">
          <span>{common("name")}</span>
          <SortIcon className="h-4 w-4" />
        </div>
        <div className="flex min-w-0 items-center gap-1 font-semibold text-text-muted text-xs">
          <span>{common("status")}</span>
          <SortIcon className="h-4 w-4" />
        </div>
        <div className="flex min-w-0 items-center gap-1 font-semibold text-text-muted text-xs">
          <span>{t("region")}</span>
          <SortIcon className="h-4 w-4" />
        </div>
        <div className="flex min-w-0 items-center gap-1 font-semibold text-text-muted text-xs">
          <span>{t("responses")}</span>
          <SortIcon className="h-4 w-4" />
        </div>
        <div className="flex min-w-0 items-center gap-1 font-semibold text-text-muted text-xs">
          <span>{t("employment")}</span>
          <SortIcon className="h-4 w-4" />
        </div>
        <div className="flex min-w-0 items-center gap-1 font-semibold text-text-muted text-xs">
          <span>{t("links")}</span>
        </div>
        <div />
      </div>

      {isLoading ? (
        <TableRowsSkeleton count={5} />
      ) : (
        <>
          <div
            className={cn(
              "vacancy-list-body min-h-0 flex-1 overflow-auto",
              bodyClassName,
            )}
          >
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
                      "vacancy-list-card grid grid-cols-12 items-start border-border-input border-b px-4 py-3.5 last:border-b-0 xl:grid-cols-[minmax(190px,1fr)_150px_minmax(104px,0.7fr)_88px_minmax(120px,0.9fr)_minmax(72px,0.4fr)_124px] xl:items-center xl:gap-x-3 xl:py-2.5",
                      stripedRows &&
                        (index % 2 === 0
                          ? "xl:bg-bg-light"
                          : "xl:bg-table-stripe-bg"),
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
                    <div className="vacancy-card-primary col-span-12 flex min-w-0 items-start gap-2.5 xl:col-auto">
                      {onToggleSelection && (
                        <Checkbox
                          //TODO: fix it when selection will be implemented
                          checked={false}
                          onChange={() => onToggleSelection(item.id)}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <Link
                            className="block min-w-0 truncate font-semibold text-sm text-text-heading leading-5 hover:text-primary-blue"
                            href={getDetailPath(item)}
                            title={item.title}
                          >
                            {item.title}
                          </Link>
                        </div>
                        {item.experienceId && (
                          <div className="mt-1 truncate text-text-placeholder text-xs leading-none">
                            {formatHhExperience(item.experienceId, common)}
                          </div>
                        )}
                        {publishedAtLabel && (
                          <div className="mt-1 truncate text-text-placeholder text-xs leading-none">
                            {t("published")} {publishedAtLabel}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="vacancy-card-status col-span-6 mt-3 min-w-0 xl:col-auto xl:mt-0">
                      {isHhVacancy || !onStatusChange ? (
                        <span
                          className={`inline-flex h-6 w-fit items-center whitespace-nowrap rounded-md px-2.5 font-semibold text-black text-xs lowercase leading-none ${statusTone.containerClassName}`}
                        >
                          {getVacancyStatusLabel(
                            item.status,
                            vacancyStatusOptions,
                          )}
                        </span>
                      ) : (
                        <div
                          className={`${statusTone.containerClassName} relative inline-flex w-fit items-center overflow-hidden rounded-md`}
                        >
                          <select
                            aria-label={t("statusFor", {
                              title: item.title,
                            })}
                            className="h-6 w-auto appearance-none bg-transparent px-2.5 pr-7 font-semibold text-black text-xs lowercase leading-none [field-sizing:content] disabled:cursor-not-allowed disabled:opacity-70"
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
                          <ChevronDownIcon className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-black" />
                        </div>
                      )}
                    </div>

                    <div className="hidden min-w-0 truncate text-sm text-text-heading leading-none xl:col-auto xl:block">
                      {item.areaId || "-"}
                    </div>

                    <div className="hidden min-w-0 text-sm text-text-heading leading-none xl:col-auto xl:block">
                      {item.responses}
                    </div>

                    <div className="hidden min-w-0 truncate text-sm text-text-heading leading-none xl:col-auto xl:block">
                      {item.employmentId
                        ? formatHhEmployment(item.employmentId, common)
                        : "-"}
                    </div>

                    <div className="hidden min-w-0 xl:col-auto xl:flex xl:items-center xl:gap-1.5">
                      {connections.length === 0 ? (
                        <span className="rounded-md bg-bg-light px-2 py-1 font-medium text-text-muted text-xs leading-none">
                          {t("localConnection")}
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

                    <div className="vacancy-card-actions col-span-6 mt-3 flex min-w-0 items-center justify-end gap-2 xl:col-auto xl:mt-0">
                      <Link
                        className="ui-button ui-button-primary h-6.5 min-h-6.5 min-w-20 shrink-0 whitespace-nowrap px-4"
                        href={getFunnelPath(item)}
                      >
                        {t("responses")}
                      </Link>
                      <button
                        aria-label={common("details")}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-text-placeholder transition-colors hover:bg-bg-hover hover:text-text-secondary xl:h-auto xl:w-auto xl:rounded-none xl:p-1"
                        type="button"
                      >
                        <MoreIcon className="h-4 w-4" />
                      </button>
                    </div>

                    <dl className="vacancy-card-meta col-span-12 mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs xl:hidden">
                      <MobileMeta item={item} />
                    </dl>
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
