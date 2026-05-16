"use client";

import { useEffect, useState } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

type AppShellProps = {
  children: React.ReactNode;
};

const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

export function AppShell({ children }: AppShellProps) {
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

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

  return (
    <div className="relative flex min-h-screen bg-bg-light">
      <Sidebar
        hasHydrated={hasHydrated}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={() => setIsSidebarOpen((current) => !current)}
        />
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
