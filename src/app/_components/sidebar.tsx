"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  BrandLogoIcon,
  CloseIcon,
  HomeIcon,
  OutlineBriefcaseIcon,
  SettingsIcon,
  UsersIcon,
} from "~/app/_components/icons";
import { api } from "~/trpc/react";
import type { NavItem } from "~/types/components/sidebar-nav-item";

type SidebarProps = {
  hasHydrated: boolean;
  isOpen: boolean;
  onClose: () => void;
};

export function Sidebar({ hasHydrated, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const utils = api.useUtils();

  // "New since you last looked" counts for the Vacancies / Candidates badges.
  // Polled so freshly synced rows surface without a page reload.
  const { data: counts } = api.sidebar.counts.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const markSeen = api.sidebar.markSeen.useMutation({
    onSuccess: () => {
      void utils.sidebar.counts.invalidate();
    },
  });
  const markSeenMutate = markSeen.mutate;

  // Opening a section clears its badge.
  useEffect(() => {
    if (pathname.startsWith("/candidates")) {
      markSeenMutate({ section: "candidates" });
    } else if (pathname.startsWith("/vacancies")) {
      markSeenMutate({ section: "vacancies" });
    }
  }, [pathname, markSeenMutate]);

  const navItems: NavItem[] = [
    {
      label: "Главная",
      href: "/dashboard",
      icon: <HomeIcon className="h-6 w-6" />,
    },
    {
      label: "Вакансии",
      href: "/vacancies",
      icon: <OutlineBriefcaseIcon className="h-6 w-6" />,
      badge: counts?.newVacancies || undefined,
    },
    {
      label: "Кандидаты",
      href: "/candidates",
      icon: <UsersIcon className="h-6 w-6" />,
      badge: counts?.newCandidates || undefined,
    },
    {
      label: "Настройки",
      href: "/settings",
      icon: <SettingsIcon className="h-6 w-6" />,
    },
  ];

  const desktopIsOpen = hasHydrated ? isOpen : true;
  const mobileIsOpen = hasHydrated ? isOpen : false;

  const handleNavigationClick = () => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches
    ) {
      onClose();
    }
  };

  const sidebarContent = (
    <>
      <div className="mb-10 flex items-center justify-between gap-3 px-2">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10">
            <BrandLogoIcon className="h-full w-full" />
          </div>
          <span className="font-semibold text-2xl text-primary-blue tracking-wide">
            Logoipsum
          </span>
        </div>

        <button
          aria-label="Закрыть боковое меню"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-placeholder transition-colors hover:bg-sidebar-hover hover:text-text-placeholder-hover lg:hidden"
          onClick={onClose}
          type="button"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              className={`group relative flex items-center gap-4 rounded-xl px-4 py-3 font-medium text-base transition-all duration-200 ease-in-out ${
                isActive
                  ? "bg-sidebar-active-bg text-primary-blue"
                  : "text-text-placeholder hover:bg-sidebar-hover hover:text-text-placeholder-hover"
              }`}
              href={item.href}
              key={item.href}
              onClick={handleNavigationClick}
            >
              <span
                className={`transition-all duration-200 ease-in-out ${
                  isActive
                    ? "text-primary-blue"
                    : "text-text-placeholder group-hover:text-text-placeholder-hover"
                }`}
              >
                {item.icon}
              </span>

              <span className="flex-1">{item.label}</span>

              {item.badge && (
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-badge-red px-1.5 font-semibold text-bg-light text-xs">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      <div
        className={`relative hidden shrink-0 overflow-hidden transition-[width] duration-300 lg:block ${
          desktopIsOpen ? "w-80" : "w-0"
        }`}
        id="app-sidebar"
      >
        <aside
          className={`fixed top-0 flex h-screen w-80 flex-col bg-sidebar-bg px-4 py-8 transition-transform duration-300 ${
            desktopIsOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebarContent}
        </aside>
      </div>

      <div
        aria-hidden={!mobileIsOpen}
        className={`fixed inset-0 z-40 bg-text-heading/35 transition-opacity duration-300 lg:hidden ${
          mobileIsOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        aria-hidden={!mobileIsOpen}
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-80 max-w-[85vw] flex-col bg-sidebar-bg px-4 py-8 shadow-toast transition-transform duration-300 lg:hidden ${
          mobileIsOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
