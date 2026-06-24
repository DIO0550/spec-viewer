export type SpecFileKey =
  | "exploration"
  | "hearing"
  | "impl"
  | "tasks"
  | "tech-reference"
  | "test-cases"
  | "requirements"
  | "design";

export type SpecFileStatus = "present" | "missing";
export type SpecDocumentFormat = "markdown" | "html";
export type ConfigSource = "default" | "workspaceConfig" | "specOverride";

export type SpecFile = Readonly<{
  key: SpecFileKey;
  label: string;
  fileName: string;
  status: SpecFileStatus;
  format?: SpecDocumentFormat;
  configSource?: ConfigSource;
}>;

export const SpecFile = {
  /**
   * @param files - Candidate spec files
   * @param key - File key to find
   * @returns Matching spec file, or null when absent.
   */
  findByKey: (
    files: readonly SpecFile[],
    key: SpecFileKey | null,
  ): SpecFile | null => {
    if (key === null) {
      return null;
    }

    return files.find((file) => file.key === key) ?? null;
  },

  /**
   * @param files - Candidate spec files
   * @returns First spec file, or null when empty.
   */
  first: (files: readonly SpecFile[]): SpecFile | null => files[0] ?? null,

  /**
   * @param files - Candidate spec files
   * @returns First spec file key, or null when empty.
   */
  firstKey: (files: readonly SpecFile[]): SpecFileKey | null =>
    SpecFile.first(files)?.key ?? null,

  /**
   * @param files - Candidate spec files
   * @param key - File key to check
   * @returns True when the key exists in the file list.
   */
  hasKey: (files: readonly SpecFile[], key: SpecFileKey | null): boolean =>
    SpecFile.findByKey(files, key) !== null,

  /**
   * @param file - Spec file to inspect
   * @returns True when the file exists on disk.
   */
  isPresent: (file: SpecFile): boolean => file.status === "present",

  /**
   * @param file - Spec file to inspect
   * @returns True when the file is missing on disk.
   */
  isMissing: (file: SpecFile): boolean => file.status === "missing",

  /**
   * @param file - Spec file to inspect
   * @returns Configured document format, defaulting to markdown.
   */
  formatOf: (file: SpecFile): SpecDocumentFormat => file.format ?? "markdown",
} as const;
