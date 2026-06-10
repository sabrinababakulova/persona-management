"use client";

import { useState } from "react";
import { InfoIcon } from "~/app/_components/icons";
import { Input } from "~/app/_components/input";
import { api } from "~/trpc/react";
import { ClosableSection } from "../_components/closable-section";

export function TelegramChannelsSection() {
  const [newChannelId, setNewChannelId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [botToken, setBotToken] = useState("");
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenMessage, setTokenMessage] = useState<string | null>(null);

  const utils = api.useUtils();

  const { data: channels, isLoading } =
    api.integrations.getTelegramChannels.useQuery();
  const { data: botSettings, isLoading: isBotSettingsLoading } =
    api.integrations.getTelegramBotSettings.useQuery();

  const saveBotToken = api.integrations.saveTelegramBotToken.useMutation({
    onSuccess: (data) => {
      setBotToken("");
      setError(null);
      setTokenMessage(
        data.botUsername
          ? `Бот @${data.botUsername} подключён`
          : "Бот подключён",
      );
      void utils.integrations.getTelegramBotSettings.invalidate();
      void utils.vacancies.getTelegramConfig.invalidate();
    },
    onError: (err) => {
      setTokenMessage(null);
      setError(err.message);
    },
  });

  const removeBotToken = api.integrations.removeTelegramBotToken.useMutation({
    onSuccess: () => {
      setBotToken("");
      setTokenMessage("Токен удалён");
      setError(null);
      void utils.integrations.getTelegramBotSettings.invalidate();
      void utils.vacancies.getTelegramConfig.invalidate();
    },
    onError: (err) => {
      setTokenMessage(null);
      setError(err.message);
    },
  });

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
    setTokenMessage(null);
    addChannel.mutate({
      channelId: trimmed,
      label: newLabel.trim() || undefined,
    });
  };

  const handleSaveBotToken = () => {
    const trimmed = botToken.trim();
    if (!trimmed) return;
    setError(null);
    setTokenMessage(null);
    saveBotToken.mutate({ botToken: trimmed });
  };

  const title = (
    <span className="flex items-center gap-2">
      Telegram каналы
      <button
        aria-expanded={isHelpOpen}
        aria-label="Как подключить Telegram"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border-input bg-bg-input text-text-secondary transition-colors hover:border-primary-blue hover:bg-white hover:text-primary-blue"
        onClick={(event) => {
          event.stopPropagation();
          setIsHelpOpen((prev) => !prev);
        }}
        title="Как подключить Telegram"
        type="button"
      >
        <InfoIcon className="h-4 w-4" />
      </button>
    </span>
  );

  return (
    <ClosableSection ariaTitle="Telegram каналы" title={title}>
      {isHelpOpen && (
        <div className="space-y-4 rounded-[6px] border border-primary-blue/20 bg-primary-blue-light/40 p-4">
          <div className="space-y-2">
            <p className="font-semibold text-[15px] text-text-heading">
              Как получить токен бота
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-[14px] text-text-secondary leading-[1.5]">
              <li>Откройте Telegram и найдите @BotFather.</li>
              <li>Отправьте команду /newbot и задайте имя бота.</li>
              <li>
                Скопируйте токен формата 123456:ABC... и вставьте его ниже.
              </li>
              <li>Добавьте созданного бота администратором в нужный канал.</li>
            </ol>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex min-h-[150px] items-center justify-center rounded-[6px] border border-border-control border-dashed bg-white px-4 text-center text-[13px] text-text-secondary">
              Место для скриншота BotFather с токеном
            </div>
            <div className="flex min-h-[150px] items-center justify-center rounded-[6px] border border-border-control border-dashed bg-white px-4 text-center text-[13px] text-text-secondary">
              Место для скриншота настроек администратора канала
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-[15px] text-text-heading">
              Как добавить канал
            </p>
            <p className="text-[14px] text-text-secondary leading-[1.5]">
              Для публичного канала вставьте @username или ссылку
              https://t.me/channelname. Для приватного канала можно вставить
              ссылку на любой пост формата https://t.me/c/1234567890/15 —
              система преобразует её в ID -1001234567890. Ссылки-приглашения
              https://t.me/+... не содержат ID канала, поэтому их нельзя
              использовать напрямую.
            </p>
            <div className="flex min-h-[120px] items-center justify-center rounded-[6px] border border-border-control border-dashed bg-white px-4 text-center text-[13px] text-text-secondary">
              Место для скриншота ссылки на пост в канале
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="rounded-[6px] border border-border-input bg-bg-input px-3 py-3">
          <p className="font-medium text-[14px] text-text-heading">
            {isBotSettingsLoading
              ? "Проверяем токен..."
              : botSettings
                ? `Токен подключён: ${botSettings.maskedToken}`
                : "Токен бота не подключён"}
          </p>
          {botSettings?.botUsername && (
            <p className="mt-1 text-[12px] text-text-secondary">
              Бот: @{botSettings.botUsername}
            </p>
          )}
          {botSettings?.source === "env" && (
            <p className="mt-1 text-[12px] text-text-secondary">
              Сейчас используется токен из переменных окружения. Сохраните токен
              здесь, чтобы управлять Telegram из профиля.
            </p>
          )}
        </div>

        <Input
          label="Токен бота"
          onChange={(e) => setBotToken(e.target.value)}
          placeholder="123456789:AA..."
          type="password"
          value={botToken}
        />

        <div className="flex flex-wrap gap-2">
          <button
            className="h-10 rounded-[6px] bg-primary-blue-light px-4 font-semibold text-[14px] text-primary-blue leading-none tracking-[-0.28px] transition-colors hover:bg-primary-blue-light-hover disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saveBotToken.isPending || !botToken.trim()}
            onClick={handleSaveBotToken}
            type="button"
          >
            {saveBotToken.isPending ? "Проверка..." : "Сохранить токен"}
          </button>
          {botSettings?.source === "user" && (
            <button
              className="h-10 rounded-[6px] px-4 font-semibold text-[14px] text-danger-red leading-none transition-colors hover:bg-danger-red-bg disabled:cursor-not-allowed disabled:opacity-60"
              disabled={removeBotToken.isPending}
              onClick={() => removeBotToken.mutate()}
              type="button"
            >
              {removeBotToken.isPending ? "Удаление..." : "Удалить токен"}
            </button>
          )}
        </div>
      </div>

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
          label="ID канала или ссылка"
          onChange={(e) => setNewChannelId(e.target.value)}
          placeholder="@channelname, https://t.me/channelname или -1001234567890"
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
        {tokenMessage && (
          <p className="text-[13px] text-success-green leading-[1.4]">
            {tokenMessage}
          </p>
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
