import {
  createContext,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode,
} from "react";

import {
  SpecViewIdentity,
  type SpecViewIdentity as SpecViewIdentityType,
  type SpecViewIdentityInput,
} from "@/features/specs/domain/specViewIdentity";

export type SpecViewIdentityContextValue = Readonly<{
  viewIdentity: SpecViewIdentityType;
}>;

export type SpecViewIdentityProviderProps = Readonly<{
  selection: SpecViewIdentityInput;
  children: ReactNode;
}>;

const SpecViewIdentityContext =
  createContext<SpecViewIdentityContextValue | null>(null);

/**
 * @param props - Provider props with the active spec view selection.
 * @returns Context provider for the active spec view identity.
 */
export function SpecViewIdentityProvider(
  props: SpecViewIdentityProviderProps,
): ReactElement {
  const { children, selection } = props;
  const viewIdentity = useMemo(
    () => SpecViewIdentity.create(selection),
    [
      selection.fileKey,
      selection.specId,
      selection.targetScope,
      selection.workspacePath,
    ],
  );
  const value = useMemo(
    () => ({
      viewIdentity,
    }),
    [viewIdentity],
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
