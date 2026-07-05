export type HtmlSearchIndex = Readonly<{
  normalizedText: string;
}>;

export type HtmlSearchMatch = Readonly<{
  index: number;
  start: number;
  end: number;
}>;

type NormalizedTextMap = Readonly<{
  normalizedText: string;
  positions: readonly NormalizedTextPosition[];
}>;

type NormalizedTextPosition = Readonly<{
  nodeIndex: number;
  offset: number;
}>;

type TextRange = Readonly<{
  start: number;
  end: number;
  matchIndex: number;
}>;

const excludedSearchNodeSelector = "script, style, template, head, noscript";

/**
 * @param contents - Raw HTML document string to index.
 * @returns A searchable index built from visible HTML body text.
 */
export function createHtmlSearchIndex(contents: string): HtmlSearchIndex {
  const document = parseHtmlDocument(contents);
  const textNodes = collectSearchableTextNodes(document);
  const textMap = createNormalizedTextMap(textNodes);

  return {
    normalizedText: textMap.normalizedText,
  };
}

/**
 * @param index - Searchable index built by createHtmlSearchIndex.
 * @param query - Raw search query string.
 * @returns Non-overlapping HTML search matches in document order.
 */
export function findHtmlSearchMatches(
  index: HtmlSearchIndex,
  query: string,
): readonly HtmlSearchMatch[] {
  const normalizedQuery = normalizeHtmlSearchQuery(query);

  if (normalizedQuery.length === 0) {
    return [];
  }

  const matches: HtmlSearchMatch[] = [];
  let searchStart = 0;

  while (searchStart < index.normalizedText.length) {
    const start = index.normalizedText.indexOf(normalizedQuery, searchStart);

    if (start < 0) {
      return matches;
    }

    const end = start + normalizedQuery.length;
    matches.push({ index: matches.length, start, end });
    searchStart = end;
  }

  return matches;
}

/**
 * @param contents - Raw HTML document string.
 * @param query - Raw search query string.
 * @param activeMatchIndex - Index of the match to mark as active.
 * @returns HTML with body-text search matches wrapped in mark elements.
 */
export function highlightHtmlDocument(
  contents: string,
  query: string,
  activeMatchIndex: number,
): string {
  const normalizedQuery = normalizeHtmlSearchQuery(query);

  if (normalizedQuery.length === 0) {
    return contents;
  }

  const document = parseHtmlDocument(contents);
  const textNodes = collectSearchableTextNodes(document);
  const textMap = createNormalizedTextMap(textNodes);
  const matches = findHtmlSearchMatches(
    { normalizedText: textMap.normalizedText },
    normalizedQuery,
  );

  if (matches.length === 0) {
    return serializeHtmlDocument(document);
  }

  const rangesByNode = createTextRangesByNode(matches, textMap.positions);

  for (const [nodeIndex, ranges] of [...rangesByNode].sort(
    ([leftIndex], [rightIndex]) => rightIndex - leftIndex,
  )) {
    const textNode = textNodes[nodeIndex];

    if (textNode === undefined) {
      continue;
    }

    applyTextRanges({
      document,
      textNode,
      ranges,
      activeMatchIndex,
    });
  }

  return serializeHtmlDocument(document);
}

/**
 * @param query - Raw search query string.
 * @returns A trimmed, case-insensitive search string with stable whitespace.
 */
export function normalizeHtmlSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/**
 * @param contents - Raw HTML document string.
 * @returns A parsed DOM document.
 */
function parseHtmlDocument(contents: string): Document {
  return new DOMParser().parseFromString(contents, "text/html");
}

/**
 * @param document - Parsed DOM document to walk.
 * @returns Searchable text nodes from the document body in document order.
 */
function collectSearchableTextNodes(document: Document): readonly Text[] {
  const body = document.body;

  if (body === null) {
    return [];
  }

  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();

  while (currentNode !== null) {
    if (currentNode instanceof Text && isSearchableTextNode(currentNode)) {
      textNodes.push(currentNode);
    }

    currentNode = walker.nextNode();
  }

  return textNodes;
}

/**
 * @param textNode - Text node to test.
 * @returns True when the node is not inside an excluded element.
 */
function isSearchableTextNode(textNode: Text): boolean {
  return textNode.parentElement?.closest(excludedSearchNodeSelector) === null;
}

/**
 * @param textNodes - Searchable text nodes in document order.
 * @returns Normalized text and per-character source positions.
 */
function createNormalizedTextMap(
  textNodes: readonly Text[],
): NormalizedTextMap {
  const normalizedCharacters: string[] = [];
  const positions: NormalizedTextPosition[] = [];

  textNodes.forEach((textNode, nodeIndex) => {
    for (let offset = 0; offset < textNode.data.length; offset += 1) {
      const character = textNode.data[offset] ?? "";

      if (/\s/.test(character)) {
        appendNormalizedWhitespace({
          normalizedCharacters,
          positions,
          nodeIndex,
          offset,
        });
        continue;
      }

      for (const normalizedCharacter of character.toLocaleLowerCase()) {
        normalizedCharacters.push(normalizedCharacter);
        positions.push({ nodeIndex, offset });
      }
    }

    appendNormalizedWhitespace({
      normalizedCharacters,
      positions,
      nodeIndex,
      offset: textNode.data.length,
    });
  });

  while (normalizedCharacters[normalizedCharacters.length - 1] === " ") {
    normalizedCharacters.pop();
    positions.pop();
  }

  return {
    normalizedText: normalizedCharacters.join(""),
    positions,
  };
}

