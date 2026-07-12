export type WorkspaceDragDropEvent =
  | Readonly<{
      type: "enter";
      paths: readonly string[];
    }>
  | Readonly<{
      type: "over";
    }>
  | Readonly<{
      type: "drop";
      paths: readonly string[];
    }>
  | Readonly<{
      type: "leave";
    }>;

export type SubscribeWorkspaceDragDropEvents = (
  /**
   * Handles each workspace drag-and-drop event.
   * @param event - Normalized workspace drag-and-drop event.
   */
  handler: (event: WorkspaceDragDropEvent) => void,
) => Promise<() => void>;
