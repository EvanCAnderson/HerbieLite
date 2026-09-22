// The shipped examples, bundled into the page when Vite builds it, so the
// page can list and run them with no server (DECISIONS T10.16). They are
// read-only here as on disk: the tests assert every one (T7.5, T9.6).

/** Each example file's text, keyed by its path relative to this module. */
const files = import.meta.glob<string>("../examples/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** The examples by file name, in code-unit order as the report sorts (Q14). */
export const EXAMPLES: ReadonlyMap<string, string> = new Map(
  Object.entries(files)
    .map(
      ([path, text]) => [path.slice(path.lastIndexOf("/") + 1), text] as const,
    )
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
);
