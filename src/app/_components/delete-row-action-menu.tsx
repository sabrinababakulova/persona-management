"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { MoreIcon, TrashIcon } from "./icons";

type DeleteRowActionMenuProps = {
  disabled?: boolean;
  onDelete: () => void;
};

const MENU_WIDTH = 168;

export function DeleteRowActionMenu({
  disabled = false,
  onDelete,
}: DeleteRowActionMenuProps) {
  const common = useTranslations("Common");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeMenu = () => setIsOpen(false);
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        closeMenu();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [isOpen]);

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={common("actions")}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-text-placeholder transition-colors hover:bg-bg-hover hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-50 lg:h-auto lg:w-auto lg:rounded-none lg:p-1"
        disabled={disabled}
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
            return;
          }

          const rect = triggerRef.current?.getBoundingClientRect();
          if (!rect) {
            return;
          }

          const menuHeight = 48;
          const spaceBelow = window.innerHeight - rect.bottom;
          setPosition({
            left: Math.min(
              Math.max(12, rect.right - MENU_WIDTH),
              window.innerWidth - MENU_WIDTH - 12,
            ),
            top:
              spaceBelow >= menuHeight + 16
                ? rect.bottom + 6
                : Math.max(12, rect.top - menuHeight - 6),
          });
          setIsOpen(true);
        }}
        ref={triggerRef}
        type="button"
      >
        <MoreIcon className="h-4 w-4" />
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[90] w-[168px] rounded-xl border border-border-light bg-bg-light p-1.5 shadow-toast"
              ref={menuRef}
              role="menu"
              style={position}
            >
              <button
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left font-medium text-accent-red text-sm transition-colors hover:bg-danger-red-bg"
                onClick={() => {
                  setIsOpen(false);
                  onDelete();
                }}
                role="menuitem"
                type="button"
              >
                <TrashIcon className="h-4 w-4" />
                <span>{common("delete")}</span>
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
