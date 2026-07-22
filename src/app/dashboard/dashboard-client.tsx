"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { ChevronRightIcon } from "../_components/icons";
import { LoadingState } from "../_components/motion-system";
import { StatsCard } from "../_components/stats-card";
import { VacancyTable } from "../_components/vacancy-table";
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
      <div className="flex h-full min-h-0 items-center justify-center bg-bg-canvas">
        <LoadingState label="Готовим рабочий стол..." />
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
        <div className="app-page">
          {/* Welcome Section */}
          <div className="mb-6">
            <p className="mb-1.5 font-semibold text-text-muted text-xs uppercase tracking-wider">
              {currentDate}
            </p>
            <h1 className="page-title">Добро пожаловать, {userName}!</h1>
          </div>

          {/* Stats Cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          <VacancyTable
            bodyClassName="overflow-none"
            columnHeaderClassName="border-border-light px-4 py-3"
            containerClassName="mb-6 flex-none rounded-xl border-border-light"
            headerAction={
              <Link
                className="flex items-center gap-1 text-primary-blue hover:underline"
                href="/vacancies"
              >
                Смотреть все
                <ChevronRightIcon className="h-4 w-4" />
              </Link>
            }
            items={dashboardData?.recentVacancies ?? []}
            title="Последние вакансии"
            titleBarClassName="border-border-light"
            vacancyStatusOptions={[]}
          />

          {/* Candidates Section */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title">Кандидаты</h2>
              <Link
                className="flex items-center gap-1 text-primary-blue hover:underline"
                href="/candidates"
              >
                Смотреть все
                <ChevronRightIcon className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
