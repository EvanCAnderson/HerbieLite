// The cli layer (DECISIONS T1.11, layer 4): a thin I/O shell that chooses an
// input source, hands it to run.ts, and writes what the run printed to the
// process's streams, returning an exit code. `lines`, `run` and `warnings`
// are helpers of this layer, not layers of their own (T6.5).
//
// The executable entry is bin.ts; this module only exports main (T1.6).
import { createReadStream } from "node:fs";
import { run } from "./run.js";
import { writeFailure } from "./warnings.js";

function writeLine(stream: NodeJS.WritableStream, text: string): void {
  stream.write(`${text}\n`);
}

/** Resolves once the write is flushed, or rejects with its failure (Q17). */
function flush(stream: NodeJS.WritableStream, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.write(text, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

/** A reader that closed the pipe early, as `| head -1` does (Q17). */
function isBrokenPipe(error: unknown): boolean {
  return (
    error instanceof Error && (error as NodeJS.ErrnoException).code === "EPIPE"
  );
}

/**
 * Writes the program's output to stdout and returns the exit code: 0 once it
 * is written, or when the reader closed the pipe early, which is the reader
 * asking for less (Q17); 1, with the cause on stderr, for any other failure.
 */
async function print(
  stdout: NodeJS.WritableStream,
  stderr: NodeJS.WritableStream,
  text: string,
): Promise<number> {
  try {
    await flush(stdout, text);
    return 0;
  } catch (error) {
    if (isBrokenPipe(error)) return 0;
    writeLine(stderr, writeFailure(messageOf(error)));
    return 1;
  }
}

/**
 * Whether STDIN is a terminal, where commands would be typed (Q20). Only a
 * TTY stream carries `isTTY`, so a pipe or a test's stream is never taken
 * for one.
 */
function isTerminal(stream: NodeJS.ReadableStream): boolean {
  return (stream as { isTTY?: boolean }).isTTY === true;
}

/**
 * Runs the program and returns its exit code: 0 whenever a report was
 * produced, 1 when none was (T6.1). The work is in run.ts (Q28); this adds
 * the input source and the writing, where only the final write is caught,
 * and only to report I/O failure (Q17).
 */
export async function main(
  args: readonly string[],
  stdin: NodeJS.ReadableStream,
  stdout: NodeJS.WritableStream,
  stderr: NodeJS.WritableStream,
): Promise<number> {
  // A failing stream emits 'error' as well as reporting to the callback in
  // `flush`; without a listener that event would end the process before the
  // callback could decide what to do with it (Q17). On stderr the listener is
  // the whole policy: a warning that cannot be written is lost silently, and
  // the run still ends on whatever stdout did (T6.15).
  stdout.on("error", () => undefined);
  stderr.on("error", () => undefined);

  // Commands come from a file, named or piped in; at a terminal with no file
  // there is nothing to read (Q20). Decoding here rather than in the reader
  // keeps lines.ts free of Node's streams, and still reassembles a character
  // split across two chunks (T6.4).
  const result = await run(args, (file) => {
    if (file === undefined && isTerminal(stdin)) return undefined;
    const input = file === undefined ? stdin : createReadStream(file);
    input.setEncoding("utf8");
    return input as AsyncIterable<string>;
  });

  for (const line of result.stderr) writeLine(stderr, line);
  if (result.stdout === "") return result.code;
  const written = await print(stdout, stderr, result.stdout);
  if (written !== 0) return written;
  // Notes footnote stdout, so a stdout that failed to write has nothing for
  // them to explain (Q21).
  for (const note of result.notes) writeLine(stderr, note);
  return result.code;
}
