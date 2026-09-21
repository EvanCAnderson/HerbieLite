// Reads a byte stream as numbered lines: a helper of the cli layer, not a
// layer of its own (DECISIONS T6.5). Splits on `\n` alone, so a line number
// always matches the file's `\n` count; a `\r` is left in the text for the
// parser to deal with (Q10, T3.2).
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

/** Removed once, at the very start of the stream (Q16). Written as an
 * escape: the character itself is invisible in a source file. */
const BYTE_ORDER_MARK = "\uFEFF";

/**
 * Yields each line of `stream` with its 1-based number, as the parser's
 * `SourceLine`. A final line without a trailing newline is yielded; an empty
 * stream yields nothing.
 */
export async function* readLines(
  stream: NodeJS.ReadableStream,
): AsyncIterable<SourceLine> {
  // Chunks arrive as decoded strings, and a multi-byte character split
  // across two chunks is reassembled rather than corrupted.
  stream.setEncoding("utf8");
  let buffer = "";
  let lineNumber = 0;
  let atStreamStart = true;

  // Only the stream's own failure becomes a ReadError. A throw from the
  // consumer of this generator arrives as a `return` completion, which skips
  // this catch, so a bug downstream is never mislabelled as an I/O problem
  // (T6.12); the tests hold both halves of that.
  try {
    for await (const chunk of stream as AsyncIterable<string>) {
      buffer += chunk;
      if (atStreamStart && buffer !== "") {
        if (buffer.startsWith(BYTE_ORDER_MARK)) buffer = buffer.slice(1);
        atStreamStart = false;
      }
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        lineNumber += 1;
        yield { lineNumber, text: buffer.slice(0, newline) };
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    }
  } catch (error) {
    throw new ReadError(error);
  }

  if (buffer !== "") {
    lineNumber += 1;
    yield { lineNumber, text: buffer };
  }
}
