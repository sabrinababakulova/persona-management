"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Toast, ToastVariant } from "~/types/components/toast-props";
import { subscribeToToasts } from "~/utils/toast-bus";
import { CloseIcon } from "./icons";
import { AnimatePresence, motion } from "./motion-system";

const TOAST_EASE = [0.22, 1, 0.36, 1] as const;
const DEFAULT_DURATION_MS = 6000;
const MAX_VISIBLE = 4;

const VARIANT_STYLES: Record<
  ToastVariant,
  { panel: string; dot: string; icon: string }
> = {
  error: {
    panel: "border-red-200 bg-danger-red-bg text-red-700",
    dot: "bg-danger-red shadow-[0_0_0_4px_rgba(239,68,68,0.16)]",
    icon: "text-red-600",
  },
  success: {
    panel: "border-white/10 bg-text-heading text-white",
    dot: "bg-success-green shadow-[0_0_0_4px_rgba(61,186,122,0.16)]",
    icon: "text-white",
  },
  warning: {
    panel: "border-warning-yellow/30 bg-warning-yellow-bg text-text-heading",
    dot: "bg-warning-yellow shadow-[0_0_0_4px_rgba(245,158,11,0.16)]",
    icon: "text-text-heading",
  },
  info: {
    panel: "border-white/10 bg-text-heading text-white",
    dot: "bg-white/70",
    icon: "text-white",
  },
};

/**
 * Renders the app-wide toast stack.
 *
 * Subscribes to the toast bus rather than exposing a context, so failures
 * raised outside the React tree (the tRPC query/mutation cache subscribers)
 * reach the same UI as ones raised inside a component.
 */
export function Toaster() {
  const t = useTranslations("Errors");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    return subscribeToToasts((toast) => {
      setToasts((current) => {
        // A dedupe key replaces the earlier toast in place, so a burst of
        // failures from a single action reads as one message rather than a wall.
        const withoutDuplicate = toast.dedupeKey
          ? current.filter((item) => item.dedupeKey !== toast.dedupeKey)
          : current;
        return [...withoutDuplicate, toast].slice(-MAX_VISIBLE);
      });
    });
  }, []);

  useEffect(() => {
    const timers = toasts
      .filter((toast) => toast.durationMs !== null)
      .map((toast) =>
        setTimeout(
          () => dismiss(toast.id),
          toast.durationMs ?? DEFAULT_DURATION_MS,
        ),
      );

    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [toasts, dismiss]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed top-20 right-4 z-70 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2 sm:right-6">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const styles = VARIANT_STYLES[toast.variant];
          // `messageKey` points into the `Errors` namespace; `message` is
          // already-localized text that came back from the server.
          const body =
            toast.message ?? (toast.messageKey ? t(toast.messageKey) : "");

          return (
            <motion.div
              animate={{ opacity: 1, scale: 1, x: 0 }}
              aria-live={toast.variant === "error" ? "assertive" : "polite"}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-toast ${styles.panel}`}
              exit={{ opacity: 0, scale: 0.97, x: 16 }}
              initial={{ opacity: 0, scale: 0.97, x: 24 }}
              key={toast.id}
              layout
              role={toast.variant === "error" ? "alert" : "status"}
              transition={{ duration: 0.26, ease: TOAST_EASE }}
            >
              <span
                aria-hidden="true"
                className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${styles.dot}`}
              />

              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="font-medium leading-5">{body}</p>
                {toast.description ? (
                  <p className="text-xs leading-4 opacity-80">
                    {toast.description}
                  </p>
                ) : null}
              </div>

              <button
                aria-label={t("dismiss")}
                className={`-mr-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded transition-opacity hover:opacity-70 ${styles.icon}`}
                onClick={() => dismiss(toast.id)}
                type="button"
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
