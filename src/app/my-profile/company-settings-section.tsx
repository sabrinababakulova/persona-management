"use client";

import { HhAccountSection } from "../_components/hh-account-section";
import { TelegramChannelsSection } from "../_components/telegram-channels-section";

export function CompanySettingsSection() {
  return (
    <div className="mt-12 space-y-10">
      <TelegramChannelsSection />
      <HhAccountSection />
    </div>
  );
}
