import { expect, test } from "vitest";

import {
  decodeFileReview,
  decodeLiteral,
  decodeSimilarity,
  decodeStringArrayInPlace,
  InvalidDiffResponseError,
} from "@/lib/api/tauri/diffPayloadDecoder";

import { createMinimalDetailResponse } from "./specDiffTestFixtures";

test("decodeStringArrayInPlaceはstring配列を同一参照のまま返す", () => {
  const raw = { all: ["src/a.ts", "src/b.ts"] };

  expect(decodeStringArrayInPlace(raw.all, "all", raw)).toBe(raw.all);
});

test("decodeStringArrayInPlaceは空配列を同一参照のまま返す", () => {
  const raw = { all: [] };

  expect(decodeStringArrayInPlace(raw.all, "all", raw)).toBe(raw.all);
});

test("decodeStringArrayInPlaceは1000要素でも同一参照を返す", () => {
  const raw = { all: Array.from({ length: 1000 }, (_, i) => `src/${i}.ts`) };

  expect(decodeStringArrayInPlace(raw.all, "all", raw)).toBe(raw.all);
});

test("decodeStringArrayInPlaceは非string要素をindex付きmessageで拒否する", () => {
  const raw = { all: ["src/a.ts", 42] };

  expect(() => decodeStringArrayInPlace(raw.all, "all", raw)).toThrowError(
    /all\[1\] must be a string/,
  );
});

test.each([
  { name: "null", value: null },
  { name: "文字列", value: "src/a.ts" },
  { name: "オブジェクト", value: {} },
])("decodeStringArrayInPlaceは非配列の$nameを拒否する", ({ value }) => {
  expect(() => decodeStringArrayInPlace(value, "all", value)).toThrowError(
    /all must be an array/,
  );
});

test("decodeFileReviewは抽出後も最小のreview payloadをdecodeする", () => {
  const response = createMinimalDetailResponse();
  const review = decodeFileReview(response.review, "review", response);

  expect(review.file.change).toBe("added");
  expect(review.structuredDiff).toEqual({
    state: "available",
    hunks: [],
    reason: null,
  });
  expect(review.submodule).toBeNull();
});

test.each([
  "available",
  "omitted",
])("decodeLiteralは閉じた集合の値=%sを通す", (value) => {
  expect(decodeLiteral(value, "state", null, ["available", "omitted"])).toBe(
    value,
  );
});

test("decodeLiteralは集合外の値を拒否する", () => {
  expect(() =>
    decodeLiteral("partial", "state", null, ["available", "omitted"]),
  ).toThrowError(/state must be one of available\|omitted/);
});

test.each([0, 100, null])("decodeSimilarityは境界値%sを通す", (value) => {
  expect(decodeSimilarity(value, "similarity", null)).toBe(value);
});

test("decodeSimilarityは101を拒否する", () => {
  expect(() => decodeSimilarity(101, "similarity", null)).toThrowError(
    /similarity must be null or an integer from 0 through 100/,
  );
});

test("InvalidDiffResponseErrorは完全なraw payloadを保持する", () => {
  const raw = { review: { file: null } };
  const error = (() => {
    try {
      decodeFileReview(raw.review, "review", raw);
      return null;
    } catch (thrown) {
      return thrown;
    }
  })();

  expect(error).toBeInstanceOf(InvalidDiffResponseError);
  expect((error as InvalidDiffResponseError).raw).toBe(raw);
  expect((error as InvalidDiffResponseError).code).toBe("invalidResponse");
});
