import {
  defaultShouldDehydrateQuery,
  MutationCache,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";
import { publishToast } from "~/utils/toast-bus";
import { resolveTrpcError } from "~/utils/trpc-error";

declare module "@tanstack/react-query" {
  interface Register {
    /** Set when the caller renders the failure itself, e.g. an inline form error. */
    mutationMeta: { errorHandled?: boolean };
    queryMeta: { errorHandled?: boolean };
  }
}

/**
 * Surfaces a failed call as a toast.
 *
 * `UNAUTHORIZED` is skipped because the session-expiry path in `~/trpc/react`
 * redirects to /login, and a toast would flash and disappear with the page.
 * Server-side renders have no toast listener, so this is a no-op there.
 */
function toastFailure(error: unknown, dedupeKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  const resolved = resolveTrpcError(error);
  if (resolved.code === "UNAUTHORIZED") {
    return;
  }

  publishToast({
    variant: "error",
    // `message` is server-authored Russian text when trustworthy; otherwise the
    // renderer localizes `messageKey` from the `Errors` namespace.
    message: resolved.message ?? undefined,
    messageKey: resolved.messageKey,
    description: resolved.formErrors.join(" ") || undefined,
    dedupeKey,
  });
}

export const createQueryClient = () =>
  new QueryClient({
    // `useQuery` has no `onError` in React Query v5, so a failed read is
    // invisible unless the component explicitly renders `isError`. Reporting
    // centrally here means a broken query can never look like an empty list.
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.meta?.errorHandled) {
          return;
        }
        toastFailure(error, `query:${query.queryHash}`);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        // Mutations that handle their own errors render something contextual
        // (inline form errors, a blocked-action modal). Toasting here as well
        // would double-report, so this only covers the ones that opted out.
        // `onError` covers the hook-based ones; `meta.errorHandled` is the
        // opt-out for callers that await `mutateAsync` inside their own
        // try/catch, where React Query sees no handler.
        if (mutation.options.onError || mutation.meta?.errorHandled) {
          return;
        }
        toastFailure(
          error,
          `mutation:${mutation.options.mutationKey?.join(".") ?? mutation.mutationId}`,
        );
      },
    }),
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 5 * 60 * 1000,
        retry: false,
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
