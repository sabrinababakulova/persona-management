import { useTranslations } from "next-intl";
import type { StatusStatisticsProps } from "~/types/components/status-statistics";

export function StatusStatistics({ statusStats = [] }: StatusStatisticsProps) {
  const t = useTranslations("Dashboard");

  return (
    <div className="surface-card flex min-h-56 flex-col gap-4 overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-text-secondary leading-5">
          {t("statusStatistics")}
        </h3>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3">
        {statusStats.map((stat) => {
          const safeMax = Math.max(1, stat.max);
          const percentage = Math.min(100, (stat.value / safeMax) * 100);

          return (
            <div className="flex items-center gap-2" key={stat.label}>
              <p className="w-20 shrink-0 truncate text-right font-medium text-text-secondary text-xs leading-none">
                {stat.label}
              </p>

              <div className="min-w-0 flex-1">
                <div
                  className="h-3 rounded bg-warning-yellow transition-[width] duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>

              <p className="w-8 shrink-0 text-right font-semibold text-sm text-text-heading leading-none">
                {stat.value}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
