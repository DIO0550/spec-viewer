import type { ReactElement } from "react";

import { WorkspaceContext } from "@/features/workspace/context/context";
import type { WorkspaceProviderProps } from "@/features/workspace/context/types";
import { useWorkspaceState } from "@/features/workspace/context/useWorkspaceState";

/**
 * @param props - Provider props for the managed workspace state.
 * @returns Context provider that owns the active workspace state.
 */
export function WorkspaceProvider(
  props: WorkspaceProviderProps,
): ReactElement {
  const { children } = props;
  const value = useWorkspaceState();

  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}
