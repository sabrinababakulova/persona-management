import { useTranslations } from "next-intl";
import type { FormProgressProps } from "~/types/components/form-progress-props";

export function FormProgress({
  percentage,
  filled,
  total,
  missing,
}: FormProgressProps) {
  const t = useTranslations("Components");

  return (
    <div className="mb-6 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-primary-blue text-sm">
          {t("formPercentage", { percentage })}
        </span>
        <span className="text-text-placeholder text-xs">
          {t("formFields", { filled, total })}
        </span>
      </div>
      <div className="h-2 w-full rounded-xl bg-border-input">
        <div
          className="h-full rounded-xl bg-primary-blue transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-text-placeholder">{t("remainingFields")}</span>
          {missing.map((field) => (
            <span className="font-medium text-accent-red" key={field}>
              {field}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
