import {
  type KeyboardEvent,
  type ReactElement,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ComparisonRevision,
  type ComparisonRevision as ComparisonRevisionValue,
  type RevisionOption,
  type SpecFileHistory,
} from "@/features/diff/domain/comparisonRevision";

export type RevisionSelectorProps = Readonly<{
  value: ComparisonRevisionValue;
  options: readonly RevisionOption[];
  history: SpecFileHistory;
  optionsStatus: "loading" | "ready" | "failed";
  historyStatus: "loading" | "ready" | "failed";
  isComparing: boolean;
  errorMessage: string | null;
  optionsErrorMessage?: string | null;
  historyErrorMessage?: string | null;
  onChange: (value: ComparisonRevisionValue) => void;
  onRetryOptions: () => void;
  onRetryHistory: () => void;
}>;

type SelectableRevision = Readonly<{
  id: string;
  label: string;
  group: "HEAD" | "Branches" | "Tags" | "ファイル履歴（最新50件）";
  revision: ComparisonRevisionValue;
}>;

const labelForValue = (
  value: ComparisonRevisionValue,
  options: readonly RevisionOption[],
  history: SpecFileHistory,
): string => {
  if (value.kind === "head") {
    return "HEADと比較";
  }
  const option = options.find((candidate) =>
    ComparisonRevision.equals(candidate.revision, value),
  );
  if (option !== undefined) {
    return option.label;
  }
  if (value.kind === "commit") {
    const commit = history.items.find(
      (candidate) => candidate.sha === value.sha,
    );
    return commit === undefined
      ? value.sha.slice(0, 8)
      : `${value.sha.slice(0, 8)} ${commit.message}`;
  }
  return value.name;
};

const selectableRevisions = (
  options: readonly RevisionOption[],
  history: SpecFileHistory,
): readonly SelectableRevision[] => {
  const catalog = options.map(
    (option): SelectableRevision => ({
      id: option.id,
      label: option.revision.kind === "head" ? "HEADと比較" : option.label,
      group:
        option.revision.kind === "head"
          ? "HEAD"
          : option.revision.kind === "localBranch"
            ? "Branches"
            : "Tags",
      revision: option.revision,
    }),
  );
  const commits = history.items.map(
    (commit): SelectableRevision => ({
      id: `commit:${commit.sha}`,
      label: `${commit.sha.slice(0, 8)} ${commit.message}`,
      group: "ファイル履歴（最新50件）",
      revision: { kind: "commit", sha: commit.sha },
    }),
  );
  return [...catalog, ...commits];
};

export function RevisionSelector(props: RevisionSelectorProps): ReactElement {
  const {
    value,
    options,
    history,
    optionsStatus,
    historyStatus,
    isComparing,
    errorMessage,
    optionsErrorMessage = null,
    historyErrorMessage = null,
    onChange,
    onRetryOptions,
    onRetryHistory,
  } = props;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const entries = useMemo(
    () => selectableRevisions(options, history),
    [history, options],
  );
  const entryIndexes = useMemo(
    () => new Map(entries.map((entry, index) => [entry.id, index])),
    [entries],
  );

  const close = (): void => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };
  const open = (): void => {
    const selectedIndex = entries.findIndex((entry) =>
      ComparisonRevision.equals(entry.revision, value),
    );
    setActiveIndex(Math.max(0, selectedIndex));
    setIsOpen(true);
    queueMicrotask(() => listboxRef.current?.focus());
  };
  const select = (entry: SelectableRevision): void => {
    onChange(entry.revision);
    close();
  };
  const handleListKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (entries.length === 0) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex(
        (current) => (current + direction + entries.length) % entries.length,
      );
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const entry = entries[activeIndex];
      if (entry !== undefined) {
        select(entry);
      }
    }
  };
  const groups = [
    "HEAD",
    "Branches",
    "Tags",
    "ファイル履歴（最新50件）",
  ] as const;

  return (
    <div className="revision-selector">
      <button
        ref={triggerRef}
        className="revision-selector__trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="revision-selector-listbox"
        aria-busy={isComparing}
        disabled={isComparing}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={(event) => {
          if (
            !isOpen &&
            (event.key === "ArrowDown" || event.key === "ArrowUp")
          ) {
            event.preventDefault();
            open();
          }
        }}
      >
        {isComparing ? "比較中…" : labelForValue(value, options, history)}
      </button>
      {isOpen ? (
        <div
          id="revision-selector-listbox"
          ref={listboxRef}
          className="revision-selector__listbox"
          role="listbox"
          tabIndex={-1}
          aria-label="比較対象リビジョン"
          aria-activedescendant={entries[activeIndex]?.id}
          onKeyDown={handleListKeyDown}
        >
          {optionsStatus === "loading" ? (
            <p role="status">候補を読み込んでいます。</p>
          ) : null}
          {optionsStatus === "failed" ? (
            <div role="alert">
              <p>{optionsErrorMessage ?? "候補を取得できませんでした。"}</p>
              <button type="button" onClick={onRetryOptions}>
                再試行
              </button>
            </div>
          ) : null}
          {groups.map((group) => {
            const groupEntries = entries.filter(
              (entry) => entry.group === group,
            );
            const isHistoryGroup = group === "ファイル履歴（最新50件）";
            if (groupEntries.length === 0 && group === "HEAD") {
              return null;
            }
            return (
              <section className="revision-selector__group" key={group}>
                <h3>{group}</h3>
                {groupEntries.map((entry) => {
                  const index = entryIndexes.get(entry.id) ?? 0;
                  return (
                    <button
                      id={entry.id}
                      key={entry.id}
                      type="button"
                      role="option"
                      aria-selected={ComparisonRevision.equals(
                        entry.revision,
                        value,
                      )}
                      className={
                        index === activeIndex
                          ? "revision-selector__option revision-selector__option--active"
                          : "revision-selector__option"
                      }
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => select(entry)}
                    >
                      {entry.label}
                    </button>
                  );
                })}
                {isHistoryGroup && historyStatus === "loading" ? (
                  <p role="status">履歴を読み込んでいます。</p>
                ) : null}
                {isHistoryGroup &&
                historyStatus === "ready" &&
                history.items.length === 0 ? (
                  <p>履歴はありません。</p>
                ) : null}
                {isHistoryGroup && historyStatus === "failed" ? (
                  <div role="alert">
                    <p>
                      {historyErrorMessage ?? "履歴を取得できませんでした。"}
                    </p>
                    <button type="button" onClick={onRetryHistory}>
                      再試行
                    </button>
                  </div>
                ) : null}
                {isHistoryGroup && history.truncated ? (
                  <p>古い履歴は省略されています。</p>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : null}
      {errorMessage === null ? null : (
        <p className="revision-selector__error" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
