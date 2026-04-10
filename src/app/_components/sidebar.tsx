"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CloseIcon } from "~/app/_components/icons";
import type { NavItem } from "~/types/components/sidebar-nav-item";

type SidebarProps = {
  hasHydrated: boolean;
  isOpen: boolean;
  onClose: () => void;
};

export function Sidebar({ hasHydrated, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      label: "Главная",
      href: "/dashboard",
      icon: (
        <svg
          aria-hidden="true"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </svg>
      ),
    },
    {
      label: "Вакансии",
      href: "/vacancies",
      icon: (
        <svg
          aria-hidden="true"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </svg>
      ),
      badge: 4,
    },
    {
      label: "Кандидаты",
      href: "/candidates",
      icon: (
        <svg
          aria-hidden="true"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </svg>
      ),
    },
    {
      label: "Настройки",
      href: "/settings",
      icon: (
        <svg
          aria-hidden="true"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
          <path
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </svg>
      ),
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
            <svg
              aria-hidden="true"
              className="h-full w-full"
              fill="none"
              viewBox="0 0 48 48"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle className="fill-icon-blue" cx="24" cy="24" r="24" />
              <path
                d="M14 20 L34 20 L24 32 L34 20"
                stroke="white"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
            </svg>
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
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-badge-red font-semibold text-white text-xs">
                  {item.badge}
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
        className={`fixed inset-0 z-40 bg-black/35 transition-opacity duration-300 lg:hidden ${
          mobileIsOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        aria-hidden={!mobileIsOpen}
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-80 max-w-[85vw] flex-col bg-sidebar-bg px-4 py-8 shadow-2xl transition-transform duration-300 lg:hidden ${
          mobileIsOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
