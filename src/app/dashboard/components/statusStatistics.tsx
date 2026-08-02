import { useTranslations } from "next-intl";
import type { StatusStatisticsProps } from "~/types/components/status-statistics";

const EMPTY_STATUS_STATS = [
  "new",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
].map((status) => ({ status, value: 0, max: 1 }));

const STATUS_TRANSLATION_KEYS: Record<
  string,
  | "statusNew"
  | "statusScreening"
  | "statusInterview"
  | "statusOffer"
  | "statusHired"
  | "statusRejected"
  | "statusUnknown"
> = {
  new: "statusNew",
  screening: "statusScreening",
  interview: "statusInterview",
  offer: "statusOffer",
  hired: "statusHired",
  rejected: "statusRejected",
};

export function StatusStatistics({ statusStats = [] }: StatusStatisticsProps) {
  const t = useTranslations("Dashboard");
  const displayedStats =
    statusStats.length > 0 ? statusStats : EMPTY_STATUS_STATS;
  const totalCandidates = displayedStats.reduce(
    (sum, stat) => sum + stat.value,
    0,
  );
  const candidatesInWork = displayedStats
    .filter((stat) => stat.status !== "hired" && stat.status !== "rejected")
    .reduce((sum, stat) => sum + stat.value, 0);
  const hired =
    displayedStats.find((stat) => stat.status === "hired")?.value ?? 0;
  const hireConversion =
    totalCandidates > 0 ? Math.round((hired / totalCandidates) * 1000) / 10 : 0;

  return (
    <section className="surface-card flex min-h-[380px] flex-col overflow-hidden p-5 sm:p-6 xl:min-h-[420px]">
      <h3 className="font-bold text-lg text-text-heading leading-6">
        {t("statusStatistics")}
      </h3>

      <div className="mt-7 flex flex-col gap-4">
        {displayedStats.map((stat) => {
          const safeMax = Math.max(1, stat.max);
          const percentage = Math.min(100, (stat.value / safeMax) * 100);
          const isRejected = stat.status === "rejected";

          return (
            <div
              className="grid grid-cols-[5.5rem_minmax(0,1fr)_2.25rem] items-center gap-3"
              key={stat.status}
            >
              <p className="truncate font-medium text-sm text-text-secondary">
                {t(STATUS_TRANSLATION_KEYS[stat.status] ?? "statusUnknown")}
              </p>

              <div
                aria-label={`${t(STATUS_TRANSLATION_KEYS[stat.status] ?? "statusUnknown")}: ${stat.value}`}
                aria-valuemax={safeMax}
                aria-valuemin={0}
                aria-valuenow={stat.value}
                className="h-2.5 overflow-hidden rounded-full bg-bg-input"
                role="progressbar"
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${
                    stat.value > 0 ? "min-w-1.5" : "min-w-0"
                  } ${isRejected ? "bg-gray-300" : "bg-primary-blue"}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>

              <p className="text-right font-bold text-sm text-text-heading tabular-nums">
                {stat.value}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-auto border-border-light border-t pt-4 text-text-muted text-xs leading-5">
        <strong className="font-semibold text-text-heading">
          {t("candidatesInWork", { count: candidatesInWork })}
        </strong>{" "}
        · {t("hireConversion", { value: hireConversion })}
      </p>
    </section>
  );
}
