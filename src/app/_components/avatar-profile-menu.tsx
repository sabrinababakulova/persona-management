"use client";

import Cookies from "js-cookie";
import Image from "next/image";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import {
  ImageUploadPlaceholderIcon,
  LogoutIcon,
  ProfileOutlineIcon,
} from "~/app/_components/icons";
import { api } from "~/trpc/react";
import { usePresence } from "./use-presence";

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

export function AvatarProfileMenu() {
  const { status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldRender, isVisible } = usePresence(isOpen, 180);

  const { data: avatar } = api.profile.getAvatar.useQuery(undefined, {
    enabled: status === "authenticated",
  });
  const avatarSrc = avatar?.avatarUrl ?? "";

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
        className="h-10 w-10 overflow-hidden rounded-[40px] bg-primary-blue-light outline-none ring-primary-blue transition-[box-shadow,transform] duration-200 ease-out focus-visible:ring-2"
        onClick={() => setIsOpen((prev) => !prev)}
        type="button"
      >
        {avatarSrc ? (
          <Image
            alt="Профиль"
            className="h-full w-full object-cover"
            height={40}
            src={avatarSrc}
            unoptimized
            width={40}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-icon-secondary">
            <ImageUploadPlaceholderIcon className="h-6 w-6" />
          </span>
        )}
      </button>

      {shouldRender && (
        <div
          className={`absolute top-[calc(100%+8px)] right-0 z-30 w-[195px] overflow-hidden rounded-[6px] border border-border-light bg-bg-light shadow-toast transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${isVisible ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"}`}
          role="menu"
        >
          <Link
            className="flex h-10 items-center gap-2 px-3 text-text-secondary transition-[background-color,color] duration-200 ease-out hover:bg-bg-hover hover:text-text-heading"
            href="/my-profile"
            onClick={() => setIsOpen(false)}
            role="menuitem"
          >
            <ProfileOutlineIcon className="h-4 w-4 shrink-0 text-text-placeholder" />
            <span className="text-[14px] leading-none tracking-[-0.28px]">
              Мой профиль
            </span>
          </Link>
          <button
            className="flex h-10 w-full items-center gap-2 border-border-light border-t px-3 text-left text-text-secondary transition-[background-color,color] duration-200 ease-out hover:bg-bg-hover hover:text-text-heading disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoggingOut}
            onClick={handleLogout}
            role="menuitem"
            type="button"
          >
            <LogoutIcon className="h-4 w-4 shrink-0 text-text-placeholder" />
            <span className="text-[14px] leading-none tracking-[-0.28px]">
              {isLoggingOut ? "Выход..." : "Выйти"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
