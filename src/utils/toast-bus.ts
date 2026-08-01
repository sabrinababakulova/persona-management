import type { Toast, ToastInput } from "~/types/components/toast-props";

type Listener = (toast: Toast) => void;

const listeners = new Set<Listener>();

let counter = 0;

function nextId() {
  counter += 1;
  return `toast-${counter}`;
}

/**
 * Publishes a toast from anywhere, including outside the React tree.
 *
 * The TanStack Query cache subscribers in `~/trpc/react` run outside rendering,
 * so they cannot call a context hook. Routing every toast through this bus
 * keeps a single code path for React and non-React callers alike, and avoids
 * ordering constraints between the toast provider and the tRPC provider.
 */
export function publishToast(input: ToastInput) {
  const toast: Toast = { ...input, id: nextId() };
  for (const listener of listeners) {
    listener(toast);
  }
  return toast.id;
}

export function subscribeToToasts(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
