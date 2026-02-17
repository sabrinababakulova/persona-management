import type { ActivityItemProps } from "~/types/components/activity-item-props";

export function ActivityItem({
  name,
  action,
  candidateName,
  candidateInitials,
  newStatus,
  time,
  isRecent,
}: ActivityItemProps) {
  return (
    <div className="border-border-light border-b py-4 last:border-b-0">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-blue font-medium text-sm text-white">
            {candidateInitials}
          </div>
          <span className="font-medium text-gray-900">{name}</span>
        </div>
        <div className="flex items-center gap-2">
          {isRecent && <span className="h-2 w-2 rounded-full bg-badge-red" />}
          <span className="text-sm text-text-muted">{time}</span>
        </div>
      </div>
      <p className="pl-11 text-gray-600 text-sm">
        {action} <span className="text-primary-blue">{candidateName}</span> на "
        {newStatus}"
      </p>
    </div>
  );
}
