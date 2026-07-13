export type RecentWorkspacesClock = Readonly<{
  /** @returns The current time as a canonical ISO timestamp. */
  now: () => string;
}>;
