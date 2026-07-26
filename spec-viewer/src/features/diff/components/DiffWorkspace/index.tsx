import { ChevronDown, FileCode2, Folder, GitBranch, X } from "lucide-react";
import type { ReactElement } from "react";

type DiffLineKind = "context" | "added" | "removed";

type DiffLine = Readonly<{
  oldNumber: string;
  newNumber: string;
  kind: DiffLineKind;
  code: string;
}>;

const DiffLines: readonly DiffLine[] = [
  {
    oldNumber: "12",
    newNumber: "12",
    kind: "context",
    code: "export class Scorer {",
  },
  {
    oldNumber: "13",
    newNumber: "13",
    kind: "context",
    code: "  private hands: Hand[];",
  },
  {
    oldNumber: "14",
    newNumber: "",
    kind: "removed",
    code: "  score(): number {",
  },
  {
    oldNumber: "15",
    newNumber: "",
    kind: "removed",
    code: "    return this.hands",
  },
  {
    oldNumber: "16",
    newNumber: "",
    kind: "removed",
    code: "      .reduce((a, h) => a + h.value, 0);",
  },
  {
    oldNumber: "17",
    newNumber: "",
    kind: "removed",
    code: "  }",
  },
  {
    oldNumber: "",
    newNumber: "14",
    kind: "added",
    code: "  score(ctx: Ctx): Result {",
  },
  {
    oldNumber: "",
    newNumber: "15",
    kind: "added",
    code: "    const yaku = detectYaku(ctx);",
  },
  {
    oldNumber: "",
    newNumber: "16",
    kind: "added",
    code: "    const fu = calcFu(ctx);",
  },
  {
    oldNumber: "",
    newNumber: "17",
    kind: "added",
    code: "    const han = yaku.reduce((sum, item) => sum + item.han, 0);",
  },
  {
    oldNumber: "",
    newNumber: "18",
    kind: "added",
    code: "    return build({ yaku, fu, han });",
  },
  {
    oldNumber: "",
    newNumber: "19",
    kind: "added",
    code: "  }",
  },
  {
    oldNumber: "18",
    newNumber: "20",
    kind: "context",
    code: "",
  },
  {
    oldNumber: "19",
    newNumber: "21",
    kind: "context",
    code: "  addHand(hand: Hand) {",
  },
  {
    oldNumber: "20",
    newNumber: "22",
    kind: "context",
    code: "    this.hands.push(hand);",
  },
] as const;

/**
 * Displays the visual-only Diff workspace based on the provided design mockup.
 *
 * @returns The static changes tree and unified diff preview.
 */
export function DiffWorkspace(): ReactElement {
  return (
    <div className="diff-workspace">
      <aside className="changes-panel" aria-label="Changes">
        <div className="changes-panel__header">
          <strong>Changes</strong>
          <span>4 files</span>
        </div>
        <div className="segmented-control segmented-control--wide">
          <button type="button" aria-pressed="true">
            Changed
          </button>
          <button type="button" aria-pressed="false">
            All
          </button>
        </div>
        <div className="changes-panel__summary">
          <span className="diff-stat diff-stat--added">+80</span>
          <span className="diff-stat diff-stat--removed">−9</span>
          <span>main ↔ agent-a1b3ff42</span>
        </div>
        <nav className="changes-tree" aria-label="変更ファイル">
          <div className="changes-tree__folder">
            <ChevronDown aria-hidden="true" size={12} />
            <Folder aria-hidden="true" size={14} />
            <span>src</span>
          </div>
          <div className="changes-tree__folder changes-tree__folder--nested">
            <ChevronDown aria-hidden="true" size={12} />
            <Folder aria-hidden="true" size={14} />
            <span>hands</span>
          </div>
          <ChangeFile status="A" name="riichi.ts" added={38} />
          <ChangeFile status="M" name="pinfu.ts" added={6} removed={2} />
          <ChangeFile
            status="M"
            name="scorer.ts"
            added={12}
            removed={4}
            isActive={true}
          />
          <ChangeFile status="M" name="scorer.test.ts" added={24} removed={3} />
        </nav>
      </aside>
      <section className="diff-preview" aria-label="src/scorer.ts の差分">
        <div className="diff-tabs" role="tablist" aria-label="変更ファイルタブ">
          <DiffTab label="scorer.ts" stats="+12 −4" isActive={true} />
          <DiffTab label="riichi.ts" stats="+38" />
          <DiffTab label="pinfu.ts" stats="+6 −2" />
          <DiffTab label="scorer.test.ts" stats="+24 −3" />
        </div>
        <header className="diff-preview__header">
          <div>
            <strong>src/scorer.ts</strong>
            <span className="branch-badge">
              <GitBranch aria-hidden="true" size={12} />
              main ↔ agent-a1b3ff42
            </span>
          </div>
          <span className="diff-stat-group">
            <span className="diff-stat diff-stat--added">+12</span>
            <span className="diff-stat diff-stat--removed">−4</span>
          </span>
        </header>
        <div className="unified-diff">
          <div className="unified-diff__hunk">
            <span>@@ -12,7 +12,15 @@</span>
            <span>export class Scorer</span>
          </div>
          {DiffLines.map((line) => (
            <DiffCodeLine
              key={`${line.kind}-${line.oldNumber}-${line.newNumber}-${line.code}`}
              line={line}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

/**
 * @param props - File state, name, stats and selection.
 * @returns A static changed-file tree row.
 */
function ChangeFile({
  status,
  name,
  added,
  removed,
  isActive = false,
}: Readonly<{
  status: "A" | "M";
  name: string;
  added: number;
  removed?: number;
  isActive?: boolean;
}>): ReactElement {
  return (
    <div
      className="changes-tree__file"
      aria-current={isActive ? "page" : undefined}
    >
      <span className={`changes-tree__status changes-tree__status--${status}`}>
        {status}
      </span>
      <FileCode2 aria-hidden="true" size={13} />
      <span className="changes-tree__name">{name}</span>
      <span className="changes-tree__stats">
        <span className="diff-stat--added">+{added}</span>
        {removed === undefined ? null : (
          <span className="diff-stat--removed">−{removed}</span>
        )}
      </span>
    </div>
  );
}

/**
 * @param props - Tab label, stats and selection.
 * @returns A static diff file tab.
 */
function DiffTab({
  label,
  stats,
  isActive = false,
}: Readonly<{
  label: string;
  stats: string;
  isActive?: boolean;
}>): ReactElement {
  return (
    <div className="diff-tabs__tab" data-active={isActive}>
      <span className="diff-tabs__dot" aria-hidden="true" />
      <span>{label}</span>
      <small>{stats}</small>
      <X aria-hidden="true" size={12} />
    </div>
  );
}

/**
 * @param props - Diff line model.
 * @returns A unified diff line.
 */
function DiffCodeLine({ line }: Readonly<{ line: DiffLine }>): ReactElement {
  const sign = getDiffLineSign(line.kind);

  return (
    <div className="diff-code-line" data-kind={line.kind}>
      <span className="diff-code-line__comment-indicator" aria-hidden="true">
        +
      </span>
      <span className="diff-code-line__number">{line.oldNumber}</span>
      <span className="diff-code-line__number">{line.newNumber}</span>
      <span className="diff-code-line__sign">{sign}</span>
      <code>{line.code || " "}</code>
    </div>
  );
}

/**
 * @param kind - Visual kind of the diff line.
 * @returns The unified diff marker for the line kind.
 */
function getDiffLineSign(kind: DiffLineKind): string {
  if (kind === "added") {
    return "+";
  }

  if (kind === "removed") {
    return "−";
  }

  return "";
}