/**
 * Appends a single collapsed whitespace character to the normalized buffer.
 * @param params - Normalized buffers plus the source node index and offset.
 */
function appendNormalizedWhitespace({
  normalizedCharacters,
  positions,
  nodeIndex,
  offset,
}: Readonly<{
  normalizedCharacters: string[];
  positions: NormalizedTextPosition[];
  nodeIndex: number;
  offset: number;
}>): void {
  if (normalizedCharacters.length === 0) {
    return;
  }

  if (normalizedCharacters[normalizedCharacters.length - 1] === " ") {
    return;
  }

  normalizedCharacters.push(" ");
  positions.push({ nodeIndex, offset });
}

/**
 * @param matches - Search matches over the normalized text.
 * @param positions - Per-character source positions for the normalized text.
 * @returns Text ranges grouped by source text-node index.
 */
function createTextRangesByNode(
  matches: readonly HtmlSearchMatch[],
  positions: readonly NormalizedTextPosition[],
): Map<number, TextRange[]> {
  const rangesByNode = new Map<number, TextRange[]>();

  for (const match of matches) {
    appendMatchRanges(rangesByNode, match, positions);
  }

  return rangesByNode;
}

/**
 * Adds the ranges covered by a single match to the per-node range map.
 * @param rangesByNode - Accumulated ranges grouped by source text-node index.
 * @param match - Match whose covered characters should be appended.
 * @param positions - Per-character source positions for the normalized text.
 */
function appendMatchRanges(
  rangesByNode: Map<number, TextRange[]>,
  match: HtmlSearchMatch,
  positions: readonly NormalizedTextPosition[],
): void {
  let currentRange: TextRange | null = null;

  for (let index = match.start; index < match.end; index += 1) {
    const position = positions[index];

    if (position === undefined) {
      continue;
    }

    if (
      currentRange !== null &&
      currentRange.matchIndex === match.index &&
      currentRange.end === position.offset &&
      positions[index - 1]?.nodeIndex === position.nodeIndex
    ) {
      currentRange = {
        start: currentRange.start,
        end: position.offset + 1,
        matchIndex: currentRange.matchIndex,
      };
      replaceLastRange(rangesByNode, position.nodeIndex, currentRange);
      continue;
    }

    currentRange = {
      start: position.offset,
      end: position.offset + 1,
      matchIndex: match.index,
    };
    appendRange(rangesByNode, position.nodeIndex, currentRange);
  }
}

/**
 * Appends a range to the list for a source text-node index.
 * @param rangesByNode - Accumulated ranges grouped by source text-node index.
 * @param nodeIndex - Source text-node index to append to.
 * @param range - Range to append.
 */
function appendRange(
  rangesByNode: Map<number, TextRange[]>,
  nodeIndex: number,
  range: TextRange,
): void {
  const ranges = rangesByNode.get(nodeIndex) ?? [];
  ranges.push(range);
  rangesByNode.set(nodeIndex, ranges);
}

/**
 * Replaces the last range in the list for a source text-node index.
 * @param rangesByNode - Accumulated ranges grouped by source text-node index.
 * @param nodeIndex - Source text-node index to update.
 * @param range - Range that replaces the current last range.
 */
function replaceLastRange(
  rangesByNode: Map<number, TextRange[]>,
  nodeIndex: number,
  range: TextRange,
): void {
  const ranges = rangesByNode.get(nodeIndex) ?? [];
  ranges[ranges.length - 1] = range;
  rangesByNode.set(nodeIndex, ranges);
}

/**
 * Wraps each match range within a text node in a mark element.
 * @param params - Document, target text node, ranges, and active match index.
 */
function applyTextRanges({
  document,
  textNode,
  ranges,
  activeMatchIndex,
}: Readonly<{
  document: Document;
  textNode: Text;
  ranges: readonly TextRange[];
  activeMatchIndex: number;
}>): void {
  const orderedRanges = [...ranges].sort(
    (left, right) => right.start - left.start,
  );

  for (const range of orderedRanges) {
    if (range.start >= range.end || range.end > textNode.data.length) {
      continue;
    }

    textNode.splitText(range.end);
    const matchNode = textNode.splitText(range.start);
    const mark = document.createElement("mark");
    mark.setAttribute("data-document-search-match", "true");

    if (range.matchIndex === activeMatchIndex) {
      mark.setAttribute("data-document-search-match-active", "true");
    }

    mark.textContent = matchNode.data;
    matchNode.replaceWith(mark);
  }
}

/**
 * @param document - DOM document to serialize.
 * @returns The serialized HTML including any doctype.
 */
function serializeHtmlDocument(document: Document): string {
  const doctype =
    document.doctype === null ? "" : `<!doctype ${document.doctype.name}>`;
  const documentElement = document.documentElement;

  if (documentElement === null) {
    return doctype;
  }

  return `${doctype}${documentElement.outerHTML}`;
}
