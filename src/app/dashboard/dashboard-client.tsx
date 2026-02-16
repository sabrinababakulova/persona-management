"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { DonutChart } from "../_components/donut-chart";
import { ProgressBar } from "../_components/progress-bar";
import { StatsCard } from "../_components/stats-card";
import { VacancyRow } from "../_components/vacancy-row";
import { WelcomeModal } from "../_components/welcome-modal";
import { RecentActions } from "./components/recentActions";

export default function DashboardClient() {
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const hasHandledWelcomeModal = useRef(false);

  const utils = api.useUtils();
  const { data: dashboardData, isLoading } =
    api.dashboard.getDashboardData.useQuery();
  const { data: welcomeModalState } =
    api.dashboard.getWelcomeModalState.useQuery();
  const markWelcomeModalSeen = api.dashboard.markWelcomeModalSeen.useMutation({
    onSuccess: async () => {
      await utils.dashboard.getWelcomeModalState.invalidate();
    },
  });

  useEffect(() => {
    if (
      !welcomeModalState?.shouldShowWelcomeModal ||
      hasHandledWelcomeModal.current
    ) {
      return;
    }

    hasHandledWelcomeModal.current = true;
    setIsWelcomeModalOpen(true);
    markWelcomeModalSeen.mutate();
  }, [markWelcomeModalSeen, welcomeModalState?.shouldShowWelcomeModal]);

  const currentDate = new Date().toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-light">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  return (
    <>
      <WelcomeModal
        isOpen={isWelcomeModalOpen}
        onClose={() => setIsWelcomeModalOpen(false)}
      />
      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Dashboard Content */}
        <div className="p-8">
          {/* Welcome Section */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <p className="mb-2 font-medium text-sm text-text-muted uppercase tracking-wider">
                {currentDate}
              </p>
              <h1 className="font-bold text-3xl text-gray-900">
                Добро пожаловать, Керим!
              </h1>
            </div>
            <button
              className="flex items-center gap-2 rounded-lg border border-border-light bg-white px-4 py-2 text-gray-700 hover:bg-bg-light"
              type="button"
            >
              Последние 7 дней
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Chevron Down</title>
                <path
                  d="M19 9l-7 7-7-7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </button>
          </div>

          {/* Stats Cards */}
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {dashboardData?.statsCards.map((stat) => (
              <StatsCard
                change={stat.change}
                changeType={stat.changeType}
                key={stat.title}
                period={stat.period}
                title={stat.title}
                value={stat.value}
              />
            ))}
          </div>

          {/* Recent Vacancies */}
          <div className="mb-8 rounded-2xl border border-border-light bg-white">
            <div className="flex items-center justify-between border-border-light border-b px-6 py-4">
              <h2 className="font-semibold text-gray-900 text-lg">
                Последние вакансии
              </h2>
              <button
                className="flex items-center gap-1 text-primary-blue hover:underline"
                type="button"
              >
                Смотреть все
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>Arrow Right</title>
                  <path
                    d="M9 5l7 7-7 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </button>
            </div>
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 border-border-light border-b bg-bg-light px-6 py-3 font-medium text-sm text-text-muted">
              <div className="col-span-3 flex items-center gap-1">
                Название
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>Sort</title>
                  <path
                    d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </div>
              <div className="col-span-2 flex items-center gap-1">
                Статус
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>Sort</title>
                  <path
                    d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </div>
              <div className="col-span-2 flex items-center gap-1">
                Город
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>Sort</title>
                  <path
                    d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </div>
              <div className="col-span-2 flex items-center gap-1">
                Отклики
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>Sort</title>
                  <path
                    d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </div>
              <div className="col-span-2 flex items-center gap-1">
                Тип работы
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>Sort</title>
                  <path
                    d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </div>
              <div className="col-span-1" />
            </div>
            {/* Table Rows */}
            {dashboardData?.recentVacancies.map((vacancy) => (
              <VacancyRow
                city={vacancy.city}
                key={vacancy.id}
                responses={vacancy.responses}
                status={vacancy.status}
                subtitle={vacancy.subtitle}
                title={vacancy.title}
                workType={vacancy.workType}
              />
            ))}
          </div>

          {/* Candidates Section */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-lg">Кандидаты</h2>
              <button
                className="flex items-center gap-1 text-primary-blue hover:underline"
                type="button"
              >
                Смотреть все
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>Arrow Right</title>
                  <path
                    d="M9 5l7 7-7 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Channel Statistics */}
              <div className="rounded-2xl border border-border-light bg-white p-6">
                <h3 className="mb-6 font-medium text-gray-900">
                  Статистика по каналам
                </h3>
                <div className="flex items-center gap-6">
                  <DonutChart />
                  <div className="flex-1 space-y-3">
                    {dashboardData?.channelStats.map((channel) => (
                      <div
                        className="flex items-center justify-between"
                        key={channel.name}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-3 w-3 rounded ${channel.color}`}
                          />
                          <span className="text-gray-700 text-sm">
                            {channel.name}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900 text-sm">
                          {channel.percentage}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <RecentActions
                recentActivities={dashboardData?.recentActivities}
              />

              {/* Status Statistics */}
              <div className="rounded-2xl border border-border-light bg-white p-6">
                <h3 className="mb-6 font-medium text-gray-900">
                  Статистика по статусу
                </h3>
                <div className="space-y-4">
                  {dashboardData?.statusStats.map((stat) => (
                    <ProgressBar
                      key={stat.label}
                      label={stat.label}
                      max={stat.max}
                      value={stat.value}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
