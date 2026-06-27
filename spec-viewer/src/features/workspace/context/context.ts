import { createContext } from "react";

import type { WorkspaceContextValue } from "@/features/workspace/context/types";

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(
  null,
);
