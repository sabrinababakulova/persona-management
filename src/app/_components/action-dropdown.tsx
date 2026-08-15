"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "~/app/_components/icons";
import { AnimatePresence, motion } from "./motion-system";

/** Single entry shown inside an {@link ActionDropdown} menu. */
export interface ActionDropdownItem {
  /** Value handed to `onSelect` when the user picks this item. */
  value: string;
  /** Human-readable label displayed next to the icon. */
  label: string;
  /** Path of the icon asset (typically a static SVG under `/public`). */
  iconSrc: string;
}

/** Props for the {@link ActionDropdown} component. */
export interface ActionDropdownProps {
  /** Label shown on the trigger button (e.g. "Создать публикацию"). */
  triggerLabel: string;
  /** Menu entries shown when the dropdown is open. */
  items: ActionDropdownItem[];
  /** Invoked with the picked item's `value` when the user selects it. */
  onSelect: (value: string) => void;
  /** Extra classes for the dropdown's outer wrapper. */
  className?: string;
  /** Extra classes for the popup `<ul>` menu. */
  menuClassName?: string;
}

/**
 * A button-with-menu dropdown that renders icons alongside each option.
 *
 * Native `<select>` (used by `~/app/_components/dropdown`) can't show icons in options, so this
 * variant uses a `<button>` trigger plus a `<ul role="menu">` of icon+label items. The menu
 * closes on outside click, on `Escape`, and when an item is picked.
 */
export function ActionDropdown({
  triggerLabel,
  items,
  onSelect,
  className,
  menuClassName,
}: ActionDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div
      className={`relative w-full sm:inline-block sm:w-auto ${className ?? ""}`}
      ref={containerRef}
    >
      <motion.button
        aria-expanded={open}
        aria-haspopup="menu"
        className="ui-button ui-button-primary w-full justify-between sm:w-auto"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
        whileTap={{ scale: 0.975 }}
      >
        <span>{triggerLabel}</span>
        <ChevronDownIcon
          className={`h-5 w-5 transition-transform duration-200 ${
            open ? "-rotate-180" : ""
          }`}
        />
      </motion.button>

      <AnimatePresence>
        {open ? (
          <motion.ul
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={`absolute top-full right-0 left-0 z-20 mt-2 flex origin-top-right flex-col overflow-hidden rounded-xl border border-border-input bg-bg-light shadow-lg sm:left-auto sm:w-[210px] ${menuClassName ?? ""}`}
            exit={{ opacity: 0, scale: 0.98, y: -5 }}
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
          >
            {items.map((item, index) => (
              <motion.li
                animate={{ opacity: 1, x: 0 }}
                initial={{ opacity: 0, x: -5 }}
                key={item.value}
                role="none"
                transition={{ delay: index * 0.035, duration: 0.18 }}
              >
                <button
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left font-medium text-sm text-text-heading leading-none transition-colors hover:bg-bg-input ${
                    index < items.length - 1
                      ? "border-border-input border-b"
                      : ""
                  }`}
                  onClick={() => {
                    onSelect(item.value);
                    setOpen(false);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <Image
                    alt=""
                    className="h-5 w-5 flex-shrink-0"
                    height={20}
                    src={item.iconSrc}
                    unoptimized
                    width={20}
                  />
                  <span>{item.label}</span>
                </button>
              </motion.li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
