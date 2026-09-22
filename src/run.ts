// The cli layer's work, apart from streams (Q28): read the arguments, read
// the input's lines, and decide what goes to stdout and stderr and the exit
// code. cli.ts supplies the input and writes the result to the process; the
// web console supplies a listed file and writes the result to its pane, so
// both print the same text. A helper of the cli layer, like lines.ts
// (DECISIONS T6.5), and free of Node's types so the page can import it.
import { HELP, OPENING } from "./help.js";
import { ReadError, readLines } from "./lines.js";
import { buildNetwork } from "./network.js";
import { parseLine, type SourcedCommand } from "./parser.js";
import { buildReport, employeesOf, partnersOf } from "./report.js";
import {
  malformedWarning,
  missingCompany,
  networkWarning,
  readFailure,
  tieNote,
  tooManyArguments,
  tooManyQueries,
  unknownCompany,
  unknownOption,
} from "./warnings.js";

/**
 * What a run printed, in the order it is written. `stderr` comes first: bad
 * invocations, warnings in line order (T9.13), and a failure. Then `stdout`,
 * "" when there is nothing to print (T6.14). Then `notes`, which are stderr
 * lines that footnote stdout, written only once stdout is (Q21).
 */
export interface Run {
  readonly stderr: readonly string[];
  readonly stdout: string;
  readonly notes: readonly string[];
  /** 0 when an answer was produced, 1 when none was (T6.1). */
  readonly code: 0 | 1;
}

/**
 * The input's text, as decoded chunks, for `file` (undefined for standard
 * input); or undefined when there is nothing to read, because standard input
 * is a terminal (Q20). A failure while reading is a ReadError (T6.12).
 */
export type Open = (
  file: string | undefined,
) => AsyncIterable<string> | Iterable<string> | undefined;

/** `--help` and `-h`, which win wherever they appear (Q19). */
function isHelp(arg: string): boolean {
  return arg === "--help" || arg === "-h";
}

/** A query about one company, asked instead of the report (Q31). */
interface Query {
  readonly kind: "partners" | "employees";
  readonly company: string;
}

/** Each query option, and the report function that answers it (Q31, Q32). */
const QUERIES = {
  partners: partnersOf,
  employees: employeesOf,
} as const;

const QUERY_OPTIONS: ReadonlyMap<string, Query["kind"]> = new Map([
  ["--partners", "partners"],
  ["--employees", "employees"],
]);

/** What the arguments ask for, or the one line saying why they cannot run. */
type Invocation =
  | { readonly outcome: "help" }
  | { readonly outcome: "invalid"; readonly problem: string }
  | {
      readonly outcome: "run";
      readonly file: string | undefined;
      readonly query: Query | undefined;
    };

/**
 * Reads the arguments (Q15, Q19, Q31). `--help` wins wherever it appears. A
 * query option takes the next argument as its company, unless that argument
 * is missing or is itself an option. Any other argument starting with `-` is
 * an option this program does not have, so a file named that way is reached
 * as `./-name`. At most one query and one file; the first problem found, in
 * argument order, is the one reported.
 */
function parseArgs(args: readonly string[]): Invocation {
  if (args.some(isHelp)) return { outcome: "help" };
  const files: string[] = [];
  const queries: Query[] = [];
  const rest = [...args];
  for (let arg = rest.shift(); arg !== undefined; arg = rest.shift()) {
    const kind = QUERY_OPTIONS.get(arg);
    if (kind !== undefined) {
      const company = rest[0];
      if (company === undefined || company.startsWith("-")) {
        return { outcome: "invalid", problem: missingCompany(arg) };
      }
      rest.shift();
      queries.push({ kind, company });
    } else if (arg.startsWith("-")) {
      return { outcome: "invalid", problem: unknownOption(arg) };
    } else {
      files.push(arg);
    }
  }
  if (queries.length > 1)
    return { outcome: "invalid", problem: tooManyQueries() };
  if (files.length > 1) {
    return { outcome: "invalid", problem: tooManyArguments(files.length) };
  }
  return { outcome: "run", file: files[0], query: queries[0] };
}

/** A warning ready to print, with the line it is about (T9.13). */
interface Warning {
  readonly lineNumber: number;
  readonly text: string;
}

const nothing = { stdout: "", notes: [] } as const;

/**
 * Runs the program on `args`, reading its input through `open`. Bad input
 * data never costs the answer: it warns and the run still ends 0 (Q7, Q8).
 * A broken invariant is a bug, not data, so it is left to propagate (T5.2,
 * T6.1); only the read is caught, and only a ReadError (T6.12).
 */
export async function run(args: readonly string[], open: Open): Promise<Run> {
  const invocation = parseArgs(args);
  if (invocation.outcome === "help") {
    return { stderr: [], stdout: HELP, notes: [], code: 0 };
  }
  if (invocation.outcome === "invalid") {
    return { stderr: [invocation.problem], ...nothing, code: 1 };
  }
  const { file, query } = invocation;

  // At a terminal with no file there is nothing to read, so the program
  // explains how to give one and exits 1, since no report was produced
  // (Q20, T6.1).
  const input = open(file);
  if (input === undefined) {
    return { stderr: [], stdout: OPENING, notes: [], code: 1 };
  }

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
    const stderr = held.map((warning) => warning.text);
    stderr.push(readFailure(file, error.message));
    return { stderr, ...nothing, code: 1 };
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
  const stderr = all.map((warning) => warning.text);

  // A query answers instead of the report, and names a company that may be
  // declared anywhere in the file, so it is checked only now (Q31, Q33). A
  // company never declared leaves no answer, so the run exits 1 (T6.1).
  if (query !== undefined) {
    const answer = QUERIES[query.kind](network, query.company);
    if (answer === undefined) {
      stderr.push(unknownCompany(query.company));
      return { stderr, ...nothing, code: 1 };
    }
    return { stderr, stdout: joined(answer), notes: [], code: 0 };
  }

  // Ties are footnotes to report lines, so they follow the report (Q21).
  const { lines, ties } = buildReport(network);
  return {
    stderr,
    stdout: joined(lines),
    notes: ties.map(tieNote),
    code: 0,
  };
}

/** Lines ended by one newline each; none is no output at all (T6.14). */
function joined(lines: readonly string[]): string {
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}
