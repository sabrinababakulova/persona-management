"use client";

import { useState } from "react";
import { AvatarProfileMenu } from "~/app/_components/avatar-profile-menu";
import {
  BellIcon,
  ChevronDownIcon,
  GlobeIcon,
  MenuIcon,
  SearchIcon,
} from "~/app/_components/icons";
import type { HeaderProps } from "~/types/components/header-props";

export function Header({
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder = "Что вы хотите найти?",
  isSidebarOpen = true,
  onSidebarToggle,
}: HeaderProps) {
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const currentQuery = searchQuery ?? internalSearchQuery;

  const handleSearchChange = (value: string) => {
    onSearchQueryChange?.(value);
    if (searchQuery === undefined) {
      setInternalSearchQuery(value);
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full border-header-border border-b bg-bg-frosted px-4 py-2.5 backdrop-blur-xl sm:px-6">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            aria-expanded={isSidebarOpen}
            aria-label={
              isSidebarOpen ? "Свернуть боковое меню" : "Открыть боковое меню"
            }
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-light bg-bg-light text-text-secondary shadow-sm transition-colors hover:border-border-control hover:bg-bg-hover"
            onClick={onSidebarToggle}
            type="button"
          >
            <MenuIcon className="h-5 w-5" />
          </button>

          <div className="relative w-full max-w-sm">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input
              className="h-10 w-full rounded-lg border border-transparent bg-bg-input py-2 pr-4 pl-9 text-sm text-text-heading placeholder:text-text-placeholder focus:border-primary-blue focus:bg-bg-light focus:outline-none"
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              type="text"
              value={currentQuery}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            className="hidden h-10 items-center gap-1 rounded-lg px-2 text-text-placeholder hover:bg-bg-hover sm:flex"
            type="button"
          >
            <GlobeIcon className="h-4 w-4" />
            <span className="font-medium text-sm leading-none">Ру</span>
            <ChevronDownIcon className="h-3 w-3" />
          </button>

          <button
            aria-label="Уведомления"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-blue-light text-primary-blue hover:bg-primary-blue-light-hover"
            type="button"
          >
            <BellIcon className="h-5 w-5" />
          </button>

          <AvatarProfileMenu />
        </div>
      </div>
    </header>
  );
}
