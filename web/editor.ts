// What the editor checks as a file is edited (Q29), apart from the DOM, so it
// is tested in vitest (DECISIONS T10.13). The file is read, parsed and
// resolved by the same code the CLI runs, so a line is marked here exactly
// when the CLI would warn about it.
import { assertNever } from "../src/assert-never.js";
import { readLines } from "../src/lines.js";
import { buildNetwork, type NetworkWarning } from "../src/network.js";
import { parseLine, type SourcedCommand } from "../src/parser.js";
import { malformedProblem, networkProblem } from "../src/warnings.js";

/**
 * How a marked line fares. `discarded`: the program throws the line away as
 * it stands. `pending`: the line names a company or person no line declares
 * yet, which may simply not have been written (Q8), so it is not yet a
 * mistake.
 */
export type Severity = "discarded" | "pending";

/** One marked line: where it is, how it fares, and what is wrong. */
export interface Mark {
  readonly lineNumber: number;
  readonly severity: Severity;
  readonly message: string;
}

/**
 * Whether a resolution warning is only a name not declared yet. A repeated
 * declaration, or a name used for the wrong kind of person (Q12), stays a
 * problem however much more of the file is written.
 */
function severityOf(warning: NetworkWarning): Severity {
  switch (warning.problem) {
    case "unknown-company":
      return "pending";
    case "unresolved-contact":
      return warning.failures.every((failure) => failure.cause === "undeclared")
        ? "pending"
        : "discarded";
    case "duplicate-declaration":
      return "discarded";
    default:
      return assertNever(warning);
  }
}

/**
 * Every line of `text` the CLI would warn about, in line order, with the
 * warning's own wording less its line number and quote (T6.5). A line has
 * at most one mark, as it has at most one warning (T4.3).
 */
export async function checkText(text: string): Promise<Mark[]> {
  const commands: SourcedCommand[] = [];
  const marks: Mark[] = [];
  for await (const source of readLines([text])) {
    const line = parseLine(source);
    if (line.outcome === "command") commands.push(line);
    else if (line.outcome === "malformed") {
      marks.push({
        lineNumber: source.lineNumber,
        severity: "discarded",
        message: malformedProblem(line),
      });
    }
  }
  for (const warning of buildNetwork(commands).warnings) {
    marks.push({
      lineNumber: warning.source.lineNumber,
      severity: severityOf(warning),
      message: networkProblem(warning),
    });
  }
  return marks.sort((a, b) => a.lineNumber - b.lineNumber);
}

/** A count for the editor's summary: `2 discarded, 1 pending`, or none. */
export function summary(marks: readonly Mark[]): string {
  const count = (severity: Severity): number =>
    marks.filter((mark) => mark.severity === severity).length;
  const parts = [
    [count("discarded"), "discarded"],
    [count("pending"), "pending"],
  ] as const;
  const shown = parts.filter(([n]) => n > 0).map(([n, what]) => `${n} ${what}`);
  return shown.length === 0 ? "No problems." : `${shown.join(", ")}.`;
}
