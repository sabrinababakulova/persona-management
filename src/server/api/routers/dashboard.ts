import { count, eq, sql } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { candidates, users, vacancies } from "~/server/db/schema";

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
      recentCandidateRows,
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
      // Recent candidates with activities
      ctx.db
        .select()
        .from(candidates)
        .orderBy(sql`${candidates.createdAt} DESC`)
        .limit(5),
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

    // Build recent activities from candidate activity logs
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

    for (const c of recentCandidateRows) {
      const acts = (c.activities ?? []) as {
        id: string;
        userName: string;
        action: string;
        targetName: string;
        targetStatus: string;
        timeAgo: string;
      }[];
      for (const a of acts) {
        const nameParts = a.targetName.split(" ");
        const initials = nameParts
          .map((p) => p[0])
          .join("")
          .toUpperCase();
        recentActivities.push({
          id: a.id,
          name: a.userName,
          action: a.action,
          candidateName: a.targetName,
          candidateInitials: initials,
          newStatus: a.targetStatus,
          time: a.timeAgo,
          isRecent: a.timeAgo === "Только что",
        });
      }
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
