import { expect, test } from "vitest";

import fixture from "../../../../../../test-fixtures/markdown-anchor-fingerprint-v1.json";
import {
  CANONICAL_FINGERPRINT_ALGORITHM,
  CANONICAL_FINGERPRINT_PREFIX_LENGTH,
  MARKDOWN_ANCHOR_FINGERPRINT_CONTRACT,
  MARKDOWN_ANCHOR_NORMALIZATION_VERSION,
  TextHash,
} from "@/features/comments/domain/commentAnchor";

test("shared fixtureがcanonical fingerprint契約を固定する", () => {
  expect(fixture.contract).toEqual({
    id: MARKDOWN_ANCHOR_FINGERPRINT_CONTRACT,
    normalization: MARKDOWN_ANCHOR_NORMALIZATION_VERSION,
    algorithm: CANONICAL_FINGERPRINT_ALGORITHM,
    prefixLength: CANONICAL_FINGERPRINT_PREFIX_LENGTH,
    wireFormat: "sha256:<8 lowercase hex>",
    snippetPurpose: "selected-text-display-and-fuzzy-recovery",
    snippetMaxUnicodeScalars: 160,
  });

  for (const testCase of fixture.cases) {
    expect(TextHash.parseCanonical(testCase.fingerprint)).toEqual({
      ok: true,
      value: testCase.fingerprint,
    });
  }
});

test("persisted restoreはlegacy FNV-1a fingerprintを保持する", () => {
  const result = TextHash.parse("fnv1a:89abcdef");

  expect(result).toEqual({ ok: true, value: "fnv1a:89abcdef" });
  expect(result.ok && TextHash.isLegacyFnv1a(result.value)).toBe(true);
});

test("新規anchor用canonical parserはlegacy FNV-1aを拒否する", () => {
  expect(TextHash.parseCanonical("fnv1a:89abcdef")).toEqual({
    ok: false,
    error: { reason: "invalid_text_hash", value: "fnv1a:89abcdef" },
  });
});

test.each([
  "md5:89abcdef",
  "sha256:89abcde",
  "sha256:89abcdef0",
  "sha256:89ABCDEF",
  "sha256:89abcdeg",
  "sha256: 89abcdef",
  " sha256:89abcdef",
  "sha256:89abcdef ",
  " fnv1a:89abcdef",
  "fnv1a:89abcdef ",
])("unknownまたはmalformed fingerprint %sを拒否する", (value) => {
  expect(TextHash.parse(value)).toEqual({
    ok: false,
    error: { reason: "invalid_text_hash", value },
  });
});
