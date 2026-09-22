import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// The docs are the record (DECISIONS T12.3): an invisible character in one
// cannot be seen on review, and a raw ESC in one runs when the file is
// printed. The ranges are written as numbers, not escapes, so this file
// cannot suffer the decoding it guards against (Q37).

const ROOT = join(import.meta.dirname, "..");

/** Build output, installs and reports, which are not the project's docs. */
const SKIPPED = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  "test-results",
  "playwright-report",
]);

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIPPED.has(entry.name)) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.name.endsWith(".md") ? [path] : [];
  });
}

/**
 * A character no doc should hold: a control character other than a newline
 * or a tab, a no-break space, a byte-order mark, or a zero-width or
 * direction mark. Each is either invisible on screen or acted on by a
 * terminal.
 */
function isInvisible(code: number): boolean {
  return (
    (code < 0x20 && code !== 0x0a && code !== 0x09) || // C0, and CR
    (code >= 0x7f && code <= 0x9f) || // DEL and C1
    code === 0xa0 || // no-break space
    code === 0xfeff || // byte-order mark
    (code >= 0x200b && code <= 0x200f) || // zero-width and direction marks
    (code >= 0x202a && code <= 0x202e) || // direction embeddings
    (code >= 0x2066 && code <= 0x2069) // direction isolates
  );
}

/** Each invisible character in `text`, as `line 12: U+00A0`. */
function invisibleIn(text: string): string[] {
  return text.split("\n").flatMap((line, index) =>
    [...line]
      .map((character) => character.codePointAt(0) ?? 0)
      .filter(isInvisible)
      .map(
        (code) =>
          `line ${index + 1}: U+${code.toString(16).toUpperCase().padStart(4, "0")}`,
      ),
  );
}

describe("the docs hold no invisible characters (Q37)", () => {
  const files = markdownFiles(ROOT);

  it("finds the docs, so the check cannot pass on nothing", () => {
    const names = files.map((path) => relative(ROOT, path));
    for (const doc of ["README.md", "CLAUDE.md", "docs/DECISIONS.md"]) {
      expect(names).toContain(doc);
    }
  });

  it("catches each kind of character it looks for", () => {
    const samples = [0x1b, 0x0d, 0x9b, 0xa0, 0xfeff, 0x200b, 0x202e, 0x2066];
    for (const code of samples) {
      expect(
        invisibleIn(`a${String.fromCodePoint(code)}b`),
        `U+${code.toString(16)}`,
      ).toHaveLength(1);
    }
    expect(invisibleIn("Zoë\tok\n")).toEqual([]);
  });

  it.each(files.map((path) => [relative(ROOT, path), path]))(
    "%s",
    (_name, path) => {
      expect(invisibleIn(readFileSync(path, "utf8"))).toEqual([]);
    },
  );
});
