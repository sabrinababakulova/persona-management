import { and, count, desc, eq, gte, ne, notExists, or } from "drizzle-orm";
import {
  getPeriodDateCutoff,
  type Period,
} from "~/server/api/router-utils/period";
import {
  getVacancyPublicationChannels,
  getVacancyResponseCounts,
  isUserVisibleVacancy,
  toVacancyStatus,
} from "~/server/api/routers/vacancies/shared";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  candidates,
  recentActivityLogs,
  users,
  vacancies,
} from "~/server/db/schema";
import { getUserCompanyId } from "~/server/utils/get-user-company-id";

const RECENT_ACTIVITIES_LIMIT = 4;

/**
 * Window the "new since" cards actually measure.
 *
 * Every card was labelled «за последние 7 дней» while its query had no date predicate at all,
 * so the figures were all-time counts that could only ever grow. The two cards that describe
 * a flow now really are windowed; the two that describe a standing total say so instead.
 */
const DASHBOARD_PERIOD: Period = "week";

/**
 * Which window a stat card measures.
 *
 * The client localizes this — the server used to send a Russian prose label that
 * `dashboard-client.tsx` discarded in favour of a hardcoded "last 7 days" for every card,
 * which is how all four ended up claiming a window that none of the queries applied.
 */
type StatWindow = "week" | "total";

const CANDIDATE_FUNNEL_STATUSES = [
  "new",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
] as const;

function pluralize(value: number, forms: [string, string, string]) {
  const abs = Math.abs(value) % 100;
  const last = abs % 10;

  if (abs > 10 && abs < 20) {
    return forms[2];
  }
  if (last > 1 && last < 5) {
    return forms[1];
  }
  if (last === 1) {
    return forms[0];
  }
  return forms[2];
}

function formatTimeAgo(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSeconds < 60) {
    return "Только что";
  }

  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) {
    return `${minutes} ${pluralize(minutes, ["минута", "минуты", "минут"])} назад`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ${pluralize(hours, ["час", "часа", "часов"])} назад`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days} ${pluralize(days, ["день", "дня", "дней"])} назад`;
  }

  return date.toLocaleDateString("ru-RU");
}

function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function buildEmptyDashboardData() {
  return {
    statsCards: [
      {
        title: "Новые отклики",
        value: "0",
        window: "week" as StatWindow,
      },
      {
        title: "Активные вакансии",
        value: "0",
        window: "total" as StatWindow,
      },
      {
        title: "Всего кандидатов",
        value: "0",
        window: "total" as StatWindow,
      },
      {
        title: "Нанято",
        value: "0",
        window: "week" as StatWindow,
      },
    ],
    recentVacancies: [],
    recentActivities: [],
    channelStats: [],
    statusStats: [],
  };
}

