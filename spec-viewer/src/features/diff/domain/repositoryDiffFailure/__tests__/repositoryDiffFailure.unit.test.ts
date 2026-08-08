import { expect, test } from "vitest";

import { DiffAvailability } from "@/features/diff/domain/diffAvailability";
import {
  REPOSITORY_INVALID_INPUT_CODES,
  REPOSITORY_TRANSIENT_CODES,
  RepositoryDiffFailure,
} from "@/features/diff/domain/repositoryDiffFailure";
import { REPOSITORY_BACKEND_ERROR_CODES } from "@/lib/api/tauri/repositoryDiffCommandError";

const UNAVAILABLE_CODES = [
  "notRepository",
  "bareRepository",
  "worktreeUnavailable",
  "gitUnavailable",
  "unbornHead",
  "commonDirBoundaryEscape",
];

const STALE_CODES = [
  "staleSnapshot",
  "headChangedDuringRead",
  "staleBase",
  "entryChangedDuringRead",
  "staleCursor",
  "invalidCursor",
];

/**
 * Builds a normalized command error for the given code.
 *
 * @param code - Backend error code to embed.
 * @returns A command error shaped like the IPC wrapper's output.
 */
function createCommandError(code: string) {
  return {
    command: "load_repository_diff" as const,
    code,
    message: `${code} failed`,
    raw: null,
  };
}

test.each(UNAVAILABLE_CODES)("code=%sをunavailableへ分類する", (code) => {
  const failure = RepositoryDiffFailure.fromCommandError(
    createCommandError(code),
  );

  expect(failure).toMatchObject({ kind: "unavailable", code });
});

test.each(STALE_CODES)("code=%sをstaleへ分類する", (code) => {
  expect(
    RepositoryDiffFailure.fromCommandError(createCommandError(code)),
  ).toMatchObject({ kind: "stale", code });
});

test.each(
  REPOSITORY_INVALID_INPUT_CODES,
)("code=%sをinvalidInputへ分類する", (code) => {
  expect(
    RepositoryDiffFailure.fromCommandError(createCommandError(code)),
  ).toMatchObject({ kind: "invalidInput", code });
});

test.each(
  REPOSITORY_TRANSIENT_CODES,
)("code=%sをtransientへ分類する", (code) => {
  expect(
    RepositoryDiffFailure.fromCommandError(createCommandError(code)),
  ).toMatchObject({ kind: "transient", code });
});

test("invalidResponseを専用kindへ分類する", () => {
  expect(
    RepositoryDiffFailure.fromCommandError(
      createCommandError("invalidResponse"),
    ),
  ).toMatchObject({ kind: "invalidResponse" });
});

test.each(
  REPOSITORY_BACKEND_ERROR_CODES,
)("backend code=%sはunknownへ落ちない", (code) => {
  expect(
    RepositoryDiffFailure.fromCommandError(createCommandError(code)).kind,
  ).not.toBe("unknown");
});

test("分類の内訳は6 + 6 + 2 + 10 = 24 codeを覆う", () => {
  expect(
    UNAVAILABLE_CODES.length +
      STALE_CODES.length +
      REPOSITORY_INVALID_INPUT_CODES.length +
      REPOSITORY_TRANSIENT_CODES.length,
  ).toBe(24);
});

test.each([
  ...UNAVAILABLE_CODES,
  ...STALE_CODES,
])("code=%sのkindはDiffAvailabilityの判定と一致する", (code) => {
  const failure = RepositoryDiffFailure.fromCommandError(
    createCommandError(code),
  );

  expect(failure.kind === "unavailable").toBe(
    DiffAvailability.isRepositoryWideUnavailable(code),
  );
  expect(failure.kind === "stale").toBe(DiffAvailability.isStale(code));
});

test.each(
  REPOSITORY_BACKEND_ERROR_CODES,
)("code=%sのfailureはcauseを同一参照で保持する", (code) => {
  const error = createCommandError(code);

  expect(RepositoryDiffFailure.fromCommandError(error).cause).toBe(error);
});

test.each(
  REPOSITORY_BACKEND_ERROR_CODES,
)("code=%sのfailureはfeature=diffを持つ", (code) => {
  expect(
    RepositoryDiffFailure.fromCommandError(createCommandError(code)).feature,
  ).toBe("diff");
});

test("commandとrawを持たない素のcode/messageも分類できる", () => {
  const cause = { code: "notRepository", message: "not a repository" };

  const failure = RepositoryDiffFailure.fromCommandError(cause);

  expect(failure).toMatchObject({ kind: "unavailable", code: "notRepository" });
  expect(failure.cause).toBe(cause);
});

test.each([
  { name: "codeが非string", value: { code: 42, message: "boom" } },
  { name: "messageが欠落", value: { code: "io" } },
  { name: "空オブジェクト", value: {} },
])("$nameの値はunknownへ落とす", ({ value }) => {
  expect(RepositoryDiffFailure.fromCommandError(value).kind).toBe("unknown");
});

test("未知codeはunknownへ落とす", () => {
  expect(
    RepositoryDiffFailure.fromCommandError(createCommandError("somethingElse")),
  ).toMatchObject({ kind: "unknown", message: "somethingElse failed" });
});

test.each([
  { name: "null", value: null },
  { name: "文字列", value: "boom" },
  { name: "数値", value: 42 },
  { name: "undefined", value: undefined },
])("非オブジェクトの$nameをunknownへ落とす", ({ value }) => {
  const failure = RepositoryDiffFailure.fromCommandError(value);

  expect(failure.kind).toBe("unknown");
  expect(failure.cause).toBe(value);
});

test.each([
  ["unavailable", "notRepository", false],
  ["stale", "staleSnapshot", true],
  ["invalidInput", "invalidInput", false],
  ["transient", "io", false],
  ["invalidResponse", "invalidResponse", false],
  ["unknown", "somethingElse", false],
] as const)("isRecoverableByReloadはkind=%sで%sのときのみtrueを返す", (_kind, code, expected) => {
  expect(
    RepositoryDiffFailure.isRecoverableByReload(
      RepositoryDiffFailure.fromCommandError(createCommandError(code)),
    ),
  ).toBe(expected);
});
