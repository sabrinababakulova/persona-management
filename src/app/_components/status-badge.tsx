import type { StatusBadgeProps } from "~/types/components/status-badge-props";

const statusConfig = {
  active: {
    label: "АКТИВНА",
    className: "bg-status-active-bg text-status-active",
  },
  draft: {
    label: "ЧЕРНОВИК",
    className: "bg-status-draft-bg text-status-draft",
  },
  paused: {
    label: "ПРИОСТАНОВЛЕНА",
    className: "bg-status-paused-bg text-status-paused",
  },
  closed: {
    label: "ЗАКРЫТА",
    className: "bg-status-closed-bg text-status-closed",
  },
  archive: {
    label: "АРХИВ",
    className: "bg-status-archive-bg text-status-archive",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-medium text-xs ${config.className}`}
    >
      {config.label}
      {status === "active" && (
        <svg
          aria-hidden="true"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M5 13l4 4L19 7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
          />
        </svg>
      )}
      {status !== "active" && status !== "archive" && (
        <svg
          aria-hidden="true"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M19 9l-7 7-7-7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </svg>
      )}
    </span>
  );
}
