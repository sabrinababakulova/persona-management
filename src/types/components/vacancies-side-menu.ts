export type SideMenuItem = {
  id: string;
  label: string;
  disabled?: boolean;
};

export type SideMenuProps = {
  items: SideMenuItem[];
  activeId: string;
  onSelect: (id: string) => void;
};
