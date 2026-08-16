"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { env } from "~/env";
import {
  OLX_ACCOUNT_SECTION_ID,
  OLX_CONNECTOR_STORE_URL,
} from "~/shared/publication-navigation";
import { api } from "~/trpc/react";
import { Checkbox } from "./checkbox";
import { ClosableSection } from "./closable-section";
import { CheckIcon, ChevronDownIcon } from "./icons";
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
  const [isWaitingForInstallation, setIsWaitingForInstallation] =
    useState(false);
  const installFlowStartedRef = useRef(false);
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
    let animationFrame: number | null = null;
    let observer: MutationObserver | null = null;
    let settleTimer: number | null = null;

    const stopTracking = () => {
      observer?.disconnect();
      observer = null;
      if (settleTimer !== null) {
        window.clearTimeout(settleTimer);
        settleTimer = null;
      }
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
    };

    const startTracking = () => {
      stopTracking();
      if (window.location.hash !== `#${OLX_ACCOUNT_SECTION_ID}`) {
        return;
      }

      const section = document.getElementById(OLX_ACCOUNT_SECTION_ID);
      if (!section) {
        return;
      }
      const scrollContainer = section.closest<HTMLElement>(".app-route-frame");

      const scrollToSection = () => {
        if (animationFrame !== null) {
          window.cancelAnimationFrame(animationFrame);
        }
        animationFrame = window.requestAnimationFrame(() => {
          if (!scrollContainer) {
            section.scrollIntoView({ block: "start" });
            return;
          }

          const sectionRect = section.getBoundingClientRect();
          const containerRect = scrollContainer.getBoundingClientRect();
          scrollContainer.scrollTop = Math.max(
            0,
            scrollContainer.scrollTop +
              sectionRect.top -
              containerRect.top -
              96,
          );
        });
      };

      // The settings above OLX load independently. Keep the anchor aligned while
      // their skeletons are replaced, then disconnect the observer once settled.
      const settingsContainer = section.parentElement;
      observer = new MutationObserver(scrollToSection);
      if (settingsContainer) {
        observer.observe(settingsContainer, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      }
      scrollToSection();

      settleTimer = window.setTimeout(() => {
        observer?.disconnect();
        observer = null;
        scrollToSection();
      }, 1_500);
    };

    // Next.js can apply the hash just after the new client tree mounts.
    const startTimer = window.setTimeout(startTracking, 0);
    window.addEventListener("hashchange", startTracking);

    return () => {
      window.removeEventListener("hashchange", startTracking);
      window.clearTimeout(startTimer);
      stopTracking();
    };
  }, []);

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
        setIsWaitingForInstallation(false);
        installFlowStartedRef.current = false;
        return;
      }
      if (event.data.type === "PERSONA_OLX_CONNECTION_COMPLETE") {
        setFeedback(null);
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

  useEffect(() => {
    if (connectorAvailable) {
      return;
    }

    let pageWasLeft = false;
    let reloadScheduled = false;

    const reloadAfterReturn = () => {
      if (!pageWasLeft || reloadScheduled) {
        return;
      }
      reloadScheduled = true;
      window.setTimeout(() => window.location.reload(), 350);
    };
    const onBlur = () => {
      if (!installFlowStartedRef.current) {
        return;
      }
      pageWasLeft = true;
    };
    const onFocus = () => {
      if (installFlowStartedRef.current) {
        reloadAfterReturn();
      }
    };
    const onVisibilityChange = () => {
      if (!installFlowStartedRef.current) {
        return;
      }
      if (document.visibilityState === "hidden") {
        pageWasLeft = true;
        return;
      }
      reloadAfterReturn();
    };
    const pingTimer = window.setInterval(() => {
      if (!installFlowStartedRef.current) {
        return;
      }
      window.postMessage(
        { source: PAGE_SOURCE, type: "PERSONA_OLX_CONNECTOR_PING" },
        window.location.origin,
      );
    }, 1_000);

    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(pingTimer);
    };
  }, [connectorAvailable]);

  const session = sessionQuery.data?.session;
  const isConnected = session?.status === "connected";
  const needsConnection = !isConnected;
  const isPending = startConnection.isPending || disconnect.isPending;
  const connectorStoreUrl =
    env.NEXT_PUBLIC_OLX_CONNECTOR_URL ?? OLX_CONNECTOR_STORE_URL;
  const connectionSteps = [
    {
      title: t("connectionSteps.install.title"),
      description: t("connectionSteps.install.description"),
    },
    {
      title: t("connectionSteps.connect.title"),
      description: t("connectionSteps.connect.description"),
    },
    {
      title: t("connectionSteps.finish.title"),
      description: t("connectionSteps.finish.description"),
    },
  ];

  return (
    <ClosableSection
      className="scroll-mt-24"
      id={OLX_ACCOUNT_SECTION_ID}
      title={t("title")}
    >
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
          <p className="flex items-center gap-2 text-sm text-text-heading">
            <span className="font-medium">{t("status")}:</span>
            <span
              className={`rounded-lg px-2 py-1.5 font-semibold text-xs uppercase leading-none ${
                isConnected
                  ? "bg-status-active-bg text-text-heading"
                  : "bg-status-danger-soft text-accent-red"
              }`}
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

      {needsConnection && !sessionQuery.isLoading ? (
        <div className="overflow-hidden rounded-lg border border-border-input bg-bg-light">
          <div className="border-border-input border-b px-4 py-4">
            <p className="font-semibold text-text-heading text-xs uppercase tracking-wide">
              {t("setupProgress", {
                current: connectorAvailable ? 2 : 1,
                total: 2,
              })}
            </p>
            <ol className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <li
                aria-current={connectorAvailable ? undefined : "step"}
                className="flex min-w-0 items-center gap-2"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-semibold text-xs ${
                    connectorAvailable
                      ? "bg-status-active-bg text-success-green"
                      : "bg-primary-blue text-white"
                  }`}
                >
                  {connectorAvailable ? <CheckIcon className="h-4 w-4" /> : "1"}
                </span>
                <span className="hidden font-medium text-sm text-text-heading sm:inline">
                  {t("installStepShort")}
                </span>
              </li>
              <li aria-hidden="true" className="h-px min-w-4 bg-border-input" />
              <li
                aria-current={connectorAvailable ? "step" : undefined}
                className="flex min-w-0 items-center gap-2"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-semibold text-xs ${
                    connectorAvailable
                      ? "bg-primary-blue text-white"
                      : "border border-border-input bg-bg-input text-text-secondary"
                  }`}
                >
                  2
                </span>
                <span className="hidden font-medium text-sm text-text-heading sm:inline">
                  {t("connectStepShort")}
                </span>
              </li>
            </ol>
          </div>

          {!connectorChecked ? (
            <div aria-busy="true" className="space-y-2 px-4 py-5">
              <SkeletonBlock className="h-5 w-56" />
              <SkeletonBlock className="h-4 w-full max-w-xl" />
              <SkeletonBlock className="h-10 w-56" />
            </div>
          ) : null}

          {connectorChecked && !connectorAvailable ? (
            <div className="px-4 py-5">
              <p className="font-semibold text-base text-text-heading">
                {t("installStepTitle")}
              </p>
              <p className="mt-1 max-w-2xl text-sm text-text-secondary leading-6">
                {t("installStepDescription")}
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <a
                  className="ui-button ui-button-primary w-full sm:w-auto"
                  href={connectorStoreUrl}
                  onClick={() => {
                    installFlowStartedRef.current = true;
                    setIsWaitingForInstallation(true);
                  }}
                  rel="noreferrer"
                  target="_blank"
                >
                  {t("installExtension")}
                </a>
                <button
                  className="ui-button ui-button-secondary w-full sm:w-auto"
                  onClick={() => window.location.reload()}
                  type="button"
                >
                  {t("checkInstallation")}
                </button>
              </div>
              <p className="mt-3 text-text-secondary text-xs leading-5">
                {isWaitingForInstallation
                  ? t("waitingForInstallation")
                  : t("installReturnHint")}
              </p>
            </div>
          ) : null}

          {connectorAvailable ? (
            <div className="px-4 py-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-status-active-bg text-success-green">
                  <CheckIcon className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold text-base text-text-heading">
                    {t("extensionReady")}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary leading-6">
                    {t("connectStepDescription")}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-border-input bg-bg-input px-4 py-4">
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
                      setHasConnectionConsent(
                        (currentConsent) => !currentConsent,
                      )
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

              <button
                className="ui-button ui-button-primary mt-4 w-full sm:w-auto"
                disabled={isPending || !hasConnectionConsent}
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
            </div>
          ) : null}
        </div>
      ) : null}

      {needsConnection && !sessionQuery.isLoading ? (
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
                <div className="border-border-input border-t px-4 py-4">
                  <InstructionList items={connectionSteps} />
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
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
