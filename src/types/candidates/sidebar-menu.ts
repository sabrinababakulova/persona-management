export type MenuItem = { id: string; label: string };

export interface SidebarMenuProps {
  items: MenuItem[];
  activeId: string;
  onSelect: (id: string) => void;
}
