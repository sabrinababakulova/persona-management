"use client";

import Cookies from "js-cookie";
import Image from "next/image";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
  ImageUploadPlaceholderIcon,
  LogoutIcon,
  ProfileOutlineIcon,
} from "~/app/_components/icons";
import { api } from "~/trpc/react";
import { AnimatePresence, motion } from "./motion-system";

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
  const t = useTranslations("Components");
  const { status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
      <motion.button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={t("profile")}
        className="h-10 w-10 overflow-hidden rounded-full bg-primary-blue-light outline-none ring-primary-blue transition-[box-shadow,transform] duration-200 ease-out focus-visible:ring-2"
        onClick={() => setIsOpen((prev) => !prev)}
        type="button"
        whileHover={{ scale: 1.045 }}
        whileTap={{ scale: 0.94 }}
      >
        {avatarSrc ? (
          <Image
            alt={t("profile")}
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
      </motion.button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="absolute top-[calc(100%+8px)] right-0 z-30 w-[195px] origin-top-right overflow-hidden rounded-lg border border-border-light bg-bg-light shadow-toast"
            exit={{ opacity: 0, scale: 0.98, y: -5 }}
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            role="menu"
          >
            <Link
              className="flex h-10 items-center gap-2 px-3 text-text-secondary transition-[background-color,color] duration-200 ease-out hover:bg-bg-hover hover:text-text-heading"
              href="/my-profile"
              onClick={() => setIsOpen(false)}
              role="menuitem"
            >
              <ProfileOutlineIcon className="h-4 w-4 shrink-0 text-text-placeholder" />
              <span className="text-sm leading-none">{t("myProfile")}</span>
            </Link>
            <button
              className="flex h-10 w-full items-center gap-2 border-border-light border-t px-3 text-left text-text-secondary transition-[background-color,color] duration-200 ease-out hover:bg-bg-hover hover:text-text-heading disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoggingOut}
              onClick={handleLogout}
              role="menuitem"
              type="button"
            >
              <LogoutIcon className="h-4 w-4 shrink-0 text-text-placeholder" />
              <span className="text-sm leading-none">
                {isLoggingOut ? t("signingOut") : t("signOut")}
              </span>
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
