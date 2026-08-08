import { useTranslations } from "next-intl";
import { ChannelStatisticsChartIcon } from "~/app/_components/icons";
import type {
  ChannelStat,
  ChannelStatisticsProps,
} from "~/types/components/channel-statistics";

const CHANNEL_ORDER = ["hh.uz", "telegram", "olx", "other"] as const;

const CHANNEL_COLORS: Record<
  (typeof CHANNEL_ORDER)[number],
  { strokeClassName: string; fillClassName: string }
> = {
  "hh.uz": {
    strokeClassName: "stroke-primary-blue",
    fillClassName: "bg-primary-blue",
  },
  telegram: {
    strokeClassName: "stroke-chart-pink",
    fillClassName: "bg-chart-pink",
  },
  olx: {
    strokeClassName: "stroke-chart-orange",
    fillClassName: "bg-chart-orange",
  },
  other: {
    strokeClassName: "stroke-gray-300",
    fillClassName: "bg-gray-300",
  },
};

function normalizeChannelName(value: string) {
  const name = value.trim().toLowerCase();

  if (name === "hh.uz") {
    return "hh.uz" as const;
  }
  if (name === "telegram") {
    return "telegram" as const;
  }
  if (name === "olx") {
    return "olx" as const;
  }

  return "other" as const;
}

function buildNormalizedStats(channelStats: ChannelStat[]) {
  const totals = new Map<(typeof CHANNEL_ORDER)[number], number>(
    CHANNEL_ORDER.map((item) => [item, 0]),
  );

  for (const channel of channelStats) {
    const key = normalizeChannelName(channel.name);
    totals.set(key, (totals.get(key) ?? 0) + channel.count);
  }

  const total = Array.from(totals.values()).reduce(
    (sum, count) => sum + count,
    0,
  );

  // Largest-remainder rounding: naive per-row Math.round can add up to 99%
  // or 101%, so floor everything and hand the leftover points to the rows
  // with the biggest fractional parts.
  const exactShares = CHANNEL_ORDER.map((name) =>
    total > 0 ? ((totals.get(name) ?? 0) / total) * 100 : 0,
  );
  const percentages = exactShares.map((share) => Math.floor(share));
  let leftover =
    total > 0 ? 100 - percentages.reduce((sum, value) => sum + value, 0) : 0;
  const byRemainder = exactShares
    .map((share, index) => ({ index, remainder: share - Math.floor(share) }))
    .filter((entry) => (exactShares[entry.index] ?? 0) > 0)
    .sort((a, b) => b.remainder - a.remainder);
  for (const entry of byRemainder) {
    if (leftover <= 0) {
      break;
    }
    percentages[entry.index] = (percentages[entry.index] ?? 0) + 1;
    leftover -= 1;
  }

  return CHANNEL_ORDER.map((name, index) => ({
    name,
    count: totals.get(name) ?? 0,
    percentage: percentages[index] ?? 0,
    colorClasses: CHANNEL_COLORS[name],
  }));
}

export function ChannelStatistics({
  channelStats = [],
}: ChannelStatisticsProps) {
  const t = useTranslations("Dashboard");
  const normalizedStats = buildNormalizedStats(channelStats);
  const total = normalizedStats.reduce((sum, item) => sum + item.count, 0);
  const safeTotal = total > 0 ? total : 1;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  let dashOffset = 0;
  const chartSegments = normalizedStats.map((item) => {
    const segment = (item.count / safeTotal) * circumference;
    const chartSegment = {
      dashOffset,
      name: item.name,
      segment,
      strokeClassName: item.colorClasses.strokeClassName,
    };
    dashOffset += segment;
    return chartSegment;
  });
  const bestChannel = normalizedStats.reduce<
    (typeof normalizedStats)[number] | null
  >((best, item) => (item.count > (best?.count ?? 0) ? item : best), null);
  const getChannelLabel = (name: (typeof CHANNEL_ORDER)[number]) => {
    if (name === "other") {
      return t("other");
    }
    return name === "olx" ? "OLX" : name;
  };

  return (
    <section className="surface-card flex min-h-[380px] flex-col overflow-hidden p-5 sm:p-6 xl:min-h-[420px]">
      <h3 className="font-bold text-lg text-text-heading leading-6">
        {t("channelStatistics")}
      </h3>

      <div className="flex justify-center py-4">
        <div
          aria-label={`${t("totalCandidates")}: ${total}`}
          className="relative size-36"
          role="img"
        >
          <ChannelStatisticsChartIcon
            circumference={circumference}
            className="h-full w-full -rotate-90"
            radius={radius}
            segments={chartSegments}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-0.5">
            <strong className="font-bold text-3xl text-text-heading tabular-nums leading-none">
              {total}
            </strong>
            <span className="mt-1 text-text-muted text-xs">{t("total")}</span>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border-light">
        {normalizedStats.map((item) => (
          <div
            className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2"
            key={item.name}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden="true"
                className={`size-3 shrink-0 rounded-[4px] ${item.colorClasses.fillClassName}`}
              />
              <p className="truncate font-semibold text-sm text-text-heading">
                {getChannelLabel(item.name)}
              </p>
            </div>
            <p className="min-w-7 text-right font-bold text-sm text-text-heading tabular-nums">
              {item.count}
            </p>
            <p className="w-9 text-right text-text-muted text-xs tabular-nums">
              {item.percentage}%
            </p>
          </div>
        ))}
      </div>

      <p className="mt-auto border-border-light border-t pt-4 text-text-muted text-xs leading-5">
        {bestChannel && bestChannel.count > 0 ? (
          <>
            {t("bestChannel")} —{" "}
            <strong className="font-semibold text-text-heading">
              {getChannelLabel(bestChannel.name)}
            </strong>{" "}
            · {bestChannel.percentage}% {t("ofAllCandidates")}
          </>
        ) : (
          t("noCandidateStatistics")
        )}
      </p>
    </section>
  );
}
