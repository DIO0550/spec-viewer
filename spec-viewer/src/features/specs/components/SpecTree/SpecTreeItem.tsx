import { ChevronDown, ChevronRight, FileText, Trash2 } from "lucide-react";

import { SpecTreeView } from "@/features/specs/domain/specTreeView";
import type { SpecNode } from "@/features/specs/types/spec";
import { uiText } from "@/shared/lib/uiText";

import { handleTreeItemKeyDown } from "./specTreeItemKeyNav";

type Props = Readonly<{
  node: SpecNode;
  depth: number;
  expandedSpecIds: ReadonlySet<string>;
  selectedSpecId: string | null;
  archivingSpecId: string | null;
  onSelectSpec: (specId: string) => void;
  onArchiveSpec?: (specId: string) => void;
  onToggleExpanded: (specId: string) => void;
}>;

/** @returns One spec tree row plus any child rows. */
export function SpecTreeItem({
  node,
  depth,
  expandedSpecIds,
  selectedSpecId,
  archivingSpecId,
  onSelectSpec,
  onArchiveSpec,
  onToggleExpanded,
}: Props) {
  const isSelected = selectedSpecId === node.id;
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedSpecIds.has(node.id);
  const canArchive =
    onArchiveSpec !== undefined && SpecTreeView.isArchivableNode(node);
  const isArchiving = archivingSpecId === node.id;
  const indentation = SpecTreeView.itemIndentation(depth);

  return (
    <div className="spec-tree__node" role="none">
      <div
        className="spec-tree__row"
        style={{
          paddingInlineStart: indentation,
        }}
      >
        {hasChildren ? (
          <button
            className="icon-button spec-tree__expand"
            type="button"
            aria-label={
              isExpanded ? `${node.label}を折りたたむ` : `${node.label}を展開`
            }
            aria-expanded={isExpanded}
            title={
              isExpanded ? `${node.label}を折りたたむ` : `${node.label}を展開`
            }
            onClick={() => {
              onToggleExpanded(node.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown aria-hidden="true" size={14} />
            ) : (
              <ChevronRight aria-hidden="true" size={14} />
            )}
          </button>
        ) : (
          <span className="spec-tree__expand-spacer" aria-hidden="true" />
        )}
        <button
          className="spec-tree__item"
          type="button"
          role="treeitem"
          aria-level={depth + 1}
          aria-selected={isSelected}
          tabIndex={isSelected || selectedSpecId === null ? 0 : -1}
          onClick={() => {
            onSelectSpec(node.id);
          }}
          onKeyDown={(event) => {
            handleTreeItemKeyDown(event, {
              hasChildren,
              isExpanded,
              onToggleExpanded: () => {
                onToggleExpanded(node.id);
              },
            });
          }}
        >
          <FileText
            className="spec-tree__item-icon"
            aria-hidden="true"
            size={14}
          />
          <span className="spec-tree__item-label">{node.label}</span>
          <span className="spec-tree__file-count">{node.files.length}</span>
        </button>
        {canArchive ? (
          <button
            className="icon-button spec-tree__archive"
            type="button"
            aria-label={`${node.label}をアーカイブへ移動`}
            title={uiText.specTree.archive}
            disabled={archivingSpecId !== null}
            data-archiving={isArchiving ? "true" : "false"}
            onClick={() => {
              onArchiveSpec?.(node.id);
            }}
          >
            <Trash2 aria-hidden="true" size={14} />
          </button>
        ) : (
          <span className="spec-tree__archive-spacer" aria-hidden="true" />
        )}
      </div>
      {hasChildren && isExpanded ? (
        <div className="spec-tree__list">
          {node.children.map((child) => (
            <SpecTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedSpecIds={expandedSpecIds}
              selectedSpecId={selectedSpecId}
              archivingSpecId={archivingSpecId}
              onSelectSpec={onSelectSpec}
              onArchiveSpec={onArchiveSpec}
              onToggleExpanded={onToggleExpanded}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
