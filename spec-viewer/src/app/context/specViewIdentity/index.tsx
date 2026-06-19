import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

import {
  SpecViewIdentity,
  type SpecViewIdentity as SpecViewIdentityType,
  type SpecViewIdentityInput,
  type SpecViewTargetScope,
} from "@/features/specs/domain/specViewIdentity";

export type SpecViewSelection = SpecViewIdentityInput;

export type SpecViewWorkspaceSelectionInput = Pick<
  SpecViewSelection,
  "workspacePath" | "specId" | "fileKey"
>;

export type SpecViewIdentityContextValue = Readonly<{
  selection: SpecViewSelection;
  viewIdentity: SpecViewIdentityType;
  setWorkspaceSelection: (selection: SpecViewWorkspaceSelectionInput) => void;
  setTargetScope: (targetScope: SpecViewTargetScope) => void;
}>;

export type SpecViewIdentityProviderProps = Readonly<{
  children: ReactNode;
}>;

const defaultSelection: SpecViewSelection = {
  workspacePath: null,
  specId: null,
  fileKey: null,
  targetScope: "file",
};

const SpecViewIdentityContext =
  createContext<SpecViewIdentityContextValue | null>(null);

/**
 * @param props - Provider props for the managed spec view section.
 * @returns Context provider that owns the active spec view selection.
 */
export function SpecViewIdentityProvider(
  props: SpecViewIdentityProviderProps,
): ReactElement {
  const { children } = props;
  const [selection, setSelection] =
    useState<SpecViewSelection>(defaultSelection);
  const viewIdentity = useMemo(
    () => SpecViewIdentity.create(selection),
    [
      selection.fileKey,
      selection.specId,
      selection.targetScope,
      selection.workspacePath,
    ],
  );
  const setWorkspaceSelection = useCallback(
    (nextWorkspaceSelection: SpecViewWorkspaceSelectionInput): void => {
      setSelection((current) => {
        const nextSelection = {
          ...current,
          ...nextWorkspaceSelection,
        };

        return areSelectionsEqual(current, nextSelection)
          ? current
          : nextSelection;
      });
    },
    [],
  );
  const setTargetScope = useCallback(
    (targetScope: SpecViewTargetScope): void => {
      setSelection((current) => {
        if (current.targetScope === targetScope) {
          return current;
        }

        return {
          ...current,
          targetScope,
        };
      });
    },
    [],
  );
  const value = useMemo(
    () => ({
      selection,
      viewIdentity,
      setWorkspaceSelection,
      setTargetScope,
    }),
    [selection, setTargetScope, setWorkspaceSelection, viewIdentity],
  );

  return (
    <SpecViewIdentityContext.Provider value={value}>
      {children}
    </SpecViewIdentityContext.Provider>
  );
}

/**
 * @returns Current spec view identity context value.
 * @throws Error when used outside SpecViewIdentityProvider.
 */
export function useSpecViewIdentity(): SpecViewIdentityContextValue {
  const value = useContext(SpecViewIdentityContext);

  if (value === null) {
    throw new Error("SpecViewIdentityProvider is missing");
  }

  return value;
}

function areSelectionsEqual(
  current: SpecViewSelection,
  next: SpecViewSelection,
): boolean {
  return (
    current.workspacePath === next.workspacePath &&
    current.specId === next.specId &&
    current.fileKey === next.fileKey &&
    current.targetScope === next.targetScope
  );
}
