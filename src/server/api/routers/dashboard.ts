import { count, desc, eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  candidates,
  recentActivityLogs,
  users,
  vacancies,
} from "~/server/db/schema";

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
    // Fetch real counts from the database
    const [
      totalCandidates,
      hiredCount,
      activeVacancies,
      newCandidates,
      statusCounts,
      sourceCounts,
      recentVacancyRows,
      recentActivityRows,
    ] = await Promise.all([
      ctx.db.select({ count: count() }).from(candidates),
      ctx.db
        .select({ count: count() })
        .from(candidates)
        .where(eq(candidates.status, "hired")),
      ctx.db
        .select({ count: count() })
        .from(vacancies)
        .where(eq(vacancies.status, "active")),
      ctx.db
        .select({ count: count() })
        .from(candidates)
        .where(eq(candidates.status, "new")),
      // Count by status
      ctx.db
        .select({
          status: candidates.status,
          count: count(),
        })
        .from(candidates)
        .groupBy(candidates.status),
      // Count by source
      ctx.db
        .select({
          source: candidates.source,
          count: count(),
        })
        .from(candidates)
        .groupBy(candidates.source),
      // Recent vacancies
      ctx.db
        .select()
        .from(vacancies)
        .where(eq(vacancies.status, "active"))
        .limit(3),
      // Recent activity events from candidate/vacancy updates
      ctx.db
        .select()
        .from(recentActivityLogs)
        .orderBy(desc(recentActivityLogs.createdAt))
        .limit(20)
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
        change: "15%",
        changeType: "positive" as const,
        period: "за последние 7 дней",
      },
      {
        title: "Активные вакансии",
        value: String(activeVac),
        change: "9%",
        changeType: "neutral" as const,
        period: "за последние 7 дней",
      },
      {
        title: "Активные кандидаты",
        value: String(total),
        change: "65%",
        changeType: "negative" as const,
        period: "за последние 7 дней",
      },
      {
        title: "Нанято",
        value: String(hired),
        change: "2%",
        changeType: "positive" as const,
        period: "за последние 7 дней",
      },
    ];

    const recentVacancies = recentVacancyRows.map((v) => ({
      id: v.id,
      title: v.title,
      subtitle: "Название",
      status: (v.status ?? "active").toUpperCase(),
      city: v.city ?? "",
      responses: v.responses ?? 0,
      workType: v.workType ?? "",
    }));

    // Build recent activities for dashboard "Последние действия"
    const recentActivities: {
      id: string;
      name: string;
      action: string;
      candidateName: string;
      candidateInitials: string;
      newStatus: string;
      time: string;
      isRecent?: boolean;
    }[] = [];

    for (const activity of recentActivityRows.slice(0, 10)) {
      const createdAt = activity.createdAt
        ? new Date(activity.createdAt)
        : new Date();
      const timeAgo = formatTimeAgo(createdAt);

      recentActivities.push({
        id: activity.id,
        name: activity.actorName,
        action: activity.action,
        candidateName: activity.targetName,
        candidateInitials: getInitials(activity.targetName),
        newStatus: activity.targetStatus,
        time: timeAgo,
        isRecent: timeAgo === "Только что",
      });
    }

    // Compute channel stats from source counts
    const sourceTotal = sourceCounts.reduce((s, r) => s + r.count, 0) || 1;
    const colorMap: Record<string, string> = {
      "hh.uz": "bg-chart-pink",
      telegram: "bg-chart-purple",
      linkedin: "bg-chart-orange",
      referral: "bg-chart-blue",
      other: "bg-chart-blue",
    };
    const channelStats = sourceCounts
      .filter((r): r is typeof r & { source: string } => Boolean(r.source))
      .map((r) => ({
        name: r.source,
        percentage: Math.round((r.count / sourceTotal) * 100),
        color: colorMap[r.source] ?? "bg-chart-blue",
      }));

    // Compute status stats from status counts
    const statusLabelMap: Record<string, string> = {
      new: "Новый",
      screening: "Отобран",
      interview: "Интервью",
      offer: "Оффер",
      hired: "Нанят",
      rejected: "Отказ",
    };
    const statusOrder = [
      "new",
      "screening",
      "interview",
      "offer",
      "hired",
      "rejected",
    ];
    const statusCountMap = new Map(
      statusCounts.map((r) => [r.status, r.count]),
    );
    const statusStats = statusOrder.map((s) => ({
      label: statusLabelMap[s] ?? s,
      value: statusCountMap.get(s) ?? 0,
      max: total || 1,
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
