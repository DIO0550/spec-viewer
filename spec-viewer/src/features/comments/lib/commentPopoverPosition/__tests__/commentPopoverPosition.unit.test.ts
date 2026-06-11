import { expect, test } from "vitest";

import { CommentPopoverPosition } from "@/features/comments/lib/commentPopoverPosition";
import type {
  CommentAnchorDraft,
  CommentSelectionBounds,
} from "@/features/comments/types/comment";

const VIEWPORT_WIDTH = 1200;
const VIEWPORT_HEIGHT = 900;

window.innerWidth = VIEWPORT_WIDTH;
window.innerHeight = VIEWPORT_HEIGHT;

/**
 * @param bounds - Selection bounds for the draft
 * @returns A comment anchor draft fixture.
 */
function createDraft(bounds: CommentSelectionBounds): CommentAnchorDraft {
  return {
    anchor: {
      fileKey: "tasks",
      blockType: "paragraph",
      blockIndex: 0,
      textHash: "sha256:first",
      textSnippet: "Clarify this task",
      charRange: { start: 0, end: 17 },
    },
    selectionBounds: bounds,
  };
}

test("createPopoverStyleは選択範囲の下に余白付きで配置する", () => {
  const style = CommentPopoverPosition.createPopoverStyle({
    top: 100,
    left: 200,
    width: 300,
    height: 20,
  });

  expect(style).toEqual({ top: 130, left: 200 });
});

test("createPopoverStyleは下に入らない場合選択範囲の上へ配置する", () => {
  const style = CommentPopoverPosition.createPopoverStyle({
    top: 700,
    left: 200,
    width: 300,
    height: 20,
  });

  expect(style).toEqual({ top: 700 - 360 - 10, left: 200 });
});

test("createPopoverStyleは画面端で最小マージンに丸める", () => {
  const style = CommentPopoverPosition.createPopoverStyle({
    top: 0,
    left: VIEWPORT_WIDTH,
    width: 0,
    height: 0,
  });

  expect(style.left).toBe(VIEWPORT_WIDTH - 382 - 8);
  expect(style.top).toBe(10);
});

test("createFloatingStyleのbuttonは選択範囲の上中央へ配置する", () => {
  const style = CommentPopoverPosition.createFloatingStyle(
    createDraft({ top: 100, left: 200, width: 100, height: 20 }),
    "button",
  );

  expect(style).toEqual({ top: 56, left: 250, transform: undefined });
});

test("createFloatingStyleのbuttonはコメントレーン位置を優先する", () => {
  const style = CommentPopoverPosition.createFloatingStyle(
    createDraft({
      top: 100,
      left: 200,
      width: 100,
      height: 20,
      commentLaneLeft: 640,
    }),
    "button",
  );

  expect(style).toEqual({ top: 56, left: 640, transform: "none" });
});

test("createFloatingStyleのpopoverはコメントレーン位置から配置する", () => {
  const style = CommentPopoverPosition.createFloatingStyle(
    createDraft({
      top: 100,
      left: 200,
      width: 100,
      height: 20,
      commentLaneLeft: 640,
    }),
    "popover",
  );

  expect(style).toEqual({ top: 130, left: 640 });
});

test("boundsFromElementは要素の表示位置をそのまま返す", () => {
  const element = document.createElement("button");
  element.getBoundingClientRect = () =>
    ({
      top: 12,
      left: 34,
      width: 56,
      height: 78,
    }) as DOMRect;

  expect(CommentPopoverPosition.boundsFromElement(element)).toEqual({
    top: 12,
    left: 34,
    width: 56,
    height: 78,
  });
});
