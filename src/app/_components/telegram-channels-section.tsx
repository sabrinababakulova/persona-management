"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { api } from "~/trpc/react";
import { ClosableSection } from "../_components/closable-section";
import { SkeletonBlock } from "../_components/page-skeleton";
import { PlusIcon } from "./icons";
import {
  type ChannelDraft,
  TelegramChannelModal,
} from "./telegram-channel-modal";
import { useErrorToast } from "./use-error-toast";

export function TelegramChannelsSection() {
  const t = useTranslations("Integrations");
  const utils = api.useUtils();
  const showError = useErrorToast();

  // `null` closes the modal; a draft opens it (empty draft = adding).
  const [editing, setEditing] = useState<ChannelDraft | null>(null);

  const { data: channels, isLoading } =
    api.integrations.getTelegramChannels.useQuery();

  const removeChannel = api.integrations.removeTelegramChannel.useMutation({
    onSuccess: () => {
      void utils.integrations.getTelegramChannels.invalidate();
    },
    onError: (error) => showError(error, { dedupeKey: "remove-tg-channel" }),
  });

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
          {channels.map((channel) => (
            <div
              className="flex items-start justify-between gap-3 rounded-lg border border-border-input bg-bg-input px-3 py-2"
              key={channel.id}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-sm text-text-heading">
                  {channel.title ?? channel.channelId}
                </p>
                <p className="truncate text-text-secondary text-xs">
                  {channel.label ? `${channel.label} · ` : ""}
                  {channel.deliveryMode === "direct"
                    ? t("deliveryDirect")
                    : t("deliveryAdmins")}
                </p>

                {channel.deliveryMode === "admins" &&
                channel.admins.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {channel.admins.map((admin) => (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                          admin.isActivated
                            ? "bg-success-green-bg text-success-green"
                            : "bg-warning-yellow-bg text-text-heading"
                        }`}
                        key={admin.id}
                        // The warning state is the actionable one: an admin who
                        // never pressed /start cannot be sent anything.
                        title={
                          admin.isActivated
                            ? t("adminActivated")
                            : t("adminNotActivated")
                        }
                      >
                        @{admin.username}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  className="rounded px-2 py-1 text-primary-blue text-xs transition-colors hover:bg-bg-hover"
                  onClick={() =>
                    setEditing({
                      id: channel.id,
                      channelId: channel.channelId,
                      label: channel.label ?? "",
                      deliveryMode: channel.deliveryMode,
                      admins: channel.admins.map((admin) => ({
                        key: admin.id,
                        username: admin.username,
                        name: admin.name ?? "",
                        isActivated: admin.isActivated,
                      })),
                    })
                  }
                  type="button"
                >
                  {t("edit")}
                </button>
                <button
                  className="rounded px-2 py-1 text-danger-red text-xs transition-colors hover:bg-danger-red-bg disabled:opacity-50"
                  disabled={removeChannel.isPending}
                  onClick={() => removeChannel.mutate({ id: channel.id })}
                  type="button"
                >
                  {t("delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {channels && channels.length === 0 && (
        <p className="text-sm text-text-secondary">{t("noChannels")}</p>
      )}

      <button
        className="ui-button ui-button-soft inline-flex items-center gap-1.5"
        onClick={() =>
          setEditing({
            channelId: "",
            label: "",
            deliveryMode: "direct",
            admins: [],
          })
        }
        type="button"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        {t("addChannel")}
      </button>

      {editing ? (
        <TelegramChannelModal
          initialValue={editing}
          isOpen
          // Remounting per channel resets the modal's internal draft, so
          // reopening never shows the previously edited channel's values.
          key={editing.id ?? "new"}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </ClosableSection>
  );
}
