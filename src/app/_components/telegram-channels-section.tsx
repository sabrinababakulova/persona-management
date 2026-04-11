"use client";

import { useState } from "react";
import { Input } from "~/app/_components/input";
import { api } from "~/trpc/react";
import { ClosableSection } from "../_components/closable-section";

export function TelegramChannelsSection() {
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
    <ClosableSection title="Telegram каналы">
      {isLoading && (
        <p className="text-[14px] text-text-secondary">Загрузка...</p>
      )}

      {channels && channels.length > 0 && (
        <div className="space-y-2">
          {channels.map((ch) => (
            <div
              className="flex items-center justify-between rounded-[6px] border border-border-input bg-bg-input px-3 py-2"
              key={ch.id}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[14px] text-text-heading">
                  {ch.channelId}
                </p>
                {ch.label && (
                  <p className="truncate text-[12px] text-text-secondary">
                    {ch.label}
                  </p>
                )}
              </div>
              <button
                className="ml-3 shrink-0 rounded px-2 py-1 text-[13px] text-danger-red transition-colors hover:bg-danger-red-bg disabled:opacity-50"
                disabled={removeChannel.isPending}
                onClick={() => removeChannel.mutate({ id: ch.id })}
                type="button"
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      )}

      {channels && channels.length === 0 && (
        <p className="text-[14px] text-text-secondary">
          Нет добавленных каналов
        </p>
      )}

      <div className="space-y-3">
        <Input
          label="ID канала"
          onChange={(e) => setNewChannelId(e.target.value)}
          placeholder="@channelname или -1001234567890"
          value={newChannelId}
        />
        <Input
          label="Название (необязательно)"
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Например: Вакансии IT"
          value={newLabel}
        />

        {error && (
          <p className="text-[13px] text-danger-red leading-[1.4]">{error}</p>
        )}

        <button
          className="h-10 rounded-[6px] bg-primary-blue-light px-4 font-semibold text-[14px] text-primary-blue leading-none tracking-[-0.28px] transition-colors hover:bg-primary-blue-light-hover disabled:cursor-not-allowed disabled:opacity-60"
          disabled={addChannel.isPending || !newChannelId.trim()}
          onClick={handleAdd}
          type="button"
        >
          {addChannel.isPending ? "Добавление..." : "Добавить канал"}
        </button>
      </div>
    </ClosableSection>
  );
}