export const dashboardRouter = createTRPCRouter({
  getWelcomeModalState: protectedProcedure.query(async ({ ctx }) => {
    const [currentUser] = await ctx.db
      .select({ hasSeenWelcomeModal: users.hasSeenWelcomeModal })
      .from(users)
      .where(eq(users.id, ctx.session.user.id))
      .limit(1);

    return {
      shouldShowWelcomeModal: currentUser?.hasSeenWelcomeModal === false,
    };
  }),

  markWelcomeModalSeen: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(users)
      .set({ hasSeenWelcomeModal: true })
      .where(eq(users.id, ctx.session.user.id));

    return { success: true };
  }),

  getDashboardData: protectedProcedure.query(async ({ ctx }) => {
    const userCompanyId = await getUserCompanyId(ctx.db, ctx.session.user.id);

    if (!userCompanyId) {
      return buildEmptyDashboardData();
    }

    const periodCutoff = getPeriodDateCutoff(DASHBOARD_PERIOD);

    // Fetch real counts from the database
    const [
      totalCandidates,
      hiredCount,
      activeVacancies,
      newCandidates,
      candidateStatusCounts,
      sourceCounts,
      recentVacancyRows,
      recentActivityRows,
    ] = await Promise.all([
      ctx.db
        .select({ count: count() })
        .from(candidates)
        .where(eq(candidates.companyId, userCompanyId)),
      ctx.db
        .select({ count: count() })
        .from(candidates)
        .where(
          and(
            eq(candidates.companyId, userCompanyId),
            eq(candidates.status, "hired"),
            gte(candidates.updatedAt, periodCutoff),
          ),
        ),
      ctx.db
        .select({ count: count() })
        .from(vacancies)
        .where(
          and(
            eq(vacancies.companyId, userCompanyId),
            eq(vacancies.status, "active"),
            eq(vacancies.isPublication, false),
            isUserVisibleVacancy(),
          ),
        ),
      ctx.db
        .select({ count: count() })
        .from(candidates)
        .where(
          and(
            eq(candidates.companyId, userCompanyId),
            eq(candidates.status, "new"),
            gte(candidates.createdAt, periodCutoff),
          ),
        ),
      // Current candidate funnel, grouped once in the database.
      ctx.db
        .select({
          status: candidates.status,
          count: count(),
        })
        .from(candidates)
        .where(eq(candidates.companyId, userCompanyId))
        .groupBy(candidates.status),
      // Count by source
      ctx.db
        .select({
          source: candidates.source,
          count: count(),
        })
        .from(candidates)
        .where(eq(candidates.companyId, userCompanyId))
        .groupBy(candidates.source),
      // Recent vacancies — only fields rendered by the dashboard's VacancyTable
      ctx.db
        .select({
          id: vacancies.id,
          title: vacancies.title,
          status: vacancies.status,
          areaId: vacancies.areaId,
          employmentId: vacancies.employmentId,
          experienceId: vacancies.experienceId,
          hhVacancyId: vacancies.hhVacancyId,
          personHunterVacancyId: vacancies.personHunterVacancyId,
          telegramPostId: vacancies.telegramPostId,
        })
        .from(vacancies)
        .where(
          and(
            eq(vacancies.companyId, userCompanyId),
            eq(vacancies.status, "active"),
            // Base vacancies only — per-channel publication rows would
            // duplicate titles and always show 0 responses (candidates are
            // linked to the base vacancy, not its publications).
            eq(vacancies.isPublication, false),
            isUserVisibleVacancy(),
          ),
        )
        .orderBy(desc(vacancies.createdAt))
        .limit(3),
      // Recent activity events from candidate/vacancy updates
      ctx.db
        .select({
          id: recentActivityLogs.id,
          actorUserId: recentActivityLogs.actorUserId,
          actorName: recentActivityLogs.actorName,
          action: recentActivityLogs.action,
          targetName: recentActivityLogs.targetName,
          targetStatus: recentActivityLogs.targetStatus,
          createdAt: recentActivityLogs.createdAt,
        })
        .from(recentActivityLogs)
        .where(
          and(
            eq(recentActivityLogs.companyId, userCompanyId),
            or(
              ne(recentActivityLogs.entityType, "vacancy"),
              notExists(
                ctx.db
                  .select({ id: vacancies.id })
                  .from(vacancies)
                  .where(
                    and(
                      eq(vacancies.id, recentActivityLogs.entityId),
                      eq(vacancies.companyId, userCompanyId),
                      eq(vacancies.isInternal, true),
                    ),
                  ),
              ),
            ),
          ),
        )
        .orderBy(desc(recentActivityLogs.createdAt))
        .limit(RECENT_ACTIVITIES_LIMIT)
        .catch(() => []),
    ]);

    const total = totalCandidates[0]?.count ?? 0;
    const hired = hiredCount[0]?.count ?? 0;
    const activeVac = activeVacancies[0]?.count ?? 0;
    const newCand = newCandidates[0]?.count ?? 0;

    const statsCards = [
      {
        title: "Новые отклики",
        value: String(newCand),
        window: "week" as StatWindow,
      },
      {
        title: "Активные вакансии",
        value: String(activeVac),
        window: "total" as StatWindow,
      },
      {
        // Renamed: this has always been every candidate in the company, not the "active" ones.
        title: "Всего кандидатов",
        value: String(total),
        window: "total" as StatWindow,
      },
      {
        title: "Нанято",
        value: String(hired),
        window: "week" as StatWindow,
      },
    ];

    const recentVacancyChannels = await getVacancyPublicationChannels(
      ctx.db,
      recentVacancyRows.map((vacancy) => vacancy.id),
      userCompanyId,
    );

    const recentVacancies = recentVacancyRows.map((v) => ({
      id: v.id,
      title: v.title,
      status: toVacancyStatus(v.status),
      responses: 0,
      areaId: v.areaId ?? "",
      employmentId: v.employmentId ?? "",
      experienceId: v.experienceId ?? "",
      hhVacancyId: v.hhVacancyId ?? null,
      personHunterVacancyId: v.personHunterVacancyId ?? null,
      telegramPostId: v.telegramPostId ?? null,
      publicationChannels: recentVacancyChannels.get(v.id) ?? [],
      publishedAt: undefined as string | undefined,
      source: "local" as const,
    }));

    if (recentVacancyRows.length > 0) {
      // The same helper the vacancy list uses, so the two screens cannot disagree. Counting
      // only the base vacancy's own links here made a vacancy published to Telegram or hh.uz
      // read one number on /vacancies and a smaller one on /dashboard.
      const responseCounts = await getVacancyResponseCounts(
        ctx.db,
        recentVacancyRows.map((vacancy) => vacancy.id),
        userCompanyId,
      );

      for (const vacancy of recentVacancies) {
        vacancy.responses = responseCounts.get(vacancy.id) ?? 0;
      }
    }

    // Build recent activities for dashboard "Последние действия"
    const recentActivities: {
      id: string;
      name: string;
      action: string;
      candidateName: string;
      actorInitials: string;
      newStatus: string;
      time: string;
      isRecent?: boolean;
      isCurrentUser?: boolean;
    }[] = [];

    for (const activity of recentActivityRows) {
      const createdAt = activity.createdAt
        ? new Date(activity.createdAt)
        : new Date();
      const timeAgo = formatTimeAgo(createdAt);

      recentActivities.push({
        id: activity.id,
        name: activity.actorName,
        action: activity.action,
        candidateName: activity.targetName,
        actorInitials: getInitials(activity.actorName),
        newStatus: activity.targetStatus,
        time: timeAgo,
        isRecent: timeAgo === "Только что",
        isCurrentUser: activity.actorUserId === ctx.session.user.id,
      });
    }

    // Compute channel stats from source counts
    const sourceTotal = sourceCounts.reduce((sum, row) => sum + row.count, 0);
    const channelStats = sourceCounts.map((row) => ({
      name: row.source ?? "other",
      count: row.count,
      percentage:
        sourceTotal > 0 ? Math.round((row.count / sourceTotal) * 100) : 0,
    }));

    const statusCountMap = new Map(
      candidateStatusCounts.map((row) => [row.status ?? "new", row.count]),
    );
    const maxStatusValue = Math.max(1, ...statusCountMap.values());
    const statusStats = CANDIDATE_FUNNEL_STATUSES.map((status) => ({
      status,
      value: statusCountMap.get(status) ?? 0,
      max: maxStatusValue,
    }));

    return {
      statsCards,
      recentVacancies,
      recentActivities,
      channelStats,
      statusStats,
    };
  }),
});
