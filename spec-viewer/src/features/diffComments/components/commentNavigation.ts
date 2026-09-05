/** Focuses a mounted line control by its semantic path/side/line key. */
export function focusCommentTarget(
  root: ParentNode | null,
  targetKey: string,
): void {
  if (root === null) {
    return;
  }
  const slot = Array.from(
    root.querySelectorAll<HTMLElement>("[data-comment-target-key]"),
  ).find(
    (candidate) =>
      candidate.getAttribute("data-comment-target-key") === targetKey,
  );
  slot?.querySelector<HTMLButtonElement>("button")?.focus();
}
