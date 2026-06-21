import { createContext } from "react";

import type { SidebarPreferenceContextValue } from "./types";

export const SidebarPreferenceContext =
  createContext<SidebarPreferenceContextValue | null>(null);
