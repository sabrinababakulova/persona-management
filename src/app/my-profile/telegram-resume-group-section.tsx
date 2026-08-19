"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ClosableSection } from "~/app/_components/closable-section";
import { CheckIcon } from "~/app/_components/icons";
import {
  FeedbackPresence,
  LoadingButtonContent,
} from "~/app/_components/motion-system";
import { SkeletonBlock } from "~/app/_components/page-skeleton";
import { api } from "~/trpc/react";

type ConnectRequest = {
  command: string;
  baselineChangedAt: number | null;
};

async function copyText(value: string) {
  if (!navigator.clipboard) {
    throw new Error("clipboard-unavailable");
  }
  await navigator.clipboard.writeText(value);
}

export function TelegramResumeGroupSection() {
  const t = useTranslations("Integrations.telegramResumeGroup");
  const utils = api.useUtils();
  const [connectRequest, setConnectRequest] = useState<ConnectRequest | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const groupQuery = api.integrations.getTelegramResumeGroup.useQuery(
    undefined,
    {
      refetchInterval: connectRequest ? 2000 : false,
      meta: { errorHandled: true },
    },
  );
  const group = groupQuery.data?.group ?? null;

  useEffect(() => {
    if (!connectRequest || !group) {
      return;
    }
    const changedAt = group.connectionChangedAt.getTime();
    if (
      connectRequest.baselineChangedAt !== null &&
      changedAt === connectRequest.baselineChangedAt
    ) {
      return;
    }

    setConnectRequest(null);
    setCopied(false);
    setError(null);
    setMessage(t("connectedMessage"));
    void utils.integrations.getTelegramResumeVacancy.invalidate();
  }, [connectRequest, group, t, utils]);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const createCode =
    api.integrations.createTelegramResumeConnectCode.useMutation({
      onSuccess: (result) => {
        setConnectRequest({
          command: result.command,
          baselineChangedAt: group?.connectionChangedAt.getTime() ?? null,
        });
        setCopied(false);
        setMessage(null);
        setError(null);
      },
      onError: (mutationError) => {
        setMessage(null);
        setError(mutationError.message);
      },
    });

  const disconnect = api.integrations.disconnectTelegramResumeGroup.useMutation(
    {
      onSuccess: () => {
        setConfirmDisconnect(false);
        setConnectRequest(null);
        setError(null);
        setMessage(t("disconnectedMessage"));
        void utils.integrations.getTelegramResumeGroup.invalidate();
      },
      onError: (mutationError) => {
        setError(mutationError.message);
      },
    },
  );

  const handleCopy = async () => {
    if (!connectRequest) {
      return;
    }
    try {
      await copyText(connectRequest.command);
      setCopied(true);
      setError(null);
    } catch {
      setError(t("copyFailed"));
    }
  };

  const verificationMessage = group
    ? t(`verification.${group.verification}`)
    : null;
  const isVerified = group?.verification === "verified";
  const canManage = groupQuery.data?.canManage ?? false;

  return (
    <ClosableSection title={t("title")}>
      {groupQuery.isLoading ? (
        <div aria-busy="true" className="space-y-3">
          <SkeletonBlock className="h-24 w-full" />
          <SkeletonBlock className="h-10 w-44" />
        </div>
      ) : null}

      {groupQuery.error ? (
        <p className="text-danger-red text-sm leading-5">
          {groupQuery.error.message}
        </p>
      ) : null}

      {!groupQuery.isLoading && groupQuery.data ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border-light bg-bg-input">
            <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bg-light">
                <Image
                  alt=""
                  aria-hidden="true"
                  height={24}
                  src="/telegram.svg"
                  width={24}
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-bold text-sm text-text-heading">
                    {group?.title ??
                      (group ? t("connectedGroup") : t("notConnected"))}
                  </p>
                  {group ? (
                    <span
                      className={`rounded-lg px-2 py-1 font-semibold text-xs leading-none ${
                        isVerified
                          ? "bg-success-green-bg text-success-green"
                          : "bg-warning-yellow-bg text-text-heading"
                      }`}
                    >
                      {isVerified ? t("active") : t("needsAttention")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-text-secondary leading-5">
                  {group
                    ? verificationMessage
                    : t("description", {
                        bot: groupQuery.data.botUsername ?? t("theBot"),
                      })}
                </p>
                {group ? (
                  <p className="mt-1 font-mono text-text-secondary text-xs">
                    {group.chatId}
                  </p>
                ) : null}
              </div>
            </div>

            {groupQuery.data.warehouseVacancyId ? (
              <div className="flex flex-col gap-3 border-border-light border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-text-secondary text-xs leading-5">
                  {t("warehouseHint")}
                </p>
                <Link
                  className="ui-button ui-button-soft shrink-0"
                  href={`/vacancies/${groupQuery.data.warehouseVacancyId}/funnel`}
                >
                  {t("openWarehouse")}
                </Link>
              </div>
            ) : null}
          </div>

          {!groupQuery.data.botConfigured ? (
            <p className="rounded-lg bg-danger-red-bg px-3 py-2 text-danger-red text-sm leading-5">
              {t("botNotConfigured")}
            </p>
          ) : null}

          {connectRequest ? (
            <div className="space-y-4 rounded-2xl border border-border-light bg-bg-light p-4 sm:p-5">
              <ol className="space-y-3">
                {(["addBot", "makeAdmin", "sendCommand"] as const).map(
                  (step, index) => (
                    <li className="flex items-start gap-3" key={step}>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-active-menu font-bold text-primary-blue text-xs">
                        {index + 1}
                      </span>
                      <p className="pt-0.5 text-sm text-text-heading leading-5">
                        {t(`steps.${step}`, {
                          bot: groupQuery.data.botUsername ?? t("theBot"),
                        })}
                      </p>
                    </li>
                  ),
                )}
              </ol>

              <div className="flex flex-col gap-2 sm:flex-row">
                <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border-input bg-bg-input px-3 py-2.5 text-sm text-text-heading">
                  {connectRequest.command}
                </code>
                <button
                  className="ui-button ui-button-soft shrink-0"
                  onClick={() => void handleCopy()}
                  type="button"
                >
                  {copied ? (
                    <span className="flex items-center gap-1.5 text-success-green">
                      <CheckIcon className="h-4 w-4" />
                      {t("copied")}
                    </span>
                  ) : (
                    t("copyCommand")
                  )}
                </button>
              </div>
              <p className="text-text-secondary text-xs leading-5">
                {t("waiting")}
              </p>
              <button
                className="text-left font-semibold text-primary-blue text-xs hover:underline"
                onClick={() => setConnectRequest(null)}
                type="button"
              >
                {t("cancelConnection")}
              </button>
            </div>
          ) : null}

          {canManage && !connectRequest && !confirmDisconnect ? (
            <div className="flex flex-wrap gap-3">
              <button
                className="ui-button ui-button-soft"
                disabled={
                  createCode.isPending || !groupQuery.data.botConfigured
                }
                onClick={() => createCode.mutate()}
                type="button"
              >
                <LoadingButtonContent
                  isLoading={createCode.isPending}
                  label={group ? t("replaceGroup") : t("connectGroup")}
                  loadingLabel={t("creatingCommand")}
                />
              </button>
              {group ? (
                <button
                  className="ui-button bg-danger-red-bg text-danger-red hover:bg-danger-pink-bg"
                  onClick={() => setConfirmDisconnect(true)}
                  type="button"
                >
                  {t("disconnect")}
                </button>
              ) : null}
              {group ? (
                <button
                  className="ui-button bg-transparent text-text-secondary hover:bg-bg-hover"
                  disabled={groupQuery.isFetching}
                  onClick={() => void groupQuery.refetch()}
                  type="button"
                >
                  {t("verifyAgain")}
                </button>
              ) : null}
            </div>
          ) : null}

          {confirmDisconnect ? (
            <div className="rounded-2xl border border-border-light bg-bg-light p-4">
              <p className="font-semibold text-sm text-text-heading">
                {t("disconnectTitle")}
              </p>
              <p className="mt-1 text-sm text-text-secondary leading-5">
                {t("disconnectHint")}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="ui-button bg-danger-red-bg text-danger-red hover:bg-danger-pink-bg"
                  disabled={disconnect.isPending}
                  onClick={() => disconnect.mutate()}
                  type="button"
                >
                  <LoadingButtonContent
                    isLoading={disconnect.isPending}
                    label={t("confirmDisconnect")}
                    loadingLabel={t("disconnecting")}
                  />
                </button>
                <button
                  className="ui-button ui-button-soft"
                  disabled={disconnect.isPending}
                  onClick={() => setConfirmDisconnect(false)}
                  type="button"
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          ) : null}

          {!canManage ? (
            <p className="text-text-secondary text-xs leading-5">
              {t("adminOnly")}
            </p>
          ) : null}
        </div>
      ) : null}

      <FeedbackPresence show={Boolean(message)}>
        <p aria-live="polite" className="text-sm text-success-green">
          {message}
        </p>
      </FeedbackPresence>
      <FeedbackPresence show={Boolean(error)}>
        <p aria-live="polite" className="text-danger-red text-sm">
          {error}
        </p>
      </FeedbackPresence>
    </ClosableSection>
  );
}
