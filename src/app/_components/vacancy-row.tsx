interface VacancyRowProps {
  title: string;
  subtitle: string;
  status: string;
  city: string;
  responses: number;
  workType: string;
}

export function VacancyRow({
  title,
  subtitle,
  status,
  city,
  responses,
  workType,
}: VacancyRowProps) {
  return (
    <div className="grid grid-cols-12 items-center gap-4 border-border-light border-b px-6 py-4 last:border-b-0">
      <div className="col-span-3">
        <div className="font-medium text-gray-900">{title}</div>
        <div className="text-sm text-text-muted">{subtitle}</div>
      </div>
      <div className="col-span-2">
        <span className="inline-flex rounded-full bg-success-green-bg px-3 py-1 font-medium text-sm text-success-green">
          {status}
        </span>
      </div>
      <div className="col-span-2 text-gray-700">{city}</div>
      <div className="col-span-2 text-gray-700">{responses}</div>
      <div className="col-span-2 text-gray-700">{workType}</div>
      <div className="col-span-1 flex items-center justify-end gap-2">
        <button
          className="flex items-center gap-1 rounded-lg border border-border-light px-3 py-1.5 text-gray-600 text-sm hover:bg-bg-light"
          type="button"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <title>Filter Icon</title>
            <path
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          </svg>
          Воронка
        </button>
        <button
          className="p-1.5 text-gray-400 hover:text-gray-600"
          type="button"
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <title>More Options</title>
            <circle cx="12" cy="6" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="18" r="2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
