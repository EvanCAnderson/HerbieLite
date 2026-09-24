// Reads decoded text as numbered lines: a helper of the cli layer, not a
// layer of its own (DECISIONS T6.5). Splits on `\n` alone, so a line number
// always matches the file's `\n` count; a `\r` is left in the text for the
// parser to deal with (Q10, T3.2). It takes decoded chunks rather than a
// stream, so the web console reads its files the same way (Q28).
import type { SourceLine } from "./parser.js";

/**
 * A failure of the input stream itself, named so the cli can report it as an
 * I/O problem (Q15, Q17) while a throw from any other layer still crashes
 * with its stack trace (T6.1, T6.12).
 */
export class ReadError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : "unknown error", { cause });
    this.name = "ReadError";
  }
}

/** Removed once, at the very start of the text (Q16). Written as an
 * escape: the character itself is invisible in a source file. */
const BYTE_ORDER_MARK = "\uFEFF";

/**
 * Yields each line of `chunks` with its 1-based number, as the parser's
 * `SourceLine`. A final line without a trailing newline is yielded; no text
 * at all yields nothing.
 */
export async function* readLines(
  chunks: AsyncIterable<string> | Iterable<string>,
): AsyncIterable<SourceLine> {
  // The pieces of a line not ended yet. Each chunk is searched for `\n`
  // on its own and the pieces joined once the line ends, so a line spread
  // over many chunks costs linear time. Appending to one string instead
  // made every search flatten all the text held so far (T12.10).
  let pending: string[] = [];
  let lineNumber = 0;
  let atStreamStart = true;

  // Only the stream's own failure becomes a ReadError. A throw from the
  // consumer of this generator arrives as a `return` completion, which skips
  // this catch, so a bug downstream is never mislabelled as an I/O problem
  // (T6.12); the tests hold both halves of that.
  try {
    for await (let chunk of chunks) {
      if (atStreamStart && chunk !== "") {
        if (chunk.startsWith(BYTE_ORDER_MARK)) chunk = chunk.slice(1);
        atStreamStart = false;
      }
      let start = 0;
      let newline = chunk.indexOf("\n");
      while (newline !== -1) {
        pending.push(chunk.slice(start, newline));
        lineNumber += 1;
        yield { lineNumber, text: pending.join("") };
        pending = [];
        start = newline + 1;
        newline = chunk.indexOf("\n", start);
      }
      if (start < chunk.length) pending.push(chunk.slice(start));
    }
  } catch (error) {
    throw new ReadError(error);
  }

  if (pending.length > 0) {
    lineNumber += 1;
    yield { lineNumber, text: pending.join("") };
  }
}
