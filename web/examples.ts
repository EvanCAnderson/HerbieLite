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

/**
 * What each example is for, in one line, shown beside it in the page
 * (DECISIONS T11.2). The README describes each at more length; a test holds
 * that every bundled example has a line here and nothing else does.
 */
export const PURPOSES: ReadonlyMap<string, string> = new Map([
  [
    "input.txt",
    "The brief's own example, verbatim. Runs to the three lines the brief expects.",
  ],
  [
    "late-declarations.txt",
    "Every name is used before it is declared, and all of them resolve: line order does not matter.",
  ],
  [
    "names-and-repeats.txt",
    "A keyword used as a name, a person and a company sharing one, a contact counted twice, and a company with no employees.",
  ],
  [
    "queries.txt",
    "Written for the --partners and --employees queries: ask one with the buttons, or type it in the console.",
  ],
  [
    "ties.txt",
    "Equal strengths go to the alphabetically first partner, with a note on stderr; Zebra sorts before acme.",
  ],
  [
    "warnings.txt",
    "Every warning the program can print, with the report still printed underneath.",
  ],
]);
