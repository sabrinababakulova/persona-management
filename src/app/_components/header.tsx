"use client";

import Image from "next/image";
import { useState } from "react";
import {
  BellIcon,
  ChevronDownIcon,
  GlobeIcon,
  SearchIcon,
} from "~/app/_components/icons";
import type { HeaderProps } from "~/types/components/header-props";

const DEFAULT_AVATAR_SRC =
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Kerim";

export function Header({
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder = "Что вы хотите найти?",
  avatarSrc = DEFAULT_AVATAR_SRC,
  avatarAlt = "Profile",
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
    <header className="sticky top-0 z-10 w-full border-header-border border-b bg-white px-4 py-3 lg:px-8">
      <div className="flex w-full items-center justify-between gap-4">
        <div className="relative w-full max-w-[367px]">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#616C81]" />
          <input
            className="h-10 w-full rounded-[8px] bg-[#F1F4F8] py-3 pr-4 pl-9 text-[#616C81] text-[16px] tracking-[-0.32px] placeholder:text-[#616C81] focus:outline-none"
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            type="text"
            value={currentQuery}
          />
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <button
            className="flex h-10 items-center gap-1 rounded-[6px] px-1 py-3 text-[#707A8D]"
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

          <div className="h-10 w-10 overflow-hidden rounded-[40px] bg-[#CEDBF5]">
            <Image
              alt={avatarAlt}
              className="h-full w-full object-cover"
              height={40}
              src={avatarSrc}
              width={40}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
