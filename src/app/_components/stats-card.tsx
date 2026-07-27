"use client";

import { useTranslations } from "next-intl";
import type { StatsCardProps } from "~/types/components/stats-card-props";
import { TrendDownIcon, TrendUpIcon } from "./icons";
import { motion } from "./motion-system";

export function StatsCard({
  title,
  value,
  change,
  changeType,
  period,
}: StatsCardProps) {
  const t = useTranslations("Common");
  const changeColors = {
    positive: "bg-success-green-bg text-success-green",
    negative: "bg-danger-red-bg text-danger-red",
    neutral: "bg-warning-yellow-bg text-warning-yellow",
  };

  const changeIcons = {
    positive: <TrendUpIcon className="h-4 w-4" />,
    negative: <TrendDownIcon className="h-4 w-4" />,
    neutral: <TrendUpIcon className="h-4 w-4" />,
  };

  return (
    <motion.div
      className="surface-card p-5"
      transition={{ type: "spring", stiffness: 360, damping: 28 }}
      whileHover={{ y: -3 }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-medium text-sm text-text-secondary">{title}</span>
        <button
          className="font-semibold text-primary-blue text-sm hover:text-primary-blue-hover"
          type="button"
        >
          {t("details")}
        </button>
      </div>
      <div className="flex items-end gap-3">
        <span className="font-bold text-4xl text-text-heading tracking-tight">
          {value}
        </span>
        {change && changeType && (
          <span
            className={`flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-xs ${changeColors[changeType]}`}
          >
            {changeIcons[changeType]}
            {change}
          </span>
        )}
      </div>
      <span className="mt-1 block text-text-muted text-xs">{period}</span>
    </motion.div>
  );
}
