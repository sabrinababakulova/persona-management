"use client";

import Cookies from "js-cookie";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { LogoutIcon, ProfileOutlineIcon } from "~/app/_components/icons";

type AvatarProfileMenuProps = {
  avatarSrc: string;
  avatarAlt: string;
};

const AUTH_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
  "authjs.csrf-token",
  "__Host-authjs.csrf-token",
];

const clearAuthCookies = () => {
  for (const name of AUTH_COOKIE_NAMES) {
    Cookies.remove(name);
    Cookies.remove(name, { path: "/" });
  }
};

const clearClientStorage = () => {
  localStorage.clear();
  sessionStorage.clear();
};

export function AvatarProfileMenu({
  avatarSrc,
  avatarAlt,
}: AvatarProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await signOut({ redirect: false, redirectTo: "/login" });
      clearAuthCookies();
      clearClientStorage();
      window.location.replace("/login");
    } catch (error) {
      console.error("Failed to log out", error);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Профиль"
        className="h-10 w-10 overflow-hidden rounded-[40px] bg-[#CEDBF5] outline-none ring-primary-blue focus-visible:ring-2"
        onClick={() => setIsOpen((prev) => !prev)}
        type="button"
      >
        <Image
          alt={avatarAlt}
          className="h-full w-full object-cover"
          height={40}
          src={avatarSrc}
          width={40}
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-[calc(100%+8px)] right-0 z-30 w-[195px] overflow-hidden rounded-[6px] border border-[#D8DEE8] bg-white shadow-[0_8px_20px_rgba(27,39,94,0.08)]"
          role="menu"
        >
          <Link
            className="flex h-10 items-center gap-2 px-3 text-[#3A465D] transition-colors hover:bg-[#F8FAFC]"
            href="/my-profile"
            onClick={() => setIsOpen(false)}
            role="menuitem"
          >
            <ProfileOutlineIcon className="h-4 w-4 shrink-0 text-[#707A8D]" />
            <span className="text-[14px] leading-none tracking-[-0.28px]">
              Мой профиль
            </span>
          </Link>
          <button
            className="flex h-10 w-full items-center gap-2 border-[#D8DEE8] border-t px-3 text-left text-[#3A465D] transition-colors hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoggingOut}
            onClick={handleLogout}
            role="menuitem"
            type="button"
          >
            <LogoutIcon className="h-4 w-4 shrink-0 text-[#707A8D]" />
            <span className="text-[14px] leading-none tracking-[-0.28px]">
              {isLoggingOut ? "Выход..." : "Выйти"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
