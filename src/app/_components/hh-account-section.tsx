"use client";

import { api } from "~/trpc/react";
import { ClosableSection } from "../_components/closable-section";

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
      {isLoading && (
        <p className="text-[14px] text-text-secondary">Загрузка...</p>
      )}

      {!isLoading && isConnected && (
        <div className="space-y-1 rounded-[6px] border border-border-input bg-bg-input px-3 py-3">
          <p className="text-[14px] text-text-heading">
            <span className="font-medium">Статус:</span>{" "}
            <span className="text-success-green">Подключен</span>
          </p>
          <p className="text-[13px] text-text-secondary">
            Employer ID: {account.employerId}
          </p>
          {account.email && (
            <p className="text-[13px] text-text-secondary">
              Email: {account.email}
            </p>
          )}
        </div>
      )}

      {!isLoading && !isConnected && (
        <div className="rounded-[6px] border border-border-input bg-bg-input px-3 py-3">
          <p className="text-[14px] text-text-heading">
            Подключите hh.uz через OAuth.
          </p>
          <p className="mt-1 text-[13px] text-text-secondary leading-[1.4]">
            Client ID и Client Secret берутся из серверных переменных окружения.
            Employer ID определяется автоматически после авторизации в hh.uz.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <a
          className="inline-flex h-10 items-center rounded-[6px] bg-primary-blue-light px-4 font-semibold text-[14px] text-primary-blue leading-none tracking-[-0.28px] transition-colors hover:bg-primary-blue-light-hover"
          href="/api/integrations/hh/connect"
        >
          {isConnected ? "Переподключить hh.uz" : "Подключить hh.uz"}
        </a>

        {account && (
          <button
            className="h-10 rounded-[6px] border border-danger-red px-4 font-semibold text-[14px] text-danger-red leading-none tracking-[-0.28px] transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={removeAccount.isPending}
            onClick={() => {
              removeAccount.mutate();
            }}
            type="button"
          >
            {removeAccount.isPending ? "Отключение..." : "Отключить"}
          </button>
        )}
      </div>
    </ClosableSection>
  );
}
