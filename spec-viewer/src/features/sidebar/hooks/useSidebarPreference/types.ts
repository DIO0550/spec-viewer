import type { ReactNode } from "react";

export type SidebarPreferenceContextValue = Readonly<{
  isSidebarOpen: boolean;
  /** Opens the sidebar and persists the preference. */
  openSidebar: () => void;
  /** Closes the sidebar and persists the preference. */
  closeSidebar: () => void;
}>;

export type SidebarPreferenceProviderProps = Readonly<{
  children: ReactNode;
}>;
