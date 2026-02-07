"use client";

type MenuItem = { id: string; label: string };

interface SidebarMenuProps {
  items: MenuItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function SidebarMenu({ items, activeId, onSelect }: SidebarMenuProps) {
  return (
    <div className="sticky top-0 h-screen w-[220px] shrink-0 pt-8">
      <nav className="flex flex-col gap-2">
        {items.map((item) => (
          <button
            className={`rounded-lg px-4 py-3 text-left font-semibold text-[14px] tracking-[-0.28px] transition-colors ${
              activeId === item.id
                ? "bg-[#e6efff] text-primary-blue"
                : "text-[#c1c8d4] hover:text-[#707a8d]"
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
