"use client";

import { api } from "~/trpc/react";
import { ClosableSection } from "../_components/closable-section";
import {
  LoadingButtonContent,
  LoadingState,
} from "../_components/motion-system";

export function HhAccountSection() {
  const utils = api.useUtils();

  const { data: account, isLoading } = api.integrations.getHhAccount.useQuery();

  const removeAccount = api.integrations.removeHhAccount.useMutation({
    onSuccess: () => {
      void utils.integrations.getHhAccount.invalidate();
    },
  });

  const isConnected = !!account?.hasTokens && !!account?.employerId;

  return (
    <ClosableSection title="hh.uz аккаунт">
      {isLoading ? (
        <LoadingState compact label="Проверяем подключение..." />
      ) : null}

      {!isLoading && isConnected && (
        <div className="space-y-1 rounded-lg border border-border-input bg-bg-input px-3 py-3">
          <p className="text-sm text-text-heading">
            <span className="font-medium">Статус:</span>{" "}
            <span className="text-success-green">Подключен</span>
          </p>
          <p className="text-text-secondary text-xs">
            Employer ID: {account.employerId}
          </p>
          {account.email && (
            <p className="text-text-secondary text-xs">
              Email: {account.email}
            </p>
          )}
        </div>
      )}

      {!isLoading && !isConnected && (
        <div className="rounded-lg border border-border-input bg-bg-input px-3 py-3">
          <p className="text-sm text-text-heading">
            Подключите hh.uz через OAuth.
          </p>
          <p className="mt-1 text-text-secondary text-xs leading-[1.4]">
            Client ID и Client Secret берутся из серверных переменных окружения.
            Employer ID определяется автоматически после авторизации в hh.uz.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <a
          className="ui-button ui-button-soft"
          href="/api/integrations/hh/connect"
        >
          {isConnected ? "Переподключить hh.uz" : "Подключить hh.uz"}
        </a>

        {account && (
          <button
            className="h-10 rounded-lg border border-danger-red px-4 font-semibold text-danger-red text-sm leading-none transition-colors hover:bg-danger-red-bg disabled:cursor-not-allowed disabled:opacity-60"
            disabled={removeAccount.isPending}
            onClick={() => {
              removeAccount.mutate();
            }}
            type="button"
          >
            <LoadingButtonContent
              isLoading={removeAccount.isPending}
              label="Отключить"
              loadingLabel="Отключение..."
            />
          </button>
        )}
      </div>
    </ClosableSection>
  );
}
