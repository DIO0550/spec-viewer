export const CommentTargets = {
  /**
   * Finds the first mounted slot with the semantic target key.
   * @param root - Search boundary, or null before mounting.
   * @param targetKey - Exact comment target key.
   * @returns The matching descendant slot, or null when absent.
   */
  find(root: ParentNode | null, targetKey: string): HTMLElement | null {
    if (root === null) {
      return null;
    }
    return (
      Array.from(
        root.querySelectorAll<HTMLElement>("[data-comment-target-key]"),
      ).find(
        (candidate) =>
          candidate.getAttribute("data-comment-target-key") === targetKey,
      ) ?? null
    );
  },
  /**
   * Focuses the first button in the matching mounted slot.
   * @param root - Search boundary, or null before mounting.
   * @param targetKey - Exact comment target key.
   */
  focus(root: ParentNode | null, targetKey: string): void {
    CommentTargets.find(root, targetKey)
      ?.querySelector<HTMLButtonElement>("button")
      ?.focus();
  },
};
