import type { ReactNode } from "react";

export type SidebarPreferenceContextValue = Readonly<{
  isSidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
}>;

export type SidebarPreferenceProviderProps = Readonly<{
  children: ReactNode;
}>;
