import { useTranslations } from "next-intl";
import type { RecentActionsProps } from "~/types/components/recent-actions";

const CREATED_STATUSES = new Set(["создан", "создана", "создано"]);

export const RecentActions = ({
  recentActivities = [],
}: RecentActionsProps) => {
  const t = useTranslations("Dashboard");

  return (
    <section className="surface-card flex min-h-[380px] flex-col overflow-hidden p-5 sm:p-6 xl:min-h-[420px]">
      <h3 className="font-bold text-lg text-text-heading leading-6">
        {t("recentActions")}
      </h3>

      {recentActivities.length > 0 ? (
        <div className="mt-4 divide-y divide-border-light">
          {recentActivities.map((activity) => {
            const shouldShowStatus =
              activity.newStatus &&
              !CREATED_STATUSES.has(activity.newStatus.trim().toLowerCase());

            return (
              <article
                className="flex gap-3 py-3.5 first:pt-0"
                key={activity.id}
              >
                <div
                  aria-hidden="true"
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full font-bold text-xs ${
                    activity.isCurrentUser
                      ? "bg-text-heading text-white"
                      : "bg-primary-blue-light text-primary-blue"
                  }`}
                >
                  {activity.actorInitials.slice(0, 2)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate font-bold text-sm text-text-heading leading-5">
                      {activity.name}
                      {activity.isCurrentUser ? ` (${t("you")})` : ""}
                    </p>
                    <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                      {activity.isRecent ? (
                        <span
                          aria-hidden="true"
                          className="size-1.5 rounded-full bg-success-green"
                        />
                      ) : null}
                      <time
                        className={`text-xs leading-4 ${
                          activity.isRecent
                            ? "font-semibold text-green-700"
                            : "text-text-muted"
                        }`}
                      >
                        {activity.time}
                      </time>
                    </div>
                  </div>

                  <p className="mt-1 text-sm text-text-muted leading-5">
                    {activity.action}{" "}
                    <span className="font-semibold text-primary-blue">
                      {activity.candidateName}
                    </span>
                    {shouldShowStatus ? ` — ${activity.newStatus}` : ""}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="font-semibold text-sm text-text-heading">
            {t("noRecentActivity")}
          </p>
          <p className="mt-1 max-w-64 text-text-muted text-xs leading-5">
            {t("noRecentActivityHint")}
          </p>
        </div>
      )}
    </section>
  );
};
