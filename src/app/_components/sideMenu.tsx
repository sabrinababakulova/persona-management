"use client";

import { useId } from "react";
import type { SideMenuProps } from "~/types/components/vacancies-side-menu";
import { motion } from "./motion-system";

export function SideMenu({ items, activeId, onSelect }: SideMenuProps) {
  const menuId = useId();

  return (
    <aside className="w-full shrink-0 lg:w-52 lg:pt-10">
      <nav
        aria-label="Навигация по дополнительному меню"
        className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-0"
      >
        {items.map((item) => {
          const isActive = activeId === item.id;
          const baseClassName = `relative w-auto shrink-0 overflow-hidden whitespace-nowrap rounded-lg px-3 py-3 text-left font-semibold text-sm leading-5 transition-colors lg:w-full ${
            isActive ? "text-primary-blue" : "text-text-muted"
          }`;

          const activeIndicator = isActive ? (
            <motion.span
              className="absolute inset-0 rounded-lg bg-primary-blue-light"
              layoutId={`${menuId}-active-section`}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          ) : null;

          if (item.disabled) {
            return (
              <div
                aria-disabled="true"
                className={`${baseClassName} cursor-not-allowed select-none`}
                key={item.id}
              >
                {activeIndicator}
                <span className="relative z-1">{item.label}</span>
              </div>
            );
          }

          return (
            <motion.button
              className={`${baseClassName} ${
                isActive ? "" : "hover:text-text-placeholder"
              }`}
              key={item.id}
              onClick={() => onSelect(item.id)}
              type="button"
              whileTap={{ scale: 0.98 }}
            >
              {activeIndicator}
              <span className="relative z-1">{item.label}</span>
            </motion.button>
          );
        })}
      </nav>
    </aside>
  );
}
