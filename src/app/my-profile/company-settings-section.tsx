"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { api } from "~/trpc/react";
import { DataMigrationLoadingScreen } from "../_components/data-migration-loading-screen";
import { HhAccountSection } from "../_components/hh-account-section";
import { OlxAccountSection } from "../_components/olx-account-section";
import { TelegramChannelsSection } from "../_components/telegram-channels-section";

export function CompanySettingsSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = api.useUtils();

  // Set by the hh.uz OAuth callback right after a connect/reconnect.
  const justConnected = searchParams.get("hh_connected") === "1";
  const [isMigrating, setIsMigrating] = useState(justConnected);
  const migrationStarted = useRef(false);

  const runMigration = api.candidates.syncHh.useMutation().mutateAsync;

  useEffect(() => {
    if (!justConnected || migrationStarted.current) {
      return;
    }
    migrationStarted.current = true;
    setIsMigrating(true);

    runMigration()
      .catch((error) => {
        console.error("hh.uz data migration failed", error);
      })
      .finally(() => {
        setIsMigrating(false);
        void utils.candidates.invalidate();
        void utils.integrations.getHhAccount.invalidate();
        // Drop the one-shot query param so a refresh does not re-run the sync.
        router.replace("/my-profile?section=company-settings");
      });
  }, [justConnected, runMigration, router, utils]);

  return (
    <div className="space-y-10">
      <DataMigrationLoadingScreen isLoading={isMigrating} />
      <TelegramChannelsSection />
      <HhAccountSection />
      <OlxAccountSection />
    </div>
  );
}
