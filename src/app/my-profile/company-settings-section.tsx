"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { api } from "~/trpc/react";
import { DataMigrationLoadingScreen } from "../_components/data-migration-loading-screen";
import { HhAccountSection } from "../_components/hh-account-section";
import { OlxAccountSection } from "../_components/olx-account-section";
import { TelegramChannelsSection } from "../_components/telegram-channels-section";
import { useErrorToast } from "../_components/use-error-toast";
import { CompanyInviteSection } from "./company-invite-section";
import { CompanyProfileSection } from "./company-profile-section";

type CompanySettingsSectionProps = {
  canEditCompany: boolean;
};

export function CompanySettingsSection({
  canEditCompany,
}: CompanySettingsSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = api.useUtils();
  const t = useTranslations("Integrations");
  const showError = useErrorToast();

  // Set by the hh.uz OAuth callback right after a connect/reconnect.
  const justConnected = searchParams.get("hh_connected") === "1";
  const [isMigrating, setIsMigrating] = useState(justConnected);
  const migrationStarted = useRef(false);

  // Reported explicitly below: a failed initial sync otherwise just ends the
  // loading screen, leaving the user to believe their hh.uz data was imported.
  const runMigration = api.candidates.syncHh.useMutation({
    meta: { errorHandled: true },
  }).mutateAsync;

  useEffect(() => {
    if (!justConnected || migrationStarted.current) {
      return;
    }
    migrationStarted.current = true;
    setIsMigrating(true);

    runMigration()
      .catch((error) => {
        console.error("hh.uz data migration failed", error);
        showError(error, { fallbackMessage: t("migrationFailed") });
      })
      .finally(() => {
        setIsMigrating(false);
        void utils.candidates.invalidate();
        void utils.integrations.getHhAccount.invalidate();
        // Drop the one-shot query param so a refresh does not re-run the sync.
        router.replace("/my-profile?section=company-settings");
      });
  }, [justConnected, runMigration, router, utils, showError, t]);

  return (
    <div className="space-y-10">
      <DataMigrationLoadingScreen isLoading={isMigrating} />
      <CompanyProfileSection canEditCompany={canEditCompany} />
      <CompanyInviteSection canEditCompany={canEditCompany} />
      <TelegramChannelsSection />
      <HhAccountSection />
      <OlxAccountSection />
    </div>
  );
}
