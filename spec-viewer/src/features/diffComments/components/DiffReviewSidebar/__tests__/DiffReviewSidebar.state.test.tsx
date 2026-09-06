import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import { DiffReviewSidebar } from "@/features/diffComments/components/DiffReviewSidebar";

const containers: HTMLElement[] = [];

afterEach(() => {
  containers.splice(0).forEach((container) => {
    container.remove();
  });
});

test("[R199-REVIEW-006] Open Resolved Allの件数を表示してcontrolled filterを通知する", () => {
  const onFilterChange = vi.fn();
  const view = renderSidebar({ onFilterChange });

  expect(findButton(view, "未解決 2").getAttribute("aria-pressed")).toBe(
    "true",
  );
  expect(findButton(view, "解決済み 1")).not.toBeNull();
  act(() => findButton(view, "すべて 3").click());
  expect(onFilterChange).toHaveBeenCalledWith("all");
});

test("コメント一覧は件数summaryと検索placeholderを持つ", () => {
  const view = renderSidebar();
  expect(view.querySelector(".diff-review-sidebar__summary")?.textContent).toBe(
    "3件",
  );
  expect(
    view.querySelector<HTMLInputElement>("input[type='search']")?.placeholder,
  ).toBe("コメントを検索");
});
test("再読み込みはicon-only buttonとして通知する", () => {
  const onReload = vi.fn();
  const view = renderSidebar({ onReload });
  const reload = findButton(view, "コメントを再読み込み");
  expect(reload.textContent).toBe("");
  expect(reload.classList.contains("icon-button")).toBe(true);
  expect(reload.querySelector("svg")?.getAttribute("width")).toBe("15");
  act(() => reload.click());
  expect(onReload).toHaveBeenCalledTimes(1);
});

test("search inputをcontrolledに通知し一致するcardだけを表示する", () => {
  const onSearchChange = vi.fn();
  const view = renderSidebar({
    filter: "all",
    search: "renamed",
    onSearchChange,
  });
  const input = view.querySelector<HTMLInputElement>("input[type='search']");

  expect(view.textContent).toContain("renamed body");
  expect(view.textContent).not.toContain("open body");
  act(() => {
    if (input !== null) {
      input.value = "next";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  expect(onSearchChange).toHaveBeenCalledWith("next");
});

test("[R199-ANCHOR-003] unavailableとstale cardは理由を表示してjumpを無効にする", () => {
  const onJump = vi.fn();
  const view = renderSidebar({ filter: "all", onJump });
  const unavailableJump = findButton(view, "src/io.ts current 8行目へ移動");
  const staleJump = findButton(view, "src/old.ts base 2行目へ移動");

  expect(unavailableJump.disabled).toBe(true);
  expect(staleJump.disabled).toBe(true);
  expect(view.textContent).toContain("一時的に利用できません: io");
  expect(view.textContent).toContain("古いアンカー: deleted");
  expect(onJump).not.toHaveBeenCalled();
});

test("jumpable cardを選択してaria-currentを表現する", () => {
  const onSelectComment = vi.fn();
  const onJump = vi.fn();
  const view = renderSidebar({
    selectedCommentId: "open",
    onSelectComment,
    onJump,
  });
  const card = view.querySelector<HTMLElement>("[data-comment-id='open']");

  expect(card?.getAttribute("aria-current")).toBe("true");
  act(() => findButton(view, "src/file.ts current 4行目へ移動").click());
  expect(onSelectComment).toHaveBeenCalledWith("open");
  expect(onJump).toHaveBeenCalledWith("open");
});

test("comment cardはsemantic buttonで選択できaria-currentとfocusを持つ", () => {
  const onSelectComment = vi.fn();
  const view = renderSidebar({
    selectedCommentId: "open",
    onSelectComment,
  });
  const select = findButton(view, "src/file.ts current 4行目のコメントを選択");

  expect(select.getAttribute("aria-current")).toBe("true");
  expect(document.activeElement).toBe(select);
  act(() => select.click());
  expect(onSelectComment).toHaveBeenCalledWith("open");
});

test("未解決cardは開いたまま手動で閉じ、解決済みcardは閉じた状態から開ける", () => {
  const view = renderSidebar({ filter: "all" });
  const openCard = view.querySelector<HTMLElement>("[data-comment-id='open']");
  const resolvedCard = view.querySelector<HTMLElement>(
    "[data-comment-id='renamed']",
  );

  const openContent = openCard?.querySelector<HTMLElement>(
    ".review-comment__content",
  );
  const resolvedContent = resolvedCard?.querySelector<HTMLElement>(
    ".review-comment__content",
  );
  expect(openContent?.hidden).toBe(false);
  expect(resolvedContent?.hidden).toBe(true);

  act(() => findButton(view, "コメントを折りたたむ open").click());
  expect(openContent?.hidden).toBe(true);

  act(() => findButton(view, "コメントを展開 renamed").click());
  expect(resolvedContent?.hidden).toBe(false);
});

test("返信一覧を表示しtrimした返信を保存する", async () => {
  const onReply = vi.fn().mockResolvedValue(true);
  const view = renderSidebar({ onReply });
  expect(view.textContent).toContain("existing reply");

  const editor = view.querySelector<HTMLTextAreaElement>(
    '[aria-label="返信本文 open"]',
  );
  if (editor === null) {
    throw new Error("reply editor not found");
  }
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    setter?.call(editor, "  follow up  ");
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => findButton(view, "返信を送信 open").click());

  expect(onReply).toHaveBeenCalledWith("open", "follow up");
  expect(editor.value).toBe("");
});

test("[R199-PERF-003] 10k Review commentを最大100 cardにmaterializeし選択cardを含める", () => {
  const comments = Array.from({ length: 10_000 }, (_, index) => ({
    id: `comment-${index}`,
    body: `body-${index}`,
    status: "open" as const,
    locationLabel: `src/file-${index}.ts current 4行目`,
    snippet: `line-${index}`,
    resolution: { status: "exact" as const },
  }));
  const view = renderSidebar({
    comments,
    filter: "all",
    selectedCommentId: "comment-9999",
  });

  expect(view.querySelectorAll("article[data-comment-id]")).toHaveLength(100);
  expect(view.querySelector("[data-comment-id='comment-9999']")).not.toBeNull();
});

test("共通Review cardで本文編集とresolve/reopenを通知し同一comment mutationを無効化する", () => {
  const onUpdate = vi.fn();
  const onResolve = vi.fn();
  const view = renderSidebar({ onUpdate, onResolve });

  act(() => findButton(view, "コメントを編集 open").click());
  const editor = view.querySelector<HTMLTextAreaElement>(
    '[aria-label="コメント本文 open"]',
  );
  if (editor === null) {
    throw new Error("comment editor not found");
  }
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    setter?.call(editor, "updated body");
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => findButton(view, "保存 open").click());
  expect(onUpdate).toHaveBeenCalledWith("open", "updated body");

  const mutating = renderSidebar({
    mutatingCommentId: "open",
    onResolve,
  });
  expect(findButton(mutating, "解決 open").disabled).toBe(true);
  act(() => findButton(mutating, "解決 open").click());
  expect(onResolve).not.toHaveBeenCalled();
});

test("本文更新が競合するとdraftと編集focusを保持して再保存できる", async () => {
  const onUpdate = vi
    .fn()
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true);
  const view = renderSidebar({ onUpdate });

  act(() => findButton(view, "コメントを編集 open").click());
  const editor = view.querySelector<HTMLTextAreaElement>(
    '[aria-label="コメント本文 open"]',
  );
  if (editor === null) {
    throw new Error("comment editor not found");
  }
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    setter?.call(editor, "conflict-safe edit");
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await act(async () => findButton(view, "保存 open").click());
  expect(editor.value).toBe("conflict-safe edit");
  expect(document.activeElement).toBe(editor);

  await act(async () => findButton(view, "保存 open").click());
  expect(view.querySelector('[aria-label="コメント本文 open"]')).toBeNull();
});

