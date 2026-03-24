"use client";

import { SessionProvider } from "next-auth/react";

import { TRPCReactProvider } from "~/trpc/react";
import { SessionCookieCleanup } from "./session-cookie-cleanup";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus={true}>
      <SessionCookieCleanup />
      <TRPCReactProvider>{children}</TRPCReactProvider>
    </SessionProvider>
  );
}
