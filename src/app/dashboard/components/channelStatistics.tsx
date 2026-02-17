import type {
  ChannelStat,
  ChannelStatisticsProps,
} from "~/types/components/channel-statistics";

const CHANNEL_ORDER = ["hh.uz", "telegram", "rabota.uz", "Другие"] as const;

const CHANNEL_COLORS: Record<(typeof CHANNEL_ORDER)[number], string> = {
  "hh.uz": "#FF558E",
  telegram: "#9747FF",
  "rabota.uz": "#FFC466",
  Другие: "#4C91F6",
};

function normalizeChannelName(value: string) {
  const name = value.trim().toLowerCase();

  if (name === "hh.uz") {
    return "hh.uz" as const;
  }
  if (name === "telegram") {
    return "telegram" as const;
  }
  if (name === "rabota.uz") {
    return "rabota.uz" as const;
  }

  return "Другие" as const;
}

function buildNormalizedStats(channelStats: ChannelStat[]) {
  const totals = new Map<(typeof CHANNEL_ORDER)[number], number>(
    CHANNEL_ORDER.map((item) => [item, 0]),
  );

  for (const channel of channelStats) {
    const key = normalizeChannelName(channel.name);
    totals.set(key, (totals.get(key) ?? 0) + channel.percentage);
  }

  return CHANNEL_ORDER.map((name) => ({
    name,
    percentage: Math.max(0, Math.round(totals.get(name) ?? 0)),
    color: CHANNEL_COLORS[name],
  }));
}

export function ChannelStatistics({
  channelStats = [],
}: ChannelStatisticsProps) {
  const normalizedStats = buildNormalizedStats(channelStats);
  const total = normalizedStats.reduce((sum, item) => sum + item.percentage, 0);
  const safeTotal = total > 0 ? total : 1;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let dashOffset = 0;

  return (
    <div className="flex flex-col gap-4 overflow-hidden rounded-[8px] border border-border-input bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-[16px] text-text-secondary leading-none tracking-[-0.32px]">
          Статистика по каналам
        </h3>
      </div>

      <div className="flex items-center gap-8">
        <div className="h-[138px] w-[140px] shrink-0">
          <svg
            aria-hidden="true"
            className="h-full w-full -rotate-90"
            viewBox="0 0 140 138"
          >
            <title>Channel Statistics Chart</title>
            {normalizedStats.map((item) => {
              const segment = (item.percentage / safeTotal) * circumference;
              const circle = (
                <circle
                  cx="70"
                  cy="69"
                  fill="none"
                  key={item.name}
                  r={radius}
                  stroke={item.color}
                  strokeDasharray={`${segment} ${circumference - segment}`}
                  strokeDashoffset={-dashOffset}
                  strokeLinecap="butt"
                  strokeWidth="24"
                />
              );
              dashOffset += segment;
              return circle;
            })}
          </svg>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-4">
          {normalizedStats.map((item) => (
            <div className="flex items-center justify-between" key={item.name}>
              <div className="flex items-center gap-[10px]">
                <span
                  className="size-4 shrink-0 rounded-[4px]"
                  style={{ backgroundColor: item.color }}
                />
                <p className="font-semibold text-[14px] text-text-heading leading-none tracking-[-0.28px]">
                  {item.name}
                </p>
              </div>

              <p className="font-normal text-[14px] text-text-heading leading-none tracking-[-0.28px]">
                {item.percentage}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
