import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Vacancy } from "~/types/pages/vacancies-page";
import { Checkbox } from "./checkbox";
import { ChevronDownIcon, FunnelIcon, MoreIcon, SortIcon } from "./icons";

const VACANCY_CONNECTION_ICONS: Record<
  NonNullable<Vacancy["connections"]>[number],
  { src: string; label: string }
> = {
  telegram: { src: "/telegram.svg", label: "Telegram" },
  "hh.uz": { src: "/hh.svg", label: "hh.uz" },
};

type VacancyStatus = Vacancy["status"];

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

interface VacancyTableProps {
  items: Vacancy[];
  title?: ReactNode;
  headerAction?: ReactNode;
  isLoading?: boolean;
  loadingLabel?: string;
  emptyState?: ReactNode;
  pagination?: ReactNode;
  vacancyStatusOptions: Array<{ value: string; label: string }>;
  onToggleSelection?: (id: string) => void;
  onStatusChange?: (vacancyId: string, nextStatus: string) => void;
  isStatusPending?: (vacancy: Vacancy) => boolean;
  getDetailPath?: (vacancy: Vacancy) => string;
  getFunnelPath?: (vacancy: Vacancy) => string;
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

function formatVacancyPublishedAt(value?: string): string | null {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsedDate);
}

function toVacancyDetailPath(vacancy: Vacancy) {
  return `/vacancies/${vacancy.id}`;
}

function toVacancyFunnelPath(vacancy: Vacancy) {
  return `/vacancies/funnel/${vacancy.id}`;
}

function renderMobileMeta(item: Vacancy) {
  return (
    <>
      <span>Регион (hh.uz): {item.areaId || "-"}</span>
      <span>Отклики: {item.responses}</span>
      <span>Занятость: {item.employmentId || "-"}</span>
    </>
  );
}

