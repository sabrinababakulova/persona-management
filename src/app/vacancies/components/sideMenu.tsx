type SideMenuItem = {
  id: string;
  label: string;
};

type SideMenuProps = {
  items: SideMenuItem[];
  activeId: string;
  onSelect: (id: string) => void;
};

export function SideMenu({ items, activeId, onSelect }: SideMenuProps) {
  return (
    <aside className="w-full max-w-[220px] pt-12">
      <nav
        aria-label="Навигация по созданию вакансии"
        className="flex flex-col"
      >
        {items.map((item) => (
          <button
            className={`w-full rounded-[6px] p-4 text-left font-medium text-[16px] leading-none tracking-[-0.32px] transition-colors ${
              activeId === item.id
                ? "bg-primary-blue-light text-primary-blue"
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
    </aside>
  );
}
