// Every line of text the program writes to stderr: a helper of the cli
// layer, not a layer of its own (DECISIONS T6.5). The parser and network
// layers return data (T2.5), so the wording lives here, in one place,
// testable without streams.
import { assertNever } from "./assert-never.js";
import { commandSyntax, USAGE } from "./help.js";
import {
  COMMAND_SYNTAX,
  CONTACT_TYPES,
  type MalformedLine,
  type SourceLine,
} from "./parser.js";
import type { ContactFailure, Declaration, NetworkWarning } from "./network.js";
import type { Tie } from "./report.js";

/** Prefixes every line, so stderr stays attributable once it is merged. */
const PROGRAM = "herbie-lite";

/** An invocation or I/O failure (Q15, Q17). Not tied to an input line. */
function errorMessage(problem: string): string {
  return `${PROGRAM}: ${problem}`;
}

/**
 * Characters escaped when input is quoted back (T6.11): every control,
 * format and separator character, so a `\r`, a terminal escape sequence or a
 * non-breaking space can neither damage the message nor pass as ordinary
 * text; plus `\` itself, so an escape is never confusable with text the file
 * really held. A plain space is the one separator left as typed.
 */
const ESCAPED = /[\\\p{C}\p{Z}]/u;

/** Longest quoted line, in characters of escaped output (T6.11). */
const QUOTE_LIMIT = 200;

const SHORT_ESCAPES: Readonly<Record<string, string>> = {
  "\\": "\\\\",
  "\t": "\\t",
  "\r": "\\r",
};

function escape(character: string): string {
  if (character === " " || !ESCAPED.test(character)) return character;
  const short = SHORT_ESCAPES[character];
  if (short !== undefined) return short;
  const code = character.codePointAt(0) ?? 0;
  const hex = code.toString(16).padStart(4, "0");
  return code > 0xffff ? `\\u{${hex}}` : `\\u${hex}`;
}

/**
 * Text made safe to print but not bounded (T8.4): for a file path or an I/O
 * error, where cutting the message short would lose the cause.
 */
function escaped(text: string): string {
  let out = "";
  for (const character of text) out += escape(character);
  return out;
}

/**
 * Input that could not be read (Q15, Q17). A path is quoted and escaped like
 * any other text the user supplied (T8.4), and so is the cause, since Node's
 * message repeats the path.
 */
export function readFailure(file: string | undefined, cause: string): string {
  const what = file === undefined ? "standard input" : `"${escaped(file)}"`;
  return errorMessage(`cannot read ${what}: ${escaped(cause)}`);
}

/**
 * An invocation the program cannot run (Q15, Q19), with the usage on the same
 * line so each problem is still one prefixed line (T6.7).
 */
function badInvocation(problem: string): string {
  return errorMessage(`${problem}; usage: ${USAGE}`);
}

/** More than one file argument (Q15). */
export function tooManyArguments(count: number): string {
  return badInvocation(`expected at most one file argument, got ${count}`);
}

/**
 * An argument that looks like an option but is not `--help` or `-h` (Q19).
 * It is escaped like any other text the user supplied (T8.4).
 */
export function unknownOption(option: string): string {
  return badInvocation(`unknown option "${escaped(option)}"`);
}

/** Output that could not be written (Q17); the cause is escaped (T8.4). */
export function writeFailure(cause: string): string {
  return errorMessage(`cannot write output: ${escaped(cause)}`);
}

/**
 * One line of input, made safe to print and bounded in length (T6.11). The
 * loop stops at the limit rather than escaping the whole line first, so a
 * multi-megabyte line costs nothing to quote and no escape is ever cut in
 * half.
 */
function quoted(text: string): string {
  let out = "";
  for (const character of text) {
    if (out.length >= QUOTE_LIMIT) {
      return `${out}... (${text.length} characters)`;
    }
    out += escape(character);
  }
  return out;
}

/**
 * The shape shared by every discarded line (Q7, Q8, Q13): where it was, what
 * was wrong, and the line itself. The line is escaped and bounded (T6.11) and
 * still comes last, so neither its contents nor its length can cost the
 * reader the part of the message that names the problem (T6.7).
 */
function discarded(source: SourceLine, problem: string): string {
  return `${PROGRAM}: line ${source.lineNumber}: ${problem}; discarded: ${quoted(source.text)}`;
}

/** A line the parser rejected (Q7); the reason names the first check to fail (T3.4). */
export function malformedWarning(line: MalformedLine): string {
  switch (line.reason) {
    case "unknown-command":
      return discarded(
        line.source,
        `unknown command; expected one of ${Object.keys(COMMAND_SYNTAX).join(", ")}`,
      );
    case "wrong-word-count":
      return discarded(
        line.source,
        `wrong number of words; expected "${commandSyntax(line.kind)}"`,
      );
    case "invalid-word":
      return discarded(
        line.source,
        `names must be letters only; expected "${commandSyntax(line.kind)}"`,
      );
    case "invalid-contact-type":
      return discarded(
        line.source,
        `contact type must be one of ${CONTACT_TYPES.join(", ")}; expected "${commandSyntax(line.kind)}"`,
      );
    default:
      return assertNever(line);
  }
}

/**
 * Whether two declarations say the same thing. An exact repeat is noise; a
 * name claimed by a different declaration is a data error, and the two read
 * differently (T6.8).
 */
function sameDeclaration(a: Declaration, b: Declaration): boolean {
  if (a.kind !== b.kind || a.name !== b.name) return false;
  if (a.kind === "Employee" && b.kind === "Employee") {
    return a.company === b.company;
  }
  return true;
}

/** Why one name in a Contact line didn't resolve (Q8, Q12). */
function failureText({ role, name, cause }: ContactFailure): string {
  switch (cause) {
    case "undeclared":
      return `no ${role} named ${name} was declared`;
    case "wrong-role": {
      const declared = role === "employee" ? "a partner" : "an employee";
      const wanted = role === "employee" ? "an employee" : "a partner";
      return `${name} is declared as ${declared}, not ${wanted}`;
    }
    default:
      return assertNever(cause);
  }
}

/** A line the network layer discarded once all input was read (Q5, Q8, Q13). */
export function networkWarning(warning: NetworkWarning): string {
  switch (warning.problem) {
    case "unknown-company":
      return discarded(
        warning.source,
        `no company named ${warning.company} was declared`,
      );
    case "duplicate-declaration": {
      const { lineNumber, text } = warning.standing.source;
      return discarded(
        warning.source,
        sameDeclaration(warning.command, warning.standing.command)
          ? `repeats the declaration on line ${lineNumber}`
          : `${warning.command.name} is already declared on line ${lineNumber} as "${quoted(text)}"`,
      );
    }
    case "unresolved-contact":
      return discarded(
        warning.source,
        warning.failures.map(failureText).join(", and "),
      );
    default:
      return assertNever(warning);
  }
}

/** `Al and Bo`, or `Al, Bo and Cy`. */
function listOf([first, ...rest]: readonly [string, ...string[]]): string {
  const last = rest.pop();
  return last === undefined
    ? first
    : `${[first, ...rest].join(", ")} and ${last}`;
}

/**
 * A company whose line names one of several equally strong partners (Q21).
 * It follows the report, as a footnote to the line it explains, and is not a
 * discarded line, so it has no line number. Names are letters only (Q9), so
 * nothing here needs escaping.
 */
export function tieNote({ company, partners, strength }: Tie): string {
  const contacts = strength === 1 ? "contact" : "contacts";
  return `${PROGRAM}: ${company} is a tie between ${listOf(partners)} (${strength} ${contacts} each); ${partners[0]} is shown because it comes first alphabetically`;
}
