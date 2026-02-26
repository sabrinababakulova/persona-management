import type { FormProgressProps } from "~/types/components/form-progress-props";

export function FormProgress({
  percentage,
  filled,
  total,
  missing,
}: FormProgressProps) {
  return (
    <div className="mb-9 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-[14px] text-primary-blue tracking-[-0.28px]">
          {percentage}% заполнено
        </span>
        <span className="text-[12px] text-text-placeholder tracking-[-0.24px]">
          {filled} из {total} полей
        </span>
      </div>
      <div className="h-2 w-full rounded-[10px] bg-border-input">
        <div
          className="h-full rounded-[10px] bg-primary-blue transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[14px] tracking-[-0.28px]">
          <span className="text-text-placeholder">Осталось заполнить:</span>
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
