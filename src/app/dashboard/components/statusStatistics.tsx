import type { StatusStatisticsProps } from "~/types/components/status-statistics";

export function StatusStatistics({ statusStats = [] }: StatusStatisticsProps) {
  return (
    <div className="flex flex-col gap-4 overflow-hidden rounded-[8px] border border-border-input bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-[16px] text-text-secondary leading-none tracking-[-0.32px]">
          Статистика по статусу
        </h3>
      </div>

      <div className="flex flex-col gap-2">
        {statusStats.map((stat) => {
          const safeMax = Math.max(1, stat.max);
          const percentage = Math.min(100, (stat.value / safeMax) * 100);

          return (
            <div className="flex items-center gap-2" key={stat.label}>
              <p className="w-[70px] shrink-0 text-right font-medium text-[14px] text-text-heading leading-none tracking-[-0.28px]">
                {stat.label}
              </p>

              <div className="min-w-0 flex-1">
                <div
                  className="h-3 rounded-[4px] bg-[#ffc466] transition-[width] duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>

              <p className="w-[36px] shrink-0 text-right font-normal text-[14px] text-text-heading leading-none tracking-[-0.28px]">
                {stat.value}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
