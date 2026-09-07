import { afterEach, expect, test } from "vitest";

import { CommentTargets } from "../CommentTargets";

const roots: HTMLElement[] = [];

afterEach(() => {
  roots.splice(0).forEach((root) => root.remove());
});

test("find は最初に完全一致するスロットを返す", () => {
  const root = createRoot();
  const other = createSlot("other");
  const first = createSlot("target");
  const second = createSlot("target");
  root.append(other.slot, first.slot, second.slot);

  expect(CommentTargets.find(root, "target")).toBe(first.slot);
});

test("focus は最初の一致スロットの最初のボタンへ移動する", () => {
  const root = createRoot();
  const first = createSlot("target");
  const second = createSlot("target");
  first.slot.append(document.createElement("button"));
  root.append(first.slot, second.slot);

  CommentTargets.focus(root, "target");

  expect(document.activeElement).toBe(first.button);
});

test("null root と対象不在ではフォーカスを変えない", () => {
  const root = createRoot();
  const origin = createSlot("other");
  root.append(origin.slot);
  origin.button.focus();

  expect(CommentTargets.find(null, "target")).toBeNull();
  expect(CommentTargets.focus(null, "target")).toBeUndefined();
  expect(CommentTargets.find(root, "target")).toBeNull();
  expect(CommentTargets.focus(root, "target")).toBeUndefined();
  expect(document.activeElement).toBe(origin.button);
  root.removeChild(origin.slot);
  expect(CommentTargets.find(root, "target")).toBeNull();
});

test("ボタン不在でもスロットは取得できる", () => {
  const root = createRoot();
  const target = createSlot("target");
  const origin = createSlot("other");
  target.button.remove();
  root.append(target.slot, origin.slot);
  origin.button.focus();

  expect(CommentTargets.find(root, "target")).toBe(target.slot);
  CommentTargets.focus(root, "target");
  expect(document.activeElement).toBe(origin.button);
});

test.each([
  "",
  'current:a["b"]:2',
  "current:a:b:2",
])("キー %j をセレクタとして解釈せず完全一致で検索する", (key) => {
  const root = createRoot();
  const other = createSlot(`${key}-other`);
  const target = createSlot(key);
  root.append(other.slot, target.slot);

  expect(CommentTargets.find(root, key)).toBe(target.slot);
  CommentTargets.focus(root, key);
  expect(document.activeElement).toBe(target.button);
});

test("root 自身と外側の一致要素は対象にしない", () => {
  const outside = createRoot();
  const root = createRoot();
  root.setAttribute("data-comment-target-key", "target");
  const target = createSlot("target");
  outside.append(target.slot);
  target.button.focus();

  expect(CommentTargets.find(root, "target")).toBeNull();
  CommentTargets.focus(root, "target");
  expect(document.activeElement).toBe(target.button);
});

test("DOM の削除と再追加を次の検索に反映する", () => {
  const root = createRoot();
  const previous = createSlot("target");
  root.append(previous.slot);
  expect(CommentTargets.find(root, "target")).toBe(previous.slot);
  previous.slot.remove();
  expect(CommentTargets.find(root, "target")).toBeNull();
  const current = createSlot("target");
  root.append(current.slot);

  CommentTargets.focus(root, "target");
  expect(document.activeElement).toBe(current.button);
});

test("取り出した focus も引数の root を毎回使う", () => {
  const rootA = createRoot();
  const rootB = createRoot();
  const targetA = createSlot("target");
  const targetB = createSlot("target");
  rootA.append(targetA.slot);
  rootB.append(targetB.slot);
  const { focus } = CommentTargets;

  expect(CommentTargets.find(rootA, "target")).toBe(targetA.slot);
  focus(rootA, "target");
  expect(document.activeElement).toBe(targetA.button);
  expect(CommentTargets.find(rootB, "target")).toBe(targetB.slot);
  focus(rootB, "target");
  expect(document.activeElement).toBe(targetB.button);
  expect(CommentTargets.find(rootA, "target")).toBe(targetA.slot);
  focus(rootA, "target");
  expect(document.activeElement).toBe(targetA.button);
});

/** @returns A connected search root removed after the test. */
function createRoot(): HTMLDivElement {
  const root = document.createElement("div");
  document.body.append(root);
  roots.push(root);
  return root;
}

/**
 * Creates a comment slot with its control.
 * @param key - Semantic target key.
 * @returns The slot and its button for observable DOM assertions.
 */
function createSlot(key: string): {
  slot: HTMLDivElement;
  button: HTMLButtonElement;
} {
  const slot = document.createElement("div");
  slot.setAttribute("data-comment-target-key", key);
  const button = document.createElement("button");
  slot.append(button);
  return { slot, button };
}
