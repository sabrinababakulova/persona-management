import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

// Types for dashboard data
const _statsCardSchema = z.object({
  title: z.string(),
  value: z.string(),
  change: z.string(),
  changeType: z.enum(["positive", "negative", "neutral"]),
  period: z.string(),
});

const _recentVacancySchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  status: z.string(),
  city: z.string(),
  responses: z.number(),
  workType: z.string(),
});

const _activityItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  action: z.string(),
  candidateName: z.string(),
  candidateInitials: z.string(),
  newStatus: z.string(),
  time: z.string(),
  isRecent: z.boolean().optional(),
});

const _channelStatSchema = z.object({
  name: z.string(),
  percentage: z.number(),
  color: z.string(),
});

const _statusStatSchema = z.object({
  label: z.string(),
  value: z.number(),
  max: z.number(),
});

export const dashboardRouter = createTRPCRouter({
  getDashboardData: publicProcedure.query(async () => {
    // Mock data for stats cards
    const statsCards = [
      {
        title: "Новые отклики",
        value: "22",
        change: "15%",
        changeType: "positive" as const,
        period: "за последние 7 дней",
      },
      {
        title: "Активные вакансии",
        value: "8",
        change: "9%",
        changeType: "neutral" as const,
        period: "за последние 7 дней",
      },
      {
        title: "Активные кандидаты",
        value: "154",
        change: "65%",
        changeType: "negative" as const,
        period: "за последние 7 дней",
      },
      {
        title: "Нанято",
        value: "65",
        change: "2%",
        changeType: "positive" as const,
        period: "за последние 7 дней",
      },
    ];

    // Mock data for recent vacancies
    const recentVacancies = [
      {
        id: "1",
        title: "Senior Java Engineer",
        subtitle: "Название",
        status: "ACTIVE",
        city: "Ташкент",
        responses: 24,
        workType: "Гибрид",
      },
      {
        id: "2",
        title: "Product Manager",
        subtitle: "Название",
        status: "ACTIVE",
        city: "Ташкент",
        responses: 24,
        workType: "Гибрид",
      },
      {
        id: "3",
        title: "Data Scientist",
        subtitle: "Название",
        status: "ACTIVE",
        city: "Ташкент",
        responses: 24,
        workType: "Гибрид",
      },
    ];

    // Mock data for recent activities
    const recentActivities = [
      {
        id: "1",
        name: "Эльвира Ахметова",
        action: "Изменил(а) статус кандидата",
        candidateName: "Ахмедова А. А",
        candidateInitials: "АА",
        newStatus: "Нанят",
        time: "Только что",
        isRecent: true,
      },
      {
        id: "2",
        name: "Анна Иванова",
        action: "Изменил(а) статус кандидата",
        candidateName: "Мамасаидов М. М",
        candidateInitials: "ММ",
        newStatus: "Архивирован",
        time: "1 день назад",
        isRecent: false,
      },
    ];

    // Mock data for channel statistics
    const channelStats = [
      { name: "hh.uz", percentage: 45, color: "bg-chart-pink" },
      { name: "telegram", percentage: 45, color: "bg-chart-purple" },
      { name: "rabota.uz", percentage: 45, color: "bg-chart-orange" },
      { name: "Другие", percentage: 45, color: "bg-chart-blue" },
    ];

    // Mock data for status statistics
    const statusStats = [
      { label: "Новый", value: 34, max: 154 },
      { label: "Отобран", value: 55, max: 154 },
      { label: "Интервью", value: 154, max: 154 },
      { label: "Оффер", value: 40, max: 154 },
      { label: "Нанят", value: 54, max: 154 },
      { label: "Отказ", value: 12, max: 154 },
    ];

    return {
      statsCards,
      recentVacancies,
      recentActivities,
      channelStats,
      statusStats,
    };
  }),
});
