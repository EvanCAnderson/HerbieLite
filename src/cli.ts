// The cli layer (DECISIONS T1.11, layer 4): a thin I/O shell that chooses an
// input source, streams it through the parser, prints warnings on stderr and
// the report on stdout, and returns an exit code. `lines` and `warnings` are
// helpers of this layer, not layers of their own (T6.5).
//
// The executable entry is bin.ts; this module only exports main (T1.6).
import { createReadStream } from "node:fs";
import { ReadError, readLines } from "./lines.js";
import { buildNetwork } from "./network.js";
import { parseLine, type SourcedCommand } from "./parser.js";
import { reportLines } from "./report.js";
import { errorMessage, malformedWarning, networkWarning } from "./warnings.js";

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
 * Runs the program and returns its exit code: 0 whenever a report was
 * produced, 1 when none was (T6.1). Bad input data never costs the report —
 * it warns on stderr and the run still ends 0 (Q7, Q8). A broken invariant
 * is a bug, not data, so it is left to propagate (T5.2, T6.1); only the read
 * and the final write are caught, and only to report I/O failure (Q15, Q17).
 */
export async function main(
  args: readonly string[],
  stdin: NodeJS.ReadableStream,
  stdout: NodeJS.WritableStream,
  stderr: NodeJS.WritableStream,
): Promise<number> {
  if (args.length > 1) {
    writeLine(
      stderr,
      errorMessage(`expected at most one file argument, got ${args.length}`),
    );
    return 1;
  }

  // A failing stream emits 'error' as well as reporting to the callback in
  // `flush`; without a listener that event would end the process before the
  // callback could decide what to do with it (Q17). On stderr the listener is
  // the whole policy: a warning that cannot be written is lost silently, and
  // the run still ends on whatever stdout did (T6.15).
  stdout.on("error", () => undefined);
  stderr.on("error", () => undefined);

  // Typing commands at a terminal is just STDIN with no file argument, so it
  // needs no branch of its own; the program prints nothing extra for it
  // (T6.13, [UPGRADES U6]).
  const [file] = args;
  const input = file === undefined ? stdin : createReadStream(file);

  // Warnings for malformed lines are printed as each line is read, so typed
  // input is answered immediately (Q7, T1.10); everything else waits until
  // all input is in (Q5, Q8).
  const commands: SourcedCommand[] = [];
  try {
    for await (const source of readLines(input)) {
      const line = parseLine(source);
      if (line.outcome === "command") commands.push(line);
      else if (line.outcome === "malformed") {
        writeLine(stderr, malformedWarning(line));
      }
    }
  } catch (error) {
    // Only the stream's own failure is an I/O problem: a file that could not
    // be read (Q15) and a read that failed partway (Q17) arrive here alike,
    // and neither leaves a report, so both exit 1. Anything else thrown in
    // this loop is a bug in another layer and must crash (T6.1, T6.12).
    if (!(error instanceof ReadError)) throw error;
    writeLine(
      stderr,
      errorMessage(`cannot read ${file ?? "standard input"}: ${error.message}`),
    );
    return 1;
  }

  const { network, warnings } = buildNetwork(commands);
  for (const warning of warnings) writeLine(stderr, networkWarning(warning));

  // No declared companies is no output at all, not a blank line (T6.14):
  // FR4 lists companies, and there are none to list.
  const lines = reportLines(network);
  if (lines.length === 0) return 0;
  try {
    await flush(stdout, `${lines.join("\n")}\n`);
  } catch (error) {
    // A closed stdout means the reader asked for less output, so the run
    // ends quietly; any other write failure is reported (Q17).
    if (isBrokenPipe(error)) return 0;
    writeLine(stderr, errorMessage(`cannot write output: ${messageOf(error)}`));
    return 1;
  }
  return 0;
}
