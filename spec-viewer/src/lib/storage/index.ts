type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** @returns The browser localStorage, or null when it is unavailable. */
function getBrowserStorage(): KeyValueStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * @param key - Storage key to read.
 * @returns Raw string value from browser storage, or null when unavailable.
 */
export function readStorageValue(key: string): string | null {
  const storage = getBrowserStorage();

  if (storage === null) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Writes a raw string value to browser storage when available.
 * @param key - Storage key to write.
 * @param value - Raw string value to store.
 */
export function writeStorageValue(key: string, value: string): void {
  const storage = getBrowserStorage();

  if (storage === null) {
    return;
  }

  try {
    storage.setItem(key, value);
  } catch {
    // Storage failures are swallowed so restricted browser environments still render.
  }
}

/**
 * Removes a raw string value from browser storage when available.
 * @param key - Storage key to remove.
 */
export function removeStorageValue(key: string): void {
  const storage = getBrowserStorage();

  if (storage === null) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // Storage failures are swallowed so restricted browser environments still render.
  }
}
