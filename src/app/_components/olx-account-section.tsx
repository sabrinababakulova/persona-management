"use client";

import { useSearchParams } from "next/navigation";

import { api } from "~/trpc/react";
import { ClosableSection } from "./closable-section";
import {
  FeedbackPresence,
  LoadingButtonContent,
  LoadingState,
} from "./motion-system";

const OLX_ERROR_MESSAGES: Record<string, string> = {
  denied: "Авторизация OLX.uz отменена.",
  failed:
    "Не удалось подключить OLX.uz. Проверьте callback URL и права приложения.",
  not_configured:
    "OLX.uz не настроен на сервере: добавьте Client ID и Client Secret.",
};

export function OlxAccountSection() {
  const searchParams = useSearchParams();
  const utils = api.useUtils();
  const { data, error, isError, isLoading } =
    api.integrations.getOlxAccount.useQuery();
  const removeAccount = api.integrations.removeOlxAccount.useMutation({
    onSuccess: () => {
      void utils.integrations.getOlxAccount.invalidate();
    },
  });

  const account = data?.account;
  const isConnected = Boolean(account?.hasTokens);
  const isConfigured = Boolean(data?.configured);
  const outcomeMessage = searchParams.get("olx_connected")
    ? "OLX.uz подключен."
    : OLX_ERROR_MESSAGES[searchParams.get("olx_error") ?? ""];

  return (
    <ClosableSection title="OLX.uz аккаунт">
      {isLoading ? (
        <LoadingState compact label="Проверяем подключение..." />
      ) : null}

      <FeedbackPresence show={Boolean(outcomeMessage)}>
        <div
          className={`rounded-lg border px-3 py-3 text-sm ${
            searchParams.get("olx_connected")
              ? "border-success-green bg-status-active-bg text-success-green"
              : "border-danger-red bg-status-closed-bg text-danger-red"
          }`}
        >
          {outcomeMessage}
        </div>
      </FeedbackPresence>

      <FeedbackPresence show={isError}>
        <div className="rounded-lg border border-danger-red bg-status-closed-bg px-3 py-3 text-danger-red text-sm leading-5">
          {error?.message ?? "Не удалось проверить подключение OLX.uz."}
        </div>
      </FeedbackPresence>

      {!isLoading && isConnected && account ? (
        <div className="space-y-1 rounded-lg border border-border-input bg-bg-input px-3 py-3">
          <p className="text-sm text-text-heading">
            <span className="font-medium">Статус:</span>{" "}
            <span className="text-success-green">Подключен</span>
          </p>
          <p className="text-text-secondary text-xs">
            OLX User ID: {account.olxUserId}
          </p>
          {account.name ? (
            <p className="text-text-secondary text-xs">{account.name}</p>
          ) : null}
          {account.email ? (
            <p className="text-text-secondary text-xs">{account.email}</p>
          ) : null}
          {!account.isBusiness ? (
            <p className="mt-2 text-status-paused text-xs leading-[1.4]">
              Аккаунт не отмечен OLX как бизнес-аккаунт. Платные вакансии могут
              потребовать бизнес-пакет.
            </p>
          ) : null}
        </div>
      ) : null}

      {!isLoading && !isError && !isConfigured ? (
        <div className="rounded-lg border border-status-paused bg-status-paused-bg px-3 py-3">
          <p className="font-medium text-sm text-status-paused">
            Канал OLX.uz подготовлен, но пока недоступен.
          </p>
          <p className="mt-1 text-text-secondary text-xs leading-[1.4]">
            После выдачи OLX.uz Partner API credentials добавьте OLX_CLIENT_ID,
            OLX_CLIENT_SECRET и OLX_REDIRECT_URI на сервере. Кнопка подключения
            станет доступна автоматически.
          </p>
        </div>
      ) : null}

      {!isLoading && !isError && isConfigured && !isConnected ? (
        <div className="rounded-lg border border-border-input bg-bg-input px-3 py-3">
          <p className="text-sm text-text-heading">
            Подключите рабочий аккаунт OLX.uz через OAuth.
          </p>
          <p className="mt-1 text-text-secondary text-xs leading-[1.4]">
            Приложению нужны права read, write и v2. Пароль OLX в Persona не
            сохраняется.
          </p>
        </div>
      ) : null}

      <div className="flex gap-3">
        <a
          aria-disabled={!isConfigured}
          className={`ui-button ui-button-soft ${
            isConfigured ? "" : "pointer-events-none opacity-50"
          }`}
          href="/api/integrations/olx/connect"
        >
          {isConnected ? "Переподключить OLX.uz" : "Подключить OLX.uz"}
        </a>

        {account ? (
          <button
            className="h-10 rounded-lg border border-danger-red px-4 font-semibold text-danger-red text-sm leading-none transition-colors hover:bg-danger-red-bg disabled:cursor-not-allowed disabled:opacity-60"
            disabled={removeAccount.isPending}
            onClick={() => removeAccount.mutate()}
            type="button"
          >
            <LoadingButtonContent
              isLoading={removeAccount.isPending}
              label="Отключить"
              loadingLabel="Отключение..."
            />
          </button>
        ) : null}
      </div>
    </ClosableSection>
  );
}
