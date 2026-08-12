"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { api } from "~/trpc/react";
import { ClosableSection } from "./closable-section";
import { Input } from "./input";
import { FeedbackPresence, LoadingButtonContent } from "./motion-system";
import { SkeletonBlock } from "./page-skeleton";

function InstructionList({
  items,
}: {
  items: ReadonlyArray<{ title: string; description: string }>;
}) {
  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li className="flex gap-3" key={item.title}>
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-input bg-bg-light font-semibold text-text-secondary text-xs"
          >
            {index + 1}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="font-medium text-sm text-text-heading leading-5">
              {item.title}
            </p>
            <p className="mt-0.5 text-text-secondary text-xs leading-5">
              {item.description}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function OlxAccountSection() {
  const t = useTranslations("Integrations.olx");
  const format = useFormatter();
  const utils = api.useUtils();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const sessionQuery = api.integrations.getOlxSession.useQuery();
  const connect = api.integrations.connectOlxSession.useMutation({
    onSuccess: async () => {
      setPassword("");
      setFeedback({ type: "success", message: t("connectedSuccess") });
      await Promise.all([
        utils.integrations.getOlxSession.invalidate(),
        utils.vacancies.getOlxBrowserConfig.invalidate(),
      ]);
    },
    onError: (error) => {
      setPassword("");
      setFeedback({
        type: "error",
        message: error.message || t("connectError"),
      });
    },
  });
  const verify = api.integrations.verifyOlxSession.useMutation({
    onSuccess: async ({ connected }) => {
      setFeedback({
        type: connected ? "success" : "error",
        message: connected ? t("verified") : t("expired"),
      });
      await Promise.all([
        utils.integrations.getOlxSession.invalidate(),
        utils.vacancies.getOlxBrowserConfig.invalidate(),
      ]);
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message: error.message || t("verifyError"),
      });
    },
  });
  const disconnect = api.integrations.removeOlxSession.useMutation({
    onSuccess: async () => {
      setLogin("");
      setPassword("");
      setFeedback({ type: "success", message: t("disconnected") });
      await Promise.all([
        utils.integrations.getOlxSession.invalidate(),
        utils.vacancies.getOlxBrowserConfig.invalidate(),
      ]);
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message: error.message || t("disconnectError"),
      });
    },
  });

  const data = sessionQuery.data;
  const session = data?.session;
  const isConnected = session?.status === "connected";
  const isPending =
    connect.isPending || verify.isPending || disconnect.isPending;
  const connectionSteps = [
    {
      title: t("connectionSteps.enter.title"),
      description: t("connectionSteps.enter.description"),
    },
    {
      title: t("connectionSteps.wait.title"),
      description: t("connectionSteps.wait.description"),
    },
    {
      title: t("connectionSteps.confirm.title"),
      description: t("connectionSteps.confirm.description"),
    },
  ];
  const challengeSteps = [
    {
      title: t("challengeSteps.stop.title"),
      description: t("challengeSteps.stop.description"),
    },
    {
      title: t("challengeSteps.openOlx.title"),
      description: t("challengeSteps.openOlx.description"),
    },
    {
      title: t("challengeSteps.complete.title"),
      description: t("challengeSteps.complete.description"),
    },
    {
      title: t("challengeSteps.check.title"),
      description: t("challengeSteps.check.description"),
    },
    {
      title: t("challengeSteps.return.title"),
      description: t("challengeSteps.return.description"),
    },
  ];

  return (
    <ClosableSection title={t("title")}>
      {sessionQuery.isLoading ? (
        <div aria-busy="true" className="space-y-3">
          <SkeletonBlock className="h-24 w-full" />
          <SkeletonBlock className="h-10 w-44" />
        </div>
      ) : null}

      <FeedbackPresence show={Boolean(feedback)}>
        <div
          aria-live="polite"
          className={`rounded-lg border border-border-input bg-bg-input px-3 py-3 text-sm ${
            feedback?.type === "error"
              ? "text-danger-red"
              : "text-success-green"
          }`}
        >
          {feedback?.message}
        </div>
      </FeedbackPresence>

      {!sessionQuery.isLoading && !data?.browserAvailable ? (
        <div className="rounded-lg border border-border-input bg-bg-input px-3 py-3">
          <p className="font-medium text-sm text-text-heading">
            {t("browserUnavailable")}
          </p>
          <p className="mt-1 text-text-secondary text-xs leading-5">
            {t("browserUnavailableHint")}
          </p>
        </div>
      ) : null}

      {session ? (
        <div className="space-y-1 rounded-lg border border-border-input bg-bg-input px-3 py-3">
          <p className="text-sm text-text-heading">
            <span className="font-medium">{t("status")}:</span>{" "}
            <span
              className={isConnected ? "text-success-green" : "text-danger-red"}
            >
              {isConnected ? t("connected") : t("reauthRequired")}
            </span>
          </p>
          {session.loginHint ? (
            <p className="text-text-secondary text-xs">
              {t("account")}: {session.loginHint}
            </p>
          ) : null}
          {session.lastVerifiedAt ? (
            <p className="text-text-secondary text-xs">
              {t("lastVerified")}:{" "}
              {format.dateTime(session.lastVerifiedAt, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-border-input bg-bg-input px-3 py-3">
        <p className="text-sm text-text-heading">
          {session ? t("reconnectDescription") : t("connectDescription")}
        </p>
        <p className="mt-1 text-text-secondary text-xs leading-5">
          {t("securityDescription")}
        </p>
      </div>

      <div className="rounded-xl border border-border-input bg-bg-light p-4 sm:p-5">
        <h3 className="font-semibold text-base text-text-heading">
          {t("connectionSteps.title")}
        </h3>
        <p className="mt-1 mb-4 text-sm text-text-secondary leading-5">
          {t("connectionSteps.description")}
        </p>
        <InstructionList items={connectionSteps} />
      </div>

      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setFeedback(null);
          connect.mutate({ login, password });
        }}
      >
        <Input
          autoComplete="username"
          disabled={isPending || !data?.browserAvailable}
          label={t("login")}
          onChange={(event) => setLogin(event.target.value)}
          placeholder={t("loginPlaceholder")}
          required
          value={login}
        />
        <Input
          autoComplete="current-password"
          disabled={isPending || !data?.browserAvailable}
          label={t("password")}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        <div className="flex flex-wrap gap-3 md:col-span-2">
          <button
            className="ui-button ui-button-soft"
            disabled={
              isPending || !data?.browserAvailable || !login.trim() || !password
            }
            type="submit"
          >
            <LoadingButtonContent
              isLoading={connect.isPending}
              label={session ? t("reconnect") : t("connect")}
              loadingLabel={t("connecting")}
            />
          </button>

          {session ? (
            <button
              className="ui-button ui-button-secondary"
              disabled={isPending}
              onClick={() => {
                setFeedback(null);
                verify.mutate();
              }}
              type="button"
            >
              <LoadingButtonContent
                isLoading={verify.isPending}
                label={t("verify")}
                loadingLabel={t("verifying")}
              />
            </button>
          ) : null}

          {session ? (
            <button
              className="h-10 rounded-lg border border-danger-red px-4 font-semibold text-danger-red text-sm leading-none transition-colors hover:bg-danger-red-bg disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending}
              onClick={() => disconnect.mutate()}
              type="button"
            >
              <LoadingButtonContent
                isLoading={disconnect.isPending}
                label={t("disconnect")}
                loadingLabel={t("disconnecting")}
              />
            </button>
          ) : null}
        </div>
      </form>

      {connect.isPending ? (
        <div
          aria-live="polite"
          className="rounded-lg border border-border-input bg-bg-input px-3 py-3"
        >
          <p className="font-medium text-sm text-text-heading">
            {t("connectionInProgressTitle")}
          </p>
          <p className="mt-1 text-text-secondary text-xs leading-5">
            {t("connectionInProgressDescription")}
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-border-input bg-bg-input p-4 sm:p-5">
        <h3 className="font-semibold text-base text-text-heading">
          {t("challengeSteps.title")}
        </h3>
        <p className="mt-1 mb-4 text-sm text-text-secondary leading-5">
          {t("challengeSteps.description")}
        </p>
        <InstructionList items={challengeSteps} />
        <div className="mt-4 flex flex-wrap items-center gap-3 border-border-input border-t pt-4">
          <a
            className="ui-button ui-button-secondary"
            href="https://www.olx.uz/"
            rel="noopener noreferrer"
            target="_blank"
          >
            {t("challengeSteps.openOlxButton")}
          </a>
          <p className="max-w-xl text-text-placeholder text-xs leading-5">
            {t("challengeSteps.privateDataWarning")}
          </p>
        </div>
      </div>
    </ClosableSection>
  );
}
