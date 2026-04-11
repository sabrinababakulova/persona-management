"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { ChevronRightIcon, SortIcon } from "../_components/icons";
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
          <div className="mb-8">
            <p className="mb-2 font-medium text-sm text-text-muted uppercase tracking-wider">
              {currentDate}
            </p>
            <h1 className="font-bold text-3xl text-gray-900">
              Добро пожаловать, {userName}!
            </h1>
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
                <ChevronRightIcon className="h-4 w-4" />
              </Link>
            </div>
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 border-border-light border-b bg-bg-light px-6 py-3 font-medium text-sm text-text-muted">
              <div className="col-span-3 flex items-center gap-1">
                Название
                <SortIcon className="h-4 w-4" />
              </div>
              <div className="col-span-2 flex items-center gap-1">
                Статус
                <SortIcon className="h-4 w-4" />
              </div>
              <div className="col-span-2 flex items-center gap-1">
                Город
                <SortIcon className="h-4 w-4" />
              </div>
              <div className="col-span-2 flex items-center gap-1">
                Отклики
                <SortIcon className="h-4 w-4" />
              </div>
              <div className="col-span-2 flex items-center gap-1">
                Тип работы
                <SortIcon className="h-4 w-4" />
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
                <ChevronRightIcon className="h-4 w-4" />
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
