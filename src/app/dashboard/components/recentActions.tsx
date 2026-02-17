import type { RecentActionsProps } from "~/types/components/recent-actions";

export const RecentActions = ({
  recentActivities = [],
}: RecentActionsProps) => {
  return (
    <div className="flex flex-col gap-4 overflow-hidden rounded-[8px] border border-border-input bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-[16px] text-text-secondary leading-none tracking-[-0.32px]">
          Последние действия
        </h3>
      </div>

      <div className="flex flex-col gap-[18px]">
        {recentActivities.map((activity) => {
          const isCreateAction = activity.action.startsWith("Создал(а)");

          return (
            <div className="flex flex-col gap-2" key={activity.id}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#cedbf5] font-semibold text-[9px] text-primary-blue leading-none tracking-[-0.18px]">
                    {activity.candidateInitials.slice(0, 2)}
                  </div>
                  <p className="truncate font-medium text-[14px] text-text-heading leading-none tracking-[-0.28px]">
                    {activity.name}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {activity.isRecent ? (
                    <span className="size-1 rounded-full bg-accent-red" />
                  ) : null}
                  <p className="font-normal text-[12px] text-text-disabled leading-none tracking-[-0.24px]">
                    {activity.time}
                  </p>
                </div>
              </div>

              <p className="font-normal text-[13px] text-text-placeholder leading-[1.3] tracking-[-0.26px]">
                {activity.action}{" "}
                <span className="text-primary-blue">
                  {activity.candidateName}
                </span>
                {isCreateAction ? "" : ` на "${activity.newStatus}"`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