test.each([
  "revisionOverflow",
  "permission",
  "invalidStore",
] as const)("%sでは全card mutationを無効化して理由を表示する", (mutationDisabledReason) => {
  const onResolve = vi.fn();
  const view = renderSidebar({ mutationDisabledReason, onResolve });

  const resolve = findButton(view, "解決 open");
  expect(resolve.disabled).toBe(true);
  act(() => resolve.click());
  expect(onResolve).not.toHaveBeenCalled();
  expect(view.firstElementChild?.getAttribute("data-disabled-reason")).toBe(
    mutationDisabledReason,
  );
});

test("削除確認は通常actionと入れ替わりcancel後に復元してからcomment IDを通知する", () => {
  const onDelete = vi.fn();
  const view = renderSidebar({ onDelete });

  act(() => findButton(view, "削除 open").click());
  const confirmation = view.querySelector(
    ".review-comment__delete-confirmation[role='alert']",
  );
  expect(confirmation?.textContent).toContain(
    "このコメントを完全に削除しますか？",
  );
  expect(
    view.querySelector("[data-comment-id='open'] .diff-review-card__actions"),
  ).toBeNull();

  act(() => findButton(view, "削除をキャンセル open").click());
  expect(
    view.querySelector("[data-comment-id='open'] .diff-review-card__actions"),
  ).not.toBeNull();

  act(() => findButton(view, "削除 open").click());
  act(() => findButton(view, "コメント削除を確定 open").click());
  expect(onDelete).toHaveBeenCalledWith("open");
});

function renderSidebar(
  overrides: Partial<Parameters<typeof DiffReviewSidebar>[0]> = {},
): HTMLElement {
  const container = document.createElement("div");
  document.body.append(container);
  containers.push(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <DiffReviewSidebar
        comments={createComments()}
        filter="open"
        search=""
        selectedCommentId={null}
        loadState="ready"
        warnings={[]}
        onFilterChange={() => undefined}
        onSearchChange={() => undefined}
        onSelectComment={() => undefined}
        onUpdate={() => undefined}
        mutatingCommentId={null}
        onJump={() => undefined}
        onResolve={() => undefined}
        onReopen={() => undefined}
        {...overrides}
      />,
    );
  });
  return container;
}

function createComments(): Parameters<typeof DiffReviewSidebar>[0]["comments"] {
  return [
    {
      id: "open",
      body: "open body",
      status: "open",
      locationLabel: "src/file.ts current 4行目",
      snippet: "return value",
      resolution: { status: "exact" },
      replies: [
        {
          id: "reply-1",
          body: "existing reply",
          createdAt: "2026-08-21T00:00:00Z",
        },
      ],
    },
    {
      id: "io",
      body: "io body",
      status: "open",
      locationLabel: "src/io.ts current 8行目",
      snippet: "load source",
      resolution: { status: "unavailable", reason: "io" },
    },
    {
      id: "renamed",
      body: "renamed body",
      status: "resolved",
      locationLabel: "src/old.ts base 2行目",
      snippet: "old line",
      resolution: { status: "stale", reason: "deleted" },
    },
  ];
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) =>
      candidate.textContent?.trim() === label ||
      candidate.getAttribute("aria-label") === label,
  );
  if (button === undefined) {
    throw new Error(`button not found: ${label}`);
  }
  return button;
}
