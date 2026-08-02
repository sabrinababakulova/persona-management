"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Header } from "./header";
import { LocaleSwitcher } from "./locale-switcher";
import { RouteTransition } from "./motion-system";
import { Sidebar } from "./sidebar";

type AppShellProps = {
  children: React.ReactNode;
};

const DESKTOP_MEDIA_QUERY = "(min-width: 1280px)";
const AUTH_SCREEN_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/auth/error",
  "/invite",
  "/onboarding",
];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isAuthScreenRoute = AUTH_SCREEN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);

    const syncSidebarState = (matches: boolean) => {
      setIsSidebarOpen(matches);
      setHasHydrated(true);
    };

    syncSidebarState(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsSidebarOpen(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  if (isAuthScreenRoute) {
    return (
      <>
        <div className="fixed top-4 right-4 z-50">
          <LocaleSwitcher variant="auth" />
        </div>
        <RouteTransition className="min-h-screen" routeKey={pathname}>
          {children}
        </RouteTransition>
      </>
    );
  }

  return (
    <div className="relative flex h-dvh overflow-hidden bg-bg-canvas">
      <Sidebar
        hasHydrated={hasHydrated}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={() => setIsSidebarOpen((current) => !current)}
        />
        <RouteTransition
          className="app-route-frame min-h-0 flex-1 overflow-y-auto bg-bg-canvas"
          routeKey={pathname}
        >
          {children}
        </RouteTransition>
      </div>
    </div>
  );
}
