"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { AnimatePresence, motion } from "./motion-system";

type SidebarProps = {
  hasHydrated: boolean;
  isOpen: boolean;
  onClose: () => void;
};

export function Sidebar({ hasHydrated, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("Navigation");
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
      label: t("home"),
      href: "/dashboard",
      icon: <HomeIcon className="h-6 w-6" />,
    },
    {
      label: t("vacancies"),
      href: "/vacancies",
      icon: <OutlineBriefcaseIcon className="h-6 w-6" />,
      badge: counts?.newVacancies || undefined,
    },
    {
      label: t("candidates"),
      href: "/candidates",
      icon: <UsersIcon className="h-6 w-6" />,
      badge: counts?.newCandidates || undefined,
    },
    {
      label: t("settings"),
      href: "/my-profile?section=company-settings",
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
      <div className="mb-8 flex items-center justify-between gap-3 px-2">
        <div className="flex items-center gap-3">
          <div className="relative h-9 w-9">
            <BrandLogoIcon className="h-full w-full" />
          </div>
          <span className="font-semibold text-white text-xl tracking-tight">
            Talanty
          </span>
        </div>

        <button
          aria-label={t("closeSidebar")}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-placeholder transition-colors hover:bg-sidebar-hover hover:text-text-placeholder-hover lg:hidden"
          onClick={onClose}
          type="button"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex flex-col gap-1.5">
        {navItems.map((item) => {
          // Strip the query string before comparing — the Settings link points at
          // `/my-profile?section=company-settings` but `pathname` is just `/my-profile`.
          const itemPath = item.href.split("?")[0];
          const isActive =
            pathname === itemPath ||
            (itemPath !== "/dashboard" && pathname.startsWith(`${itemPath}/`));

          return (
            <Link
              className={`group relative flex min-h-11 items-center gap-3 rounded-lg px-3.5 py-2.5 font-medium text-sm transition-all duration-200 ease-in-out ${
                isActive
                  ? "bg-sidebar-active-bg text-primary-blue-soft"
                  : "text-text-menu hover:bg-sidebar-hover hover:text-white"
              }`}
              href={item.href}
              key={item.href}
              onClick={handleNavigationClick}
            >
              <span
                className={`transition-all duration-200 ease-in-out ${
                  isActive
                    ? "text-primary-blue-soft"
                    : "text-text-placeholder-hover group-hover:text-white"
                }`}
              >
                {item.icon}
              </span>

              <span className="flex-1">{item.label}</span>

              {item.badge && (
                <motion.span
                  animate={{ scale: 1 }}
                  className="flex h-5 min-w-5 items-center justify-center rounded-full bg-badge-red px-1.5 font-semibold text-white text-xs"
                  initial={{ scale: 0 }}
                >
                  {item.badge > 99 ? "99+" : item.badge}
                </motion.span>
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      <motion.div
        animate={{ width: desktopIsOpen ? 272 : 0 }}
        className="relative hidden shrink-0 overflow-hidden lg:block"
        id="app-sidebar"
        initial={false}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.aside
          animate={{ x: desktopIsOpen ? 0 : -272 }}
          className="fixed top-0 flex h-screen w-68 flex-col bg-sidebar-bg px-4 py-6"
          initial={false}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          {sidebarContent}
        </motion.aside>
      </motion.div>

      <AnimatePresence>
        {mobileIsOpen ? (
          <>
            <motion.div
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-40 bg-text-heading/35 lg:hidden"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={onClose}
            />

            <motion.aside
              animate={{ x: 0 }}
              className="fixed inset-y-0 left-0 z-50 flex h-screen w-68 max-w-[85vw] flex-col bg-sidebar-bg px-4 py-6 shadow-toast lg:hidden"
              exit={{ x: -272 }}
              initial={{ x: -272 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              {sidebarContent}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
