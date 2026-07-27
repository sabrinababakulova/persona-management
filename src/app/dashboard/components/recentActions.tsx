import { useTranslations } from "next-intl";
import type { RecentActionsProps } from "~/types/components/recent-actions";

export const RecentActions = ({
  recentActivities = [],
}: RecentActionsProps) => {
  const t = useTranslations("Dashboard");

  return (
    <div className="surface-card flex min-h-56 flex-col gap-4 overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-text-secondary leading-5">
          {t("recentActions")}
        </h3>
      </div>

      <div className="flex flex-col gap-4">
        {recentActivities.map((activity) => {
          const isCreateAction = activity.action.startsWith("Создал(а)");

          return (
            <div className="flex flex-col gap-2" key={activity.id}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-blue-light font-bold text-[10px] text-primary-blue leading-none">
                    {activity.candidateInitials.slice(0, 2)}
                  </div>
                  <p className="truncate font-semibold text-sm text-text-heading leading-none">
                    {activity.name}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {activity.isRecent ? (
                    <span className="size-1 rounded-full bg-accent-red" />
                  ) : null}
                  <p className="text-text-muted text-xs leading-none">
                    {activity.time}
                  </p>
                </div>
              </div>

              <p className="text-text-placeholder text-xs leading-5">
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
