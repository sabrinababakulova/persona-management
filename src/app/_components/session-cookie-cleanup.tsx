"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

const SESSION_COOKIE_PREFIXES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
];

function hasSessionCookie() {
  if (typeof document === "undefined") {
    return false;
  }

  const cookieNames = document.cookie
    .split(";")
    .map((entry) => entry.trim().split("=")[0]?.trim())
    .filter((name): name is string => Boolean(name));

  return cookieNames.some((name) =>
    SESSION_COOKIE_PREFIXES.some(
      (prefix) => name === prefix || name.startsWith(`${prefix}.`),
    ),
  );
}

export function SessionCookieCleanup() {
  const { status } = useSession();
  const hasTriggeredCleanupRef = useRef(false);

  useEffect(() => {
    if (status === "loading") {
      hasTriggeredCleanupRef.current = false;
      return;
    }

    if (status === "authenticated") {
      hasTriggeredCleanupRef.current = false;
      return;
    }

    if (hasTriggeredCleanupRef.current || !hasSessionCookie()) {
      return;
    }

    hasTriggeredCleanupRef.current = true;
    void signOut({ redirect: false });
  }, [status]);

  return null;
}
