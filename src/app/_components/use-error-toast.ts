"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { publishToast } from "~/utils/toast-bus";
import { type ResolvedTrpcError, resolveTrpcError } from "~/utils/trpc-error";

type ShowErrorOptions = {
  /** Overrides the generic per-code text when the server sent no usable message. */
  fallbackMessage?: string;
  /** Collapses repeat failures from the same action into a single toast. */
  dedupeKey?: string;
};

/**
 * Returns a handler that turns any failed tRPC call into a visible toast.
 *
 * Drop it straight into `useMutation({ onError })`. The resolved error is
 * returned so callers can branch on `code` / `fieldErrors` for inline form
 * handling in addition to the toast.
 */
export function useErrorToast() {
  const t = useTranslations("Errors");

  return useCallback(
    (error: unknown, options?: ShowErrorOptions): ResolvedTrpcError => {
      const resolved = resolveTrpcError(error);

      // An expired session already redirects to /login via the cache
      // subscriber in `~/trpc/react`; a toast would flash and vanish.
      if (resolved.code === "UNAUTHORIZED") {
        return resolved;
      }

      const message =
        resolved.message ?? options?.fallbackMessage ?? t(resolved.messageKey);

      publishToast({
        variant: "error",
        message,
        // Form-level Zod messages are the most specific thing we have when a
        // payload is rejected, so they ride along under the headline.
        description: resolved.formErrors.join(" "),
        dedupeKey: options?.dedupeKey,
      });

      return resolved;
    },
    [t],
  );
}

/** Returns a handler that shows a success toast with already-localized text. */
export function useSuccessToast() {
  return useCallback((message: string, description?: string) => {
    publishToast({ variant: "success", message, description });
  }, []);
}
