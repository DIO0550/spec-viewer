import type { SpecNode, SpecNodeKind } from "@/features/specs/domain/specNode";

export type SpecNodeFixtureInput = Readonly<{
  id: string;
  label: string;
  kind?: SpecNodeKind;
  sourceGroupId?: string;
  relativeId?: string;
  presentDocumentCount?: number;
  descendantSpecCount?: number;
  files?: SpecNode["files"];
  children?: SpecNode["children"];
}>;

/**
 * Creates a complete SpecNode fixture with stable semantic defaults.
 * @param input - Required identity plus optional semantic overrides
 * @returns A SpecNode fixture matching the IPC contract.
 */
export function createSpecNodeFixture(input: SpecNodeFixtureInput): SpecNode {
  const files = input.files ?? [];
  const children = input.children ?? [];
  const kind: SpecNodeKind = input.kind ?? "spec";
  const descendantSpecCount = children.reduce(
    (count, child) =>
      count + (child.kind === "spec" ? 1 : 0) + child.descendantSpecCount,
    0,
  );

  return {
    id: input.id,
    label: input.label,
    kind,
    sourceGroupId: input.sourceGroupId ?? "primary",
    relativeId: input.relativeId ?? input.id,
    presentDocumentCount:
      input.presentDocumentCount ??
      files.filter((file) => file.status === "present").length,
    descendantSpecCount: input.descendantSpecCount ?? descendantSpecCount,
    files,
    children,
  };
}
