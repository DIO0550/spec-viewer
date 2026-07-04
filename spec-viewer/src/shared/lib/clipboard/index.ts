/**
 * Copies generated prompt text to the browser clipboard.
 *
 * @param text - The text to write to the clipboard.
 * @throws When the current environment does not expose a clipboard API.
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard === undefined) {
    throw new Error("この環境ではクリップボードを利用できません。");
  }

  await navigator.clipboard.writeText(text);
}
