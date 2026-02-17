export type SideMenuItem = {
  id: string;
  label: string;
};

export type SideMenuProps = {
  items: SideMenuItem[];
  activeId: string;
  onSelect: (id: string) => void;
};
