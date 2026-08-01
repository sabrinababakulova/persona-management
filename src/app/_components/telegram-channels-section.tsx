"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Input } from "~/app/_components/input";
import { api } from "~/trpc/react";
import { ClosableSection } from "../_components/closable-section";
import {
  FeedbackPresence,
  LoadingButtonContent,
} from "../_components/motion-system";
import { SkeletonBlock } from "../_components/page-skeleton";

export function TelegramChannelsSection() {
  const t = useTranslations("Integrations");
  const [newChannelId, setNewChannelId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const utils = api.useUtils();

  const { data: channels, isLoading } =
    api.integrations.getTelegramChannels.useQuery();

  const addChannel = api.integrations.addTelegramChannel.useMutation({
    onSuccess: () => {
      setNewChannelId("");
      setNewLabel("");
      setError(null);
      void utils.integrations.getTelegramChannels.invalidate();
    },
    onError: (err) => setError(err.message),
  });

  const removeChannel = api.integrations.removeTelegramChannel.useMutation({
    onSuccess: () => {
      void utils.integrations.getTelegramChannels.invalidate();
    },
    onError: (err) => setError(err.message),
  });

  const handleAdd = () => {
    const trimmed = newChannelId.trim();
    if (!trimmed) return;
    setError(null);
    addChannel.mutate({
      channelId: trimmed,
      label: newLabel.trim() || undefined,
    });
  };

  return (
    <ClosableSection title={t("telegramChannels")}>
      {isLoading ? (
        <div aria-busy="true" className="space-y-2">
          <SkeletonBlock className="h-14 w-full" />
          <SkeletonBlock className="h-14 w-full" />
        </div>
      ) : null}

      {channels && channels.length > 0 && (
        <div className="space-y-2">
          {channels.map((ch) => (
            <div
              className="flex items-center justify-between rounded-lg border border-border-input bg-bg-input px-3 py-2"
              key={ch.id}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-sm text-text-heading">
                  {ch.channelId}
                </p>
                {ch.label && (
                  <p className="truncate text-text-secondary text-xs">
                    {ch.label}
                  </p>
                )}
              </div>
              <button
                className="ml-3 shrink-0 rounded px-2 py-1 text-danger-red text-xs transition-colors hover:bg-danger-red-bg disabled:opacity-50"
                disabled={removeChannel.isPending}
                onClick={() => removeChannel.mutate({ id: ch.id })}
                type="button"
              >
                {t("delete")}
              </button>
            </div>
          ))}
        </div>
      )}

      {channels && channels.length === 0 && (
        <p className="text-sm text-text-secondary">{t("noChannels")}</p>
      )}

      <div className="space-y-3">
        <Input
          label={t("channelId")}
          onChange={(e) => setNewChannelId(e.target.value)}
          placeholder={t("channelIdPlaceholder")}
          value={newChannelId}
        />
        <Input
          label={t("optionalName")}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder={t("channelNamePlaceholder")}
          value={newLabel}
        />

        <FeedbackPresence show={Boolean(error)}>
          <p className="text-danger-red text-xs leading-[1.4]">{error}</p>
        </FeedbackPresence>

        <button
          className="ui-button ui-button-soft"
          disabled={addChannel.isPending || !newChannelId.trim()}
          onClick={handleAdd}
          type="button"
        >
          <LoadingButtonContent
            isLoading={addChannel.isPending}
            label={t("addChannel")}
            loadingLabel={t("adding")}
          />
        </button>
      </div>
    </ClosableSection>
  );
}
