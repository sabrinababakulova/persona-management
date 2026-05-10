"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "~/app/_components/icons";

export interface ActionDropdownItem {
  value: string;
  label: string;
  iconSrc: string;
}

export interface ActionDropdownProps {
  triggerLabel: string;
  items: ActionDropdownItem[];
  onSelect: (value: string) => void;
  className?: string;
  menuClassName?: string;
}

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
      className={`relative inline-block ${className ?? ""}`}
      ref={containerRef}
    >
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-12 items-center justify-between gap-3 rounded-[8px] bg-primary-blue px-5 font-semibold text-[16px] text-bg-light leading-none tracking-[-0.32px] transition-colors hover:bg-primary-blue-hover"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        <span>{triggerLabel}</span>
        <ChevronDownIcon
          className={`h-5 w-5 transition-transform duration-200 ${
            open ? "-rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <ul
          className={`absolute top-full right-0 z-20 mt-2 flex w-[260px] flex-col overflow-hidden rounded-[8px] border border-border-input bg-bg-light shadow-lg ${menuClassName ?? ""}`}
          role="menu"
        >
          {items.map((item, index) => (
            <li key={item.value} role="none">
              <button
                className={`flex w-full items-center gap-3 px-4 py-3 text-left font-medium text-[16px] text-text-heading leading-none transition-colors hover:bg-bg-input ${
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
                  className="h-6 w-6 flex-shrink-0"
                  height={24}
                  src={item.iconSrc}
                  unoptimized
                  width={24}
                />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
