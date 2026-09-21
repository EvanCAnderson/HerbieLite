// The grammar as text for a person to read: each command's shape, the usage
// line, and `--help`. A helper of the cli layer, like warnings.ts (DECISIONS
// T6.5). Every shape is built from COMMAND_SYNTAX and the contact types from
// CONTACT_TYPES, so the help cannot describe a grammar the parser does not
// accept (Q18).
import { COMMAND_SYNTAX, CONTACT_TYPES, type CommandKind } from "./parser.js";

/**
 * How the built program is invoked (Q19). Named by the command a user types,
 * not the `herbie-lite` prefix on stderr, since there is no `bin` entry to
 * make that name runnable (T1.4). The README quotes it verbatim, and a test
 * holds the two together (Q18).
 */
export const USAGE = "node dist/bin.js [--help | file]";

/** A command's expected shape, as the help and the warnings both quote it. */
export function commandSyntax(kind: CommandKind): string {
  return [kind, ...COMMAND_SYNTAX[kind].map((name) => `<${name}>`)].join(" ");
}

const KINDS = Object.keys(COMMAND_SYNTAX) as CommandKind[];

/**
 * What each command declares, in the brief's terms (requirements 1.1–1.4).
 * A Record over every kind, so a new command cannot reach the help without
 * one (T1.12). Employee does not say "previously declared": the brief
 * guarantees that order, but the program accepts either (Q5).
 */
const DESCRIPTIONS: Readonly<Record<CommandKind, string>> = {
  Partner: "A partner: an employee of Drive Capital.",
  Company: "A company other than Drive Capital.",
  Employee: "An employee of a company. Each name belongs to one person.",
  Contact:
    "One interaction between an employee and a partner. Each counts 1\n" +
    "toward that partner's relationship with the employee's company.",
};

/** A command's shape, with its description indented beneath it. */
function commandEntry(kind: CommandKind): string[] {
  return [
    `  ${commandSyntax(kind)}`,
    ...DESCRIPTIONS[kind].split("\n").map((line) => `      ${line}`),
  ];
}

/** The last argument of `Contact`, whose values the help lists. */
const CONTACT_TYPE_ARGUMENT = COMMAND_SYNTAX.Contact[2];

/** What `--help` prints to stdout (Q19). */
export const HELP = [
  "Welcome to herbie-lite!",
  "",
  `Usage: ${USAGE}`,
  "",
  "Reads commands from the file, or from standard input when no file is",
  "given, and prints each company's strongest partner. Commands typed at a",
  "terminal are standard input too: press Ctrl+D to finish.",
  "",
  "From source, put -- before the arguments, or npm keeps them for itself:",
  "  npm start -- [file]",
  "  npm start -- --help",
  "",
  "Commands, one per line:",
  ...KINDS.flatMap(commandEntry),
  "",
  `<${CONTACT_TYPE_ARGUMENT}> is one of: ${CONTACT_TYPES.join(", ")}.`,
  "Names are letters only, A-Z and a-z.",
  "",
].join("\n");
