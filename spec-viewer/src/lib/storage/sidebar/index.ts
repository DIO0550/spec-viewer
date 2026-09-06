import { readStorageValue, writeStorageValue } from "@/lib/storage";

const SidebarWidthStorageKey = "spec-reviewer.comment-sidebar-width";
const DecimalRadix = 10;

/** @returns Unconstrained persisted pixels, or NaN when missing, invalid, or unavailable. */
export function readStoredSidebarWidth(): number {
  return Number.parseInt(
    readStorageValue(SidebarWidthStorageKey) ?? "",
    DecimalRadix,
  );
}

/**
 * Persists pixels using the existing sidebar preference format.
 * @param width - Width in pixels, already normalized by the caller.
 */
export function writeStoredSidebarWidth(width: number): void {
  writeStorageValue(SidebarWidthStorageKey, String(width));
}
