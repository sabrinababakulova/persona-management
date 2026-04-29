import type { SideMenuProps } from "~/types/components/vacancies-side-menu";

export function SideMenu({ items, activeId, onSelect }: SideMenuProps) {
  return (
    <aside className="w-full flex-1 pt-12">
      <nav
        aria-label="Навигация по дополнительному меню"
        className="flex flex-col"
      >
        {items.map((item) => {
          const isActive = activeId === item.id;
          const baseClassName = `w-full rounded-[6px] p-4 text-left font-medium text-[16px] leading-none tracking-[-0.32px] transition-colors ${
            isActive
              ? "bg-primary-blue-light text-primary-blue"
              : "text-text-disabled"
          }`;

          if (item.disabled) {
            return (
              <div
                aria-disabled="true"
                className={`${baseClassName} cursor-not-allowed select-none`}
                key={item.id}
              >
                {item.label}
              </div>
            );
          }

          return (
            <button
              className={`${baseClassName} ${
                isActive ? "" : "hover:text-text-placeholder"
              }`}
              key={item.id}
              onClick={() => onSelect(item.id)}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