export function VacancyTable({
  items,
  title,
  headerAction,
  isLoading = false,
  loadingLabel = "Загрузка вакансий...",
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
  const showTitleBar = Boolean(title) || Boolean(headerAction);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-[8px] border border-border-input bg-bg-light",
        containerClassName,
      )}
    >
      {showTitleBar && (
        <div
          className={cn(
            "flex items-center justify-between border-border-input border-b px-6 py-4",
            titleBarClassName,
          )}
        >
          <div className="font-semibold text-lg text-text-heading">{title}</div>
          {headerAction}
        </div>
      )}

      <div
        className={cn(
          "hidden grid-cols-12 border-border-input border-b bg-bg-input px-4 py-[14px] lg:grid",
          columnHeaderClassName,
        )}
      >
        <div className="col-span-3 flex items-center gap-1 text-[14px] text-text-placeholder">
          <span>Название</span>
          <SortIcon className="h-4 w-4" />
        </div>
        <div className="col-span-2 flex items-center gap-1 text-[14px] text-text-placeholder">
          <span>Статус</span>
          <SortIcon className="h-4 w-4" />
        </div>
        <div className="col-span-2 flex items-center gap-1 text-[14px] text-text-placeholder">
          <span>Регион (hh.uz)</span>
          <SortIcon className="h-4 w-4" />
        </div>
        <div className="col-span-1 flex items-center gap-1 text-[14px] text-text-placeholder">
          <span>Отклики</span>
          <SortIcon className="h-4 w-4" />
        </div>
        <div className="col-span-2 flex items-center gap-1 text-[14px] text-text-placeholder">
          <span>Занятость</span>
          <SortIcon className="h-4 w-4" />
        </div>
        <div className="col-span-1 flex items-center gap-1 text-[14px] text-text-placeholder">
          <span>Связи</span>
        </div>
        <div className="col-span-1" />
      </div>

      {isLoading ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-text-placeholder">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-light border-t-primary-blue" />
          <div className="text-[14px]">{loadingLabel}</div>
        </div>
      ) : (
        <>
          <div className={cn("min-h-0 flex-1 overflow-auto", bodyClassName)}>
            {items.map((item, index) =>
              (() => {
                const statusTone =
                  vacancyStatusTone[item.status] ?? vacancyStatusTone.active;
                const isHhVacancy = item.source === "hh.uz";
                const connections = item.connections ?? [];
                const publishedAtLabel = formatVacancyPublishedAt(
                  item.publishedAt,
                );
                const statusPending = isStatusPending?.(item) ?? false;

                return (
                  <div
                    className={cn(
                      "grid grid-cols-12 items-start border-border-input border-b px-4 py-[14px] last:border-b-0 lg:items-center",
                      stripedRows &&
                        (index % 2 === 0 ? "bg-bg-light" : "bg-bg-input"),
                      rowClassName,
                    )}
                    key={item.id}
                  >
                    <div className="col-span-12 flex items-start gap-2.5 lg:col-span-3">
                      {onToggleSelection && (
                        <Checkbox
                          checked={item.selected || false}
                          onChange={() => onToggleSelection(item.id)}
                        />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            className="block max-w-[220px] truncate font-medium text-[14px] text-text-heading leading-none hover:text-primary-blue hover:underline lg:max-w-[180px]"
                            href={getDetailPath(item)}
                            title={item.title}
                          >
                            {item.title}
                          </Link>
                        </div>
                        {item.experienceId && (
                          <div className="mt-1 truncate text-[12px] text-text-placeholder leading-none">
                            {item.experienceId}
                          </div>
                        )}
                        {publishedAtLabel && (
                          <div className="mt-1 truncate text-[12px] text-text-placeholder leading-none">
                            Опубликовано: {publishedAtLabel}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="col-span-6 mt-3 lg:col-span-2 lg:mt-0">
                      {isHhVacancy || !onStatusChange ? (
                        <span
                          className={`inline-flex min-h-[32px] min-w-[124px] items-center rounded-[6px] px-3 font-semibold text-[12px] uppercase leading-none tracking-[-0.24px] ${statusTone.containerClassName} ${statusTone.textClassName}`}
                        >
                          {getVacancyStatusLabel(
                            item.status,
                            vacancyStatusOptions,
                          )}
                        </span>
                      ) : (
                        <div
                          className={`relative inline-flex min-w-[124px] items-center overflow-hidden rounded-[6px] px-1 ${statusTone.containerClassName}`}
                        >
                          <select
                            aria-label={`Статус вакансии ${item.title}`}
                            className={`h-[32px] w-full appearance-none bg-transparent px-2 pr-6 font-semibold text-[12px] uppercase leading-none tracking-[-0.24px] ${statusTone.textClassName} disabled:cursor-not-allowed disabled:opacity-70`}
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

                    <div className="hidden text-[14px] text-text-heading leading-none lg:col-span-2 lg:block">
                      {item.areaId || "-"}
                    </div>

                    <div className="hidden text-[14px] text-text-heading leading-none lg:col-span-1 lg:block">
                      {item.responses}
                    </div>

                    <div className="hidden text-[14px] text-text-heading leading-none lg:col-span-2 lg:block">
                      {item.employmentId || "-"}
                    </div>

                    <div className="hidden lg:col-span-1 lg:flex lg:items-center lg:gap-1.5">
                      {connections.length === 0 ? (
                        <span className="text-[14px] text-text-heading leading-none">
                          -
                        </span>
                      ) : (
                        connections.map((connection) => {
                          const meta = VACANCY_CONNECTION_ICONS[connection];
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
                        className={`flex items-center gap-1 text-[14px] leading-none ${
                          isHhVacancy
                            ? "text-text-secondary hover:text-text-heading"
                            : "text-primary-blue hover:text-primary-blue-hover"
                        }`}
                        href={getFunnelPath(item)}
                      >
                        <FunnelIcon className="h-3.5 w-3.5" />
                        <span className="hidden xl:inline">Воронка</span>
                      </Link>
                      <button
                        className="p-1 text-text-placeholder transition-colors hover:text-text-secondary"
                        type="button"
                      >
                        <MoreIcon className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="col-span-12 mt-3 flex flex-wrap gap-4 text-[12px] text-text-placeholder lg:hidden">
                      {renderMobileMeta(item)}
                    </div>
                  </div>
                );
              })(),
            )}

            {items.length === 0 &&
              (emptyState ?? (
                <div className="px-4 py-10 text-center text-[14px] text-text-placeholder">
                  Вакансии не найдены
                </div>
              ))}
          </div>

          {pagination}
        </>
      )}
    </div>
  );
}
