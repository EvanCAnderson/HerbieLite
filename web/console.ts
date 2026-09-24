// What the console does apart from the DOM (T10f): the command a listed file
// is run with, and turning what a run printed into the text the terminal pane
// shows (Q27). Running a line, typed or entered by a button, is shell.ts
// (T11c). Tested in vitest; the pane itself is
// console-panel.ts (DECISIONS T10.13).
import { compareNames } from "../src/compare-names.js";
import { readLines } from "../src/lines.js";
import { buildNetwork } from "../src/network.js";
import { parseLine, type SourcedCommand } from "../src/parser.js";
import type { Run } from "../src/run.js";

/** A file the console can run: where it is listed, its name, and its text. */
export interface Runnable {
  readonly source: "example" | "workspace";
  readonly name: string;
  readonly text: string;
  /** Set when the text is the editor's, with changes not yet saved (T10g). */
  readonly unsaved?: boolean;
}

/**
 * The path the CLI would be given for this file: an example where it sits
 * in the repository, a workspace file by name, as it is saved when
 * downloaded (Q25). Its characters need no quoting in a shell (Q25).
 */
export function pathOf(file: Runnable): string {
  return file.source === "example" ? `examples/${file.name}` : file.name;
}

/** A query asked with one of the CLI's options (Q31), from a button. */
export interface Query {
  readonly option: "--partners" | "--employees";
  readonly company: string;
}

/**
 * The command line for a file, and a query if one is asked, as a user
 * would type it; the console runs it as typed (T11c). A company is quoted
 * if it holds anything but letters, so the line still splits as it reads.
 */
export function commandLine(file: Runnable, query?: Query): string {
  if (query === undefined) return `node dist/bin.js ${pathOf(file)}`;
  const company = /^[A-Za-z]+$/.test(query.company)
    ? query.company
    : `'${query.company.replaceAll("'", "")}'`;
  return `node dist/bin.js ${query.option} ${company} ${pathOf(file)}`;
}

/**
 * The companies a file declares, in code-unit order (Q14), read as the
 * program reads them, so the query buttons suggest exactly the names a
 * query can find (Q33).
 */
export async function companiesIn(text: string): Promise<string[]> {
  const commands: SourcedCommand[] = [];
  for await (const source of readLines([text])) {
    const line = parseLine(source);
    if (line.outcome === "command") commands.push(line);
  }
  return [...buildNetwork(commands).network.companies].sort(compareNames);
}

/** SGR sequences for the pane. Only this module's own text carries them. */
const STYLE = {
  note: "\u001b[2m",
  stderr: "\u001b[33m",
  exit: "\u001b[2m",
  reset: "\u001b[0m",
} as const;

function styled(style: keyof typeof STYLE, text: string): string {
  return `${STYLE[style]}${text}${STYLE.reset}`;
}

/** The note shown before a run of the editor's unsaved text (T10g). */
export const UNSAVED_NOTE = styled(
  "note",
  "(the editor's text, with unsaved changes)",
);

/** A line in the colour the pane gives stderr. */
export function stderrLine(text: string): string {
  return `${styled("stderr", text)}\n`;
}

/**
 * What one run printed, as the pane shows it after the command: stderr,
 * stdout and the notes in the order the CLI writes them, stderr in its own
 * colour, then the exit code (Q27). Every line ends `\n`; the pane turns
 * that into a line break. What the program prints needs no escaping here:
 * text it quotes from a file or an argument is escaped already (T6.11, T8.4),
 * and names are letters only (Q9). Text the console echoes itself, which the
 * program never saw, is escaped by shell.ts's `visible` (Q38, T12.12).
 */
export function output(result: Run): string {
  return (
    result.stderr.map(stderrLine).join("") +
    result.stdout +
    result.notes.map(stderrLine).join("") +
    `${styled("exit", `exit ${String(result.code)}`)}\n\n`
  );
}
