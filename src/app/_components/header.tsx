"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AvatarProfileMenu } from "~/app/_components/avatar-profile-menu";
import { BellIcon, MenuIcon, SearchIcon } from "~/app/_components/icons";
import type { HeaderProps } from "~/types/components/header-props";
import { LocaleSwitcher } from "./locale-switcher";

export function Header({
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder,
  isSidebarOpen = true,
  onSidebarToggle,
}: HeaderProps) {
  const t = useTranslations("Navigation");
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const currentQuery = searchQuery ?? internalSearchQuery;

  const handleSearchChange = (value: string) => {
    onSearchQueryChange?.(value);
    if (searchQuery === undefined) {
      setInternalSearchQuery(value);
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full border-border-light border-b bg-bg-frosted px-3 py-2.5 backdrop-blur-xl sm:border-b-0 sm:px-6 sm:py-3">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            aria-expanded={isSidebarOpen}
            aria-label={isSidebarOpen ? t("collapseSidebar") : t("openSidebar")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border-light bg-bg-light text-text-secondary shadow-sm transition-colors hover:border-border-control hover:bg-bg-hover xl:hidden"
            onClick={onSidebarToggle}
            type="button"
          >
            <MenuIcon className="h-5 w-5" />
          </button>

          <Image
            alt="Talanty"
            className="h-8 w-8 sm:hidden"
            height={32}
            priority
            src="/talanty-mark.svg"
            width={32}
          />

          <div className="relative hidden w-full max-w-lg sm:block">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input
              className="h-10 w-full rounded-lg border border-border-light bg-bg-input py-2 pr-4 pl-9 text-sm text-text-heading shadow-sm placeholder:text-text-placeholder focus:border-primary-blue focus:outline-none"
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder={searchPlaceholder ?? t("search")}
              type="text"
              value={currentQuery}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden md:block">
            <LocaleSwitcher />
          </div>

          <button
            aria-label={t("notifications")}
            className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-border-light bg-bg-light text-text-heading shadow-sm hover:border-border-control hover:bg-bg-panel-hover sm:h-10 sm:w-10 sm:rounded-lg"
            type="button"
          >
            <BellIcon className="h-5 w-5" />
            <span
              aria-hidden="true"
              className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary-blue ring-2 ring-bg-light"
            />
          </button>

          <AvatarProfileMenu />
        </div>
      </div>
    </header>
  );
}
