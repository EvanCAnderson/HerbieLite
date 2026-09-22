// The cli layer (DECISIONS T1.11, layer 4): a thin I/O shell that chooses an
// input source, streams it through the parser, prints warnings on stderr and
// the report on stdout, and returns an exit code. `lines` and `warnings` are
// helpers of this layer, not layers of their own (T6.5).
//
// The executable entry is bin.ts; this module only exports main (T1.6).
import { createReadStream } from "node:fs";
import { HELP, OPENING } from "./help.js";
import { ReadError, readLines } from "./lines.js";
import { buildNetwork } from "./network.js";
import { parseLine, type SourcedCommand } from "./parser.js";
import { reportLines } from "./report.js";
import {
  malformedWarning,
  networkWarning,
  readFailure,
  tooManyArguments,
  unknownOption,
  writeFailure,
} from "./warnings.js";

/** A warning ready to print, with the line it is about (T9.13). */
interface Warning {
  readonly lineNumber: number;
  readonly text: string;
}

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

/** `--help` and `-h` are the only options; `-` alone is not STDIN (Q19). */
function isHelp(arg: string): boolean {
  return arg === "--help" || arg === "-h";
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
  // A failing stream emits 'error' as well as reporting to the callback in
  // `flush`; without a listener that event would end the process before the
  // callback could decide what to do with it (Q17). On stderr the listener is
  // the whole policy: a warning that cannot be written is lost silently, and
  // the run still ends on whatever stdout did (T6.15).
  stdout.on("error", () => undefined);
  stderr.on("error", () => undefined);

  // `--help` wins wherever it appears, as it does in most tools; any other
  // argument starting with `-` is an option this program does not have, so a
  // file named that way is reached as `./-name` (Q19).
  if (args.some(isHelp)) return print(stdout, stderr, HELP);
  const option = args.find((arg) => arg.startsWith("-"));
  if (option !== undefined) {
    writeLine(stderr, unknownOption(option));
    return 1;
  }
  if (args.length > 1) {
    writeLine(stderr, tooManyArguments(args.length));
    return 1;
  }

  // Commands come from a file, named or piped in. At a terminal with no file
  // there is nothing to read, so the program explains how to give one and
  // exits 1, since no report was produced (Q20, T6.1). A failure to write the
  // explanation is still reported (Q17), and still exits 1.
  const [file] = args;
  if (file === undefined && isTerminal(stdin)) {
    await print(stdout, stderr, OPENING);
    return 1;
  }
  const input = file === undefined ? stdin : createReadStream(file);

  // Every warning waits until all input is in, so stderr can follow the
  // file's line order (T9.13). A malformed line's warning is formatted as the
  // line is read and held as text, which is bounded (T6.11), rather than as
  // the line itself, which is not.
  const commands: SourcedCommand[] = [];
  const held: Warning[] = [];
  try {
    for await (const source of readLines(input)) {
      const line = parseLine(source);
      if (line.outcome === "command") commands.push(line);
      else if (line.outcome === "malformed") {
        held.push({
          lineNumber: source.lineNumber,
          text: malformedWarning(line),
        });
      }
    }
  } catch (error) {
    // Only the stream's own failure is an I/O problem: a file that could not
    // be read (Q15) and a read that failed partway (Q17) arrive here alike,
    // and neither leaves a report, so both exit 1. Anything else thrown in
    // this loop is a bug in another layer and must crash (T6.1, T6.12).
    if (!(error instanceof ReadError)) throw error;
    // The lines read before the failure were still read, so their warnings
    // print ahead of the failure that ended the run.
    for (const warning of held) writeLine(stderr, warning.text);
    writeLine(stderr, readFailure(file, error.message));
    return 1;
  }

  // One pass in line order: a line yields at most one warning, from the
  // parser or from resolution but never both, so the order is total (T4.3).
  const { network, warnings } = buildNetwork(commands);
  const all = held.concat(
    warnings.map((warning) => ({
      lineNumber: warning.source.lineNumber,
      text: networkWarning(warning),
    })),
  );
  all.sort((a, b) => a.lineNumber - b.lineNumber);
  for (const warning of all) writeLine(stderr, warning.text);

  // No declared companies is no output at all, not a blank line (T6.14):
  // FR4 lists companies, and there are none to list.
  const lines = reportLines(network);
  if (lines.length === 0) return 0;
  return print(stdout, stderr, `${lines.join("\n")}\n`);
}
