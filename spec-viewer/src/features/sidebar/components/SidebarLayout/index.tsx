import type { ReactElement } from "react";

import { WorkspaceLayout, type WorkspaceLayoutRootProps } from "@/components";

import { useResizableSidebar, useSidebarPreference } from "../../hooks";

type SidebarLayoutProps = Omit<WorkspaceLayoutRootProps, "commentsSidebar">;

/**
 * @param props - Workspace layout props except right comments sidebar control.
 * @returns Workspace layout connected to sidebar preference and width state.
 */
export function SidebarLayout(props: SidebarLayoutProps): ReactElement {
  const sidebarPreference = useSidebarPreference();
  const resizableSidebar = useResizableSidebar();

  return (
    <WorkspaceLayout.Root
      {...props}
      commentsSidebar={{
        isOpen: sidebarPreference.isSidebarOpen,
        width: resizableSidebar.sidebarWidth,
        minWidth: resizableSidebar.minSidebarWidth,
        maxWidth: resizableSidebar.maxSidebarWidth,
        onOpen: sidebarPreference.openSidebar,
        onClose: sidebarPreference.closeSidebar,
        onWidthChange: resizableSidebar.resizeSidebarTo,
      }}
    />
  );
}
