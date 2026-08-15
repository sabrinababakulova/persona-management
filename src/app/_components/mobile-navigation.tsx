"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CalendarIcon,
  HomeIcon,
  OutlineBriefcaseIcon,
  SettingsIcon,
  UsersIcon,
} from "./icons";

export function MobileNavigation() {
  const pathname = usePathname();
  const t = useTranslations("Navigation");
  const items = [
    { href: "/dashboard", label: t("home"), icon: HomeIcon },
    { href: "/calendar", label: t("calendar"), icon: CalendarIcon },
    { href: "/vacancies", label: t("vacancies"), icon: OutlineBriefcaseIcon },
    { href: "/candidates", label: t("candidates"), icon: UsersIcon },
    {
      href: "/my-profile?section=company-settings",
      label: t("settings"),
      icon: SettingsIcon,
    },
  ];

  return (
    <nav
      aria-label={t("mobileNavigation")}
      className="mobile-bottom-navigation xl:hidden"
    >
      {items.map((item) => {
        const path = item.href.split("?")[0] ?? item.href;
        const active =
          pathname === path ||
          (path !== "/dashboard" && pathname.startsWith(`${path}/`));
        const Icon = item.icon;

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className="mobile-bottom-navigation__item"
            data-active={active}
            href={item.href}
            key={item.href}
          >
            <Icon className="h-[22px] w-[22px]" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
