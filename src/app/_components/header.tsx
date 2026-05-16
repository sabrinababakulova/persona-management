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
    <header className="sticky top-0 z-10 w-full border-header-border border-b bg-bg-light px-4 py-3 lg:px-8">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            aria-expanded={isSidebarOpen}
            aria-label={
              isSidebarOpen ? "Свернуть боковое меню" : "Открыть боковое меню"
            }
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-border-light text-text-secondary transition-colors hover:bg-bg-hover"
            onClick={onSidebarToggle}
            type="button"
          >
            <MenuIcon className="h-5 w-5" />
          </button>

          <div className="relative w-full max-w-[367px]">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input
              className="h-10 w-full rounded-[8px] bg-bg-hover py-3 pr-4 pl-9 text-[16px] text-text-secondary tracking-[-0.32px] placeholder:text-text-secondary focus:outline-none"
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              type="text"
              value={currentQuery}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <button
            className="flex h-10 items-center gap-1 rounded-[6px] px-1 py-3 text-text-placeholder"
            type="button"
          >
            <GlobeIcon className="h-4 w-4" />
            <span className="font-medium text-[16px] leading-none tracking-[-0.32px]">
              Ру
            </span>
            <ChevronDownIcon className="h-3 w-3" />
          </button>

          <button
            aria-label="Уведомления"
            className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-primary-blue-light text-primary-blue"
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
