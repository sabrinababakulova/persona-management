"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { env } from "~/env";
import { api } from "~/trpc/react";
import { Checkbox } from "./checkbox";
import { ClosableSection } from "./closable-section";
import { ChevronDownIcon } from "./icons";
import {
  AnimatePresence,
  FeedbackPresence,
  LoadingButtonContent,
  motion,
} from "./motion-system";
import { SkeletonBlock } from "./page-skeleton";

const PAGE_SOURCE = "persona-olx-connector-page";
const EXTENSION_SOURCE = "persona-olx-connector-extension";

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
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [connectorAvailable, setConnectorAvailable] = useState(false);
  const [connectorChecked, setConnectorChecked] = useState(false);
  const [hasConnectionConsent, setHasConnectionConsent] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const sessionQuery = api.integrations.getOlxSession.useQuery();
  const startConnection =
    api.integrations.createOlxConnectionTicket.useMutation({
      onSuccess: ({ ticket, expiresAt }) => {
        window.postMessage(
          {
            source: PAGE_SOURCE,
            type: "PERSONA_OLX_START_CONNECTION",
            ticket,
            expiresAt: expiresAt.getTime(),
          },
          window.location.origin,
        );
        setFeedback({ type: "success", message: t("continueOnOlx") });
      },
      onError: (error) => {
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
        utils.vacancies.getOlxConfig.invalidate(),
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
      setFeedback({ type: "success", message: t("disconnected") });
      await Promise.all([
        utils.integrations.getOlxSession.invalidate(),
        utils.vacancies.getOlxConfig.invalidate(),
      ]);
    },
    onError: (error) => {
      setFeedback({
        type: "error",
        message: error.message || t("disconnectError"),
      });
    },
  });

  useEffect(() => {
    const onConnectorMessage = (event: MessageEvent) => {
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        event.data?.source !== EXTENSION_SOURCE
      ) {
        return;
      }

      if (event.data.type === "PERSONA_OLX_CONNECTOR_READY") {
        setConnectorAvailable(true);
        setConnectorChecked(true);
        return;
      }
      if (event.data.type === "PERSONA_OLX_CONNECTION_COMPLETE") {
        setFeedback({ type: "success", message: t("connectedSuccess") });
        void Promise.all([
          utils.integrations.getOlxSession.invalidate(),
          utils.vacancies.getOlxConfig.invalidate(),
        ]);
        return;
      }
      if (event.data.type === "PERSONA_OLX_CONNECTION_ERROR") {
        setFeedback({
          type: "error",
          message: event.data.detail?.message || t("connectError"),
        });
      }
    };

    window.addEventListener("message", onConnectorMessage);
    window.postMessage(
      { source: PAGE_SOURCE, type: "PERSONA_OLX_CONNECTOR_PING" },
      window.location.origin,
    );
    const checkedTimer = window.setTimeout(
      () => setConnectorChecked(true),
      900,
    );
    return () => {
      window.removeEventListener("message", onConnectorMessage);
      window.clearTimeout(checkedTimer);
    };
  }, [t, utils]);

  const session = sessionQuery.data?.session;
  const isConnected = session?.status === "connected";
  const isPending =
    startConnection.isPending || verify.isPending || disconnect.isPending;
  const connectionSteps = [
    {
      title: t("connectionSteps.install.title"),
      description: t("connectionSteps.install.description"),
    },
    {
      title: t("connectionSteps.start.title"),
      description: t("connectionSteps.start.description"),
    },
    {
      title: t("connectionSteps.signIn.title"),
      description: t("connectionSteps.signIn.description"),
    },
    {
      title: t("connectionSteps.finish.title"),
      description: t("connectionSteps.finish.description"),
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

      {connectorChecked && !connectorAvailable ? (
        <div className="rounded-lg border border-border-input bg-bg-input px-3 py-3">
          <p className="font-medium text-sm text-text-heading">
            {t("extensionMissing")}
          </p>
          <p className="mt-1 text-text-secondary text-xs leading-5">
            {t("extensionMissingHint")}
          </p>
          {env.NEXT_PUBLIC_OLX_CONNECTOR_URL ? (
            <a
              className="mt-3 inline-flex font-semibold text-primary-blue text-sm hover:underline"
              href={env.NEXT_PUBLIC_OLX_CONNECTOR_URL}
              rel="noreferrer"
              target="_blank"
            >
              {t("installExtension")}
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border-input bg-bg-light">
        <button
          aria-controls="olx-connection-help"
          aria-expanded={isHelpOpen}
          className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-primary-blue focus-visible:outline-offset-[-2px]"
          onClick={() => setIsHelpOpen((current) => !current)}
          type="button"
        >
          <span className="font-semibold text-sm text-text-heading">
            {t("connectionSteps.title")}
          </span>
          <ChevronDownIcon
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-text-secondary transition-transform duration-200 ${
              isHelpOpen ? "rotate-180" : "rotate-0"
            }`}
          />
        </button>

        <AnimatePresence initial={false}>
          {isHelpOpen ? (
            <motion.div
              animate={{ height: "auto", opacity: 1 }}
              className="overflow-hidden"
              exit={{ height: 0, opacity: 0 }}
              id="olx-connection-help"
              initial={{ height: 0, opacity: 0 }}
            >
              <div className="space-y-4 border-border-input border-t px-4 py-4">
                <p className="text-text-secondary text-xs leading-5">
                  {t("connectionSteps.description")}
                </p>
                <InstructionList items={connectionSteps} />
                <p className="border-border-input border-t pt-4 text-text-placeholder text-xs leading-5">
                  {t("privateDataWarning")}
                </p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="rounded-lg border border-border-input bg-bg-input px-4 py-4">
        <p className="text-text-secondary text-xs leading-5">
          {t("dataDisclosure")}{" "}
          <Link
            className="font-semibold text-primary-blue hover:underline"
            href="/privacy/olx-connector"
            target="_blank"
          >
            {t("privacyLink")}
          </Link>
        </p>
        <div className="mt-3 flex items-start gap-3">
          <Checkbox
            ariaLabel={t("consent")}
            checked={hasConnectionConsent}
            id="olx-connection-consent"
            onChange={() =>
              setHasConnectionConsent((currentConsent) => !currentConsent)
            }
          />
          <label
            className="min-w-0 flex-1 cursor-pointer font-medium text-sm text-text-heading leading-5"
            htmlFor="olx-connection-consent"
          >
            {t("consent")}
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          className="ui-button ui-button-soft"
          disabled={isPending || !connectorAvailable || !hasConnectionConsent}
          onClick={() => {
            setFeedback(null);
            startConnection.mutate();
          }}
          type="button"
        >
          <LoadingButtonContent
            isLoading={startConnection.isPending}
            label={session ? t("reconnect") : t("connect")}
            loadingLabel={t("starting")}
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
    </ClosableSection>
  );
}
