/**
 * Copies the given text to the browser clipboard.
 *
 * @param text - Text to place on the clipboard
 * @throws Error when the clipboard API is unavailable in this environment.
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard === undefined) {
    throw new Error("この環境ではクリップボードを利用できません。");
  }

  await navigator.clipboard.writeText(text);
}
