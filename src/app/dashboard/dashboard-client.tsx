"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";
import { ChevronRightIcon } from "../_components/icons";
import { StatsCard } from "../_components/stats-card";
import { VacancyTable } from "../_components/vacancy-table";
import { WelcomeModal } from "../_components/welcome-modal";
import { ChannelStatistics } from "./components/channelStatistics";
import { RecentActions } from "./components/recentActions";
import { StatusStatistics } from "./components/statusStatistics";
import { DashboardPageSkeleton } from "./dashboard-page-skeleton";

export default function DashboardClient({ userName }: { userName: string }) {
  const t = useTranslations("Dashboard");
  const format = useFormatter();
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
    // Deliberately silent: this only records that a cosmetic modal was
    // dismissed. The worst case is seeing the welcome modal again, which does
    // not warrant interrupting the user with an error.
    meta: { errorHandled: true },
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

  const currentDate = format.dateTime(new Date(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const statKeys = [
    "newApplications",
    "activeVacancies",
    "activeCandidates",
    "hired",
  ] as const;

  if (isLoading) {
    return <DashboardPageSkeleton />;
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
            <h1 className="page-title">
              {t("welcome")} {userName}!
            </h1>
          </div>

          {/* Stats Cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {dashboardData?.statsCards.map((stat, index) => (
              <StatsCard
                key={stat.title}
                period={t("lastSevenDays")}
                title={statKeys[index] ? t(statKeys[index]) : stat.title}
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
                {t("showAll")}
                <ChevronRightIcon className="h-4 w-4" />
              </Link>
            }
            items={dashboardData?.recentVacancies ?? []}
            title={t("recentVacancies")}
            titleBarClassName="border-border-light"
            vacancyStatusOptions={[]}
          />

          {/* Candidates Section */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="section-title">{t("candidates")}</h2>
              <Link
                className="flex items-center gap-1 text-primary-blue hover:underline"
                href="/candidates"
              >
                {t("showAll")}
                <ChevronRightIcon className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,0.96fr)_minmax(0,1.08fr)_minmax(0,0.96fr)]">
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
