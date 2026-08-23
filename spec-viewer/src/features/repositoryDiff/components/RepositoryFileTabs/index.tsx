import {
  type KeyboardEvent,
  type ReactElement,
  useEffect,
  useRef,
} from "react";

import type { FileChangeStatus } from "@/features/diff/domain/fileDiff";
import { getFileChangePresentation } from "@/features/diff/lib/fileChangePresentation";

export type RepositoryFileTabItem = Readonly<{
  path: string;
  change: FileChangeStatus | null;
}>;

export type RepositoryFileTabsProps = Readonly<{
  items: readonly RepositoryFileTabItem[];
  activePath: string | null;
  disabled?: boolean;
  onActivate: (path: string) => void;
  onClose: (path: string) => void;
}>;

/**
 * Builds the stable DOM id shared by a repository file tab and its panel.
 *
 * @param path - Repository-relative file path.
 * @returns Encoded tab element id.
 */
export function createRepositoryFileTabId(path: string): string {
  return `repository-file-tab-${encodeURIComponent(path)}`;
}

/**
 * Renders a controlled closeable ARIA tab strip for repository files.
 *
 * @param props - Ordered items, active path, and controlled callbacks.
 * @returns The file tab strip.
 */
export function RepositoryFileTabs(
  props: RepositoryFileTabsProps,
): ReactElement {
  const tablistRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const restoreFocusAfterCloseRef = useRef(false);
  const disabled = props.disabled === true;
  const rovingPath = props.activePath ?? props.items[0]?.path ?? null;

  useEffect(() => {
    if (!restoreFocusAfterCloseRef.current) {
      return;
    }
    restoreFocusAfterCloseRef.current = false;

    if (props.activePath === null) {
      tablistRef.current?.focus();
      return;
    }
    tabRefs.current.get(props.activePath)?.focus();
  }, [props.activePath, props.items]);

  const activateByIndex = (index: number): void => {
    const item = props.items[index];
    if (item === undefined) {
      return;
    }
    props.onActivate(item.path);
    tabRefs.current.get(item.path)?.focus();
  };

  const close = (path: string): void => {
    if (disabled) {
      return;
    }
    restoreFocusAfterCloseRef.current = props.activePath === path;
    props.onClose(path);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
    path: string,
  ): void => {
    if (disabled) {
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      activateByIndex((index + 1) % props.items.length);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      activateByIndex((index - 1 + props.items.length) % props.items.length);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      activateByIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      activateByIndex(props.items.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      props.onActivate(path);
      return;
    }

    const isCloseShortcut =
      event.key === "Delete" ||
      (event.key.toLowerCase() === "w" && (event.ctrlKey || event.metaKey));
    if (!isCloseShortcut) {
      return;
    }
    event.preventDefault();
    close(path);
  };

  return (
    <div className="repository-file-tabs">
      <div
        ref={tablistRef}
        className="repository-file-tabs__tablist"
        role="tablist"
        aria-label="開いている変更ファイル"
        tabIndex={props.items.length === 0 ? 0 : -1}
      >
        {props.items.map((item, index) => {
          const status = getFileChangePresentation(item.change);
          const isActive = props.activePath === item.path;
          return (
            <div
              className="repository-file-tab-shell"
              key={item.path}
              role="presentation"
            >
              <button
                ref={(element) => {
                  if (element === null) {
                    tabRefs.current.delete(item.path);
                  } else {
                    tabRefs.current.set(item.path, element);
                  }
                }}
                id={createRepositoryFileTabId(item.path)}
                className="repository-file-tab"
                type="button"
                role="tab"
                aria-controls="repository-diff-panel"
                aria-selected={isActive}
                disabled={disabled}
                tabIndex={rovingPath === item.path ? 0 : -1}
                title={item.path}
                onClick={() => props.onActivate(item.path)}
                onKeyDown={(event) => handleKeyDown(event, index, item.path)}
              >
                <span
                  className="repository-file-tab__status"
                  aria-label={status.label}
                  data-change={item.change ?? "unchanged"}
                >
                  {status.token}
                </span>
                <span className="repository-file-tab__path">{item.path}</span>
              </button>
              <button
                className="repository-file-tab__close"
                type="button"
                aria-label={`${item.path}を閉じる`}
                disabled={disabled}
                tabIndex={-1}
                onClick={() => close(item.path)}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
