import { useContext } from "react";

import { WorkspaceContext } from "@/features/workspace/context/context";
import type { WorkspaceContextValue } from "@/features/workspace/context/types";

/**
 * @returns Current workspace context value.
 * @throws Error when used outside WorkspaceProvider.
 */
export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);

  if (value === null) {
    throw new Error("WorkspaceProvider is missing");
  }

  return value;
}

export const useWorkspaceContext = useWorkspace;
