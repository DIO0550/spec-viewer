/**
 * @param value - Text to measure
 * @returns The UTF-8 byte length matching persisted Markdown file size semantics.
 */
export function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
