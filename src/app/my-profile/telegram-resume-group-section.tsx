"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ClosableSection } from "~/app/_components/closable-section";
import {
  FeedbackPresence,
  LoadingButtonContent,
} from "~/app/_components/motion-system";
import { SkeletonBlock } from "~/app/_components/page-skeleton";
import { api } from "~/trpc/react";

export function TelegramResumeGroupSection() {
  const t = useTranslations("Integrations.telegramResumeGroup");
  const utils = api.useUtils();
  const [groupReference, setGroupReference] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const groupQuery = api.integrations.getTelegramResumeGroup.useQuery(
    undefined,
    { meta: { errorHandled: true } },
  );
  const group = groupQuery.data?.group ?? null;

  const connect = api.integrations.connectTelegramResumeGroup.useMutation({
    onSuccess: () => {
      setGroupReference("");
      setIsEditing(false);
      setMessage(t("connectedMessage"));
      setError(null);
      void utils.integrations.getTelegramResumeGroup.invalidate();
      void utils.integrations.getTelegramResumeVacancy.invalidate();
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
        setIsEditing(false);
        setError(null);
        setMessage(t("disconnectedMessage"));
        void utils.integrations.getTelegramResumeGroup.invalidate();
      },
      onError: (mutationError) => {
        setError(mutationError.message);
      },
    },
  );

  const verificationMessage = group
    ? t(`verification.${group.verification}`)
    : null;
  const isVerified = group?.verification === "verified";
  const showEditor = !group || isEditing;

  const handleConnect = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    connect.mutate({ groupReference });
  };

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

          {showEditor && groupQuery.data.botConfigured ? (
            <form
              className="space-y-4 rounded-2xl border border-border-light bg-bg-light p-4 sm:p-5"
              onSubmit={handleConnect}
            >
              <ol className="space-y-3">
                {(["addBot", "makeAdmin", "enterGroup"] as const).map(
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

              <div>
                <label
                  className="mb-1.5 block font-semibold text-sm text-text-heading"
                  htmlFor="telegram-resume-group"
                >
                  {t("groupLabel")}
                </label>
                <input
                  autoComplete="off"
                  className="h-11 w-full rounded-xl border border-border-input bg-bg-input px-3.5 text-sm text-text-heading leading-5 placeholder:text-text-placeholder hover:border-border-control focus:border-primary-blue focus:outline-none"
                  id="telegram-resume-group"
                  onChange={(event) => setGroupReference(event.target.value)}
                  placeholder={t("groupPlaceholder")}
                  value={groupReference}
                />
                <p className="mt-1.5 text-text-secondary text-xs leading-5">
                  {t("groupHint")}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className="ui-button ui-button-soft"
                  disabled={connect.isPending || !groupReference.trim()}
                  type="submit"
                >
                  <LoadingButtonContent
                    isLoading={connect.isPending}
                    label={group ? t("checkAndReplace") : t("checkAndConnect")}
                    loadingLabel={t("checkingAccess")}
                  />
                </button>
                {group ? (
                  <button
                    className="ui-button bg-transparent text-text-secondary hover:bg-bg-hover"
                    disabled={connect.isPending}
                    onClick={() => {
                      setIsEditing(false);
                      setGroupReference("");
                      setError(null);
                    }}
                    type="button"
                  >
                    {t("cancel")}
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}

          {!showEditor && !confirmDisconnect ? (
            <div className="flex flex-wrap gap-3">
              <button
                className="ui-button ui-button-soft"
                onClick={() => {
                  setIsEditing(true);
                  setMessage(null);
                  setError(null);
                }}
                type="button"
              >
                {t("replaceGroup")}
              </button>
              <button
                className="ui-button bg-danger-red-bg text-danger-red hover:bg-danger-pink-bg"
                onClick={() => setConfirmDisconnect(true)}
                type="button"
              >
                {t("disconnect")}
              </button>
              <button
                className="ui-button bg-transparent text-text-secondary hover:bg-bg-hover"
                disabled={groupQuery.isFetching}
                onClick={() => void groupQuery.refetch()}
                type="button"
              >
                {t("verifyAgain")}
              </button>
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
