"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { StatsCard } from "../_components/stats-card";
import { VacancyRow } from "../_components/vacancy-row";
import { WelcomeModal } from "../_components/welcome-modal";
import { ChannelStatistics } from "./components/channelStatistics";
import { RecentActions } from "./components/recentActions";
import { StatusStatistics } from "./components/statusStatistics";

export default function DashboardClient({ userName }: { userName: string }) {
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

  const markSeenRef = useRef(markWelcomeModalSeen);
  markSeenRef.current = markWelcomeModalSeen;

  useEffect(() => {
    if (
      !welcomeModalState?.shouldShowWelcomeModal ||
      hasHandledWelcomeModal.current
    ) {
      return;
    }

    hasHandledWelcomeModal.current = true;
    setIsWelcomeModalOpen(true);
    markSeenRef.current.mutate();
  }, [welcomeModalState?.shouldShowWelcomeModal]);

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
                Добро пожаловать, {userName}!
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
              <Link
                className="flex items-center gap-1 text-primary-blue hover:underline"
                href="/vacancies"
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
              </Link>
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
              <Link
                className="flex items-center gap-1 text-primary-blue hover:underline"
                href="/candidates"
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
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <ChannelStatistics channelStats={dashboardData?.channelStats} />

              <RecentActions
                recentActivities={dashboardData?.recentActivities}
              />

              <StatusStatistics statusStats={dashboardData?.statusStats} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
