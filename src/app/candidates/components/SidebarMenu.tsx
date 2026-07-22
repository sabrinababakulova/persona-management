"use client";

import type { SidebarMenuProps } from "~/types/candidates/sidebar-menu";

export function SidebarMenu({ items, activeId, onSelect }: SidebarMenuProps) {
  return (
    <div className="sticky top-0 h-screen w-[220px] shrink-0 pt-8">
      <nav className="flex flex-col gap-2">
        {items.map((item) => (
          <button
            className={`rounded-lg px-4 py-3 text-left font-semibold text-sm transition-colors ${
              activeId === item.id
                ? "bg-bg-active-menu text-primary-blue"
                : "text-text-disabled hover:text-text-placeholder"
            }`}
            key={item.id}
            onClick={() => onSelect(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
