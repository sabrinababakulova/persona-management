import type { ErrorMessageKey } from "~/utils/trpc-error";

export type ToastVariant = "error" | "success" | "warning" | "info";

/**
 * A toast request.
 *
 * Either `message` (already localized, e.g. a Russian message thrown by a
 * router) or `messageKey` (a key inside the `Errors` namespace, resolved by the
 * renderer) must be provided. `messageKey` exists because toasts can be raised
 * from non-React code, which has no access to `useTranslations`.
 */
export type ToastInput = {
  variant: ToastVariant;
  message?: string;
  messageKey?: ErrorMessageKey;
  description?: string;
  /** Milliseconds before auto-dismiss. `null` keeps the toast until dismissed. */
  durationMs?: number | null;
  /**
   * Collapses repeats: a toast published with an existing key replaces it
   * instead of stacking. Used so a burst of failures from one action reads as
   * one message.
   */
  dedupeKey?: string;
};

export type Toast = ToastInput & { id: string };
