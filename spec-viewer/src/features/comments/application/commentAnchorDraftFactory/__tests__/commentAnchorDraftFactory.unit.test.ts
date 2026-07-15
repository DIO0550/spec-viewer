import { expect, test } from "vitest";

import {
  CommentAnchorDraftFactory,
  createTextSnippet,
  type RenderedBlockSnapshot,
} from "@/features/comments/application/commentAnchorDraftFactory";
import {
  BlockIdentity,
  TextHash,
  type CommentAnchorParseResult,
} from "@/features/comments/domain/commentAnchor";
import fixture from "../../../../../../test-fixtures/markdown-anchor-fingerprint-v1.json";

function expectValue<T>(result: CommentAnchorParseResult<T>): T {
  expect(result.ok).toBe(true);
  return (result as Readonly<{ ok: true; value: T }>).value;
}

function createSnapshot(
  overrides: Partial<RenderedBlockSnapshot> = {},
): RenderedBlockSnapshot {
  return {
    identity: expectValue(
      BlockIdentity.parse({ blockType: "paragraph", blockIndex: 3 }),
    ),
    text: "Alpha beta gamma",
    textHash: expectValue(TextHash.parseCanonical("sha256:a5dd5c34")),
    ...overrides,
  };
}

test("snapshotとselection offsetから純粋にアンカードラフトを生成する", () => {
  const result = CommentAnchorDraftFactory.create({
    fileKey: "tasks",
    block: createSnapshot(),
    selectionOffsets: { start: 6, end: 10 },
  });

  expect(result).toEqual({
    ok: true,
    value: {
      anchor: {
        fileKey: "tasks",
        blockType: "paragraph",
        blockIndex: 3,
        textHash: "sha256:a5dd5c34",
        textSnippet: "beta",
        charRange: { start: 6, end: 10 },
      },
    },
  });
});

test("backend canonical hashをanchor fingerprintに使う", () => {
  const result = CommentAnchorDraftFactory.create({
    fileKey: "impl",
    block: createSnapshot({
      textHash: expectValue(TextHash.parseCanonical("sha256:abc12345")),
    }),
    selectionOffsets: { start: 0, end: 5 },
  });

  expect(result).toMatchObject({
    ok: true,
    value: {
      anchor: {
        textHash: "sha256:abc12345",
        textSnippet: "Alpha",
      },
    },
  });
});

test("selection offsetがsnapshot textを越える場合はtyped errorを返す", () => {
  expect(
    CommentAnchorDraftFactory.create({
      fileKey: "tasks",
      block: createSnapshot(),
      selectionOffsets: { start: 6, end: 40 },
    }),
  ).toEqual({
    ok: false,
    error: {
      reason: "invalid_char_range",
      start: 6,
      end: 40,
    },
  });
});

test("選択文字列の空白を正規化してsnippet上限で切り詰める", () => {
  const selectedText = `  alpha\n beta\t${"word ".repeat(40)}tail  `;
  const result = CommentAnchorDraftFactory.create({
    fileKey: "tasks",
    block: createSnapshot({ text: selectedText }),
    selectionOffsets: { start: 0, end: selectedText.length },
  });
  const draft = expectValue(result);

  expect(draft.anchor.textSnippet.length).toBe(160);
  expect(draft.anchor.textSnippet).not.toContain("\n");
});

test("snippet上限をUTF-16 code unitではなくUnicode scalarで数える", () => {
  const selectedText = `${"a".repeat(159)}😀Z`;
  const result = CommentAnchorDraftFactory.create({
    fileKey: "tasks",
    block: createSnapshot({ text: selectedText }),
    selectionOffsets: { start: 0, end: selectedText.length },
  });
  const draft = expectValue(result);

  expect([...draft.anchor.textSnippet]).toHaveLength(160);
  expect(draft.anchor.textSnippet).toBe(`${"a".repeat(159)}😀`);
});

test("shared fixtureがsnippet正規化とUnicode scalar上限を固定する", () => {
  expect(fixture.contract.snippetMaxUnicodeScalars).toBe(160);

  for (const testCase of fixture.cases) {
    expect(createTextSnippet(testCase.snippetSource)).toBe(testCase.snippet);
  }
});

test("backend metadataがないsnapshotはfail closedで拒否する", () => {
  expect(
    CommentAnchorDraftFactory.create({
      fileKey: "tasks",
      block: createSnapshot({ textHash: null }),
      selectionOffsets: { start: 0, end: 5 },
    }),
  ).toEqual({
    ok: false,
    error: { reason: "invalid_text_hash", value: null },
  });
});

test("空白だけのselectionはtyped snippet errorを返す", () => {
  expect(
    CommentAnchorDraftFactory.create({
      fileKey: "tasks",
      block: createSnapshot({ text: "   " }),
      selectionOffsets: { start: 0, end: 3 },
    }),
  ).toEqual({
    ok: false,
    error: { reason: "invalid_text_snippet", value: null },
  });
});
