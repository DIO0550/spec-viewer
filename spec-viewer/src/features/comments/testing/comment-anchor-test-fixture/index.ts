import {
  CommentAnchor,
  type CommentAnchor as CommentAnchorValue,
  type CommentAnchorParseInput,
} from "@/features/comments/domain/commentAnchor";

type CommentAnchorFixtureInput = Partial<
  Omit<CommentAnchorParseInput, "charRange">
> &
  Readonly<{
    charRange?: Readonly<{ start: unknown; end: unknown }>;
  }>;

const defaultInput: CommentAnchorParseInput = {
  fileKey: "tasks",
  blockType: "paragraph",
  blockIndex: 0,
  textHash: "sha256:7e57a001",
  textSnippet: "Selected test text",
  charRange: { start: 0, end: 18 },
};

/**
 * @param overrides - Valid anchor fields that differ from the shared fixture.
 * @returns A CommentAnchor validated by the production domain constructor.
 * @throws Error when a test supplies an invalid fixture.
 */
export function createCommentAnchorTestFixture(
  overrides: CommentAnchorFixtureInput = {},
): CommentAnchorValue {
  const result = CommentAnchor.parse({
    ...defaultInput,
    ...overrides,
    charRange: overrides.charRange ?? defaultInput.charRange,
  });

  if (!result.ok) {
    throw new Error(
      `Invalid CommentAnchor test fixture: ${result.error.reason}`,
    );
  }

  return result.value;
}
