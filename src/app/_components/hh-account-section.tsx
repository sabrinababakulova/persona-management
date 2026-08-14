"use client";

import { useTranslations } from "next-intl";
import { api } from "~/trpc/react";
import { ClosableSection } from "../_components/closable-section";
import { IntegrationStatusBadge } from "../_components/integration-status-badge";
import { LoadingButtonContent } from "../_components/motion-system";
import { SkeletonBlock } from "../_components/page-skeleton";

export function HhAccountSection() {
  const t = useTranslations("Integrations");
  const utils = api.useUtils();

  const { data: account, isLoading } = api.integrations.getHhAccount.useQuery();

  const removeAccount = api.integrations.removeHhAccount.useMutation({
    onSuccess: () => {
      void utils.integrations.getHhAccount.invalidate();
    },
  });

  const isConnected = !!account?.hasTokens && !!account?.employerId;

  return (
    <ClosableSection title={t("hhAccount")}>
      {isLoading ? (
        <div aria-busy="true" className="space-y-3">
          <SkeletonBlock className="h-20 w-full" />
          <SkeletonBlock className="h-10 w-40" />
        </div>
      ) : null}

      {!isLoading && isConnected && (
        <div className="space-y-1 rounded-lg border border-border-input bg-bg-input px-3 py-3">
          <p className="flex items-center gap-2 text-sm text-text-heading">
            <span className="font-medium">{t("status")}:</span>
            <IntegrationStatusBadge>{t("connected")}</IntegrationStatusBadge>
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
          <p className="text-sm text-text-heading">{t("connectOauth")}</p>
          <p className="mt-1 text-text-secondary text-xs leading-[1.4]">
            {t("oauthDescription")}
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <a
          className="ui-button ui-button-soft"
          href="/api/integrations/hh/connect"
        >
          {isConnected ? t("reconnectHh") : t("connectHh")}
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
              label={t("disconnect")}
              loadingLabel={t("disconnecting")}
            />
          </button>
        )}
      </div>
    </ClosableSection>
  );
}
