// What the console does apart from the DOM (T10f): run herbie-lite on a
// listed file, through the same run() the CLI calls (Q28), and turn what it
// printed into the text the terminal pane shows (Q27). Tested in vitest; the
// pane itself is console-panel.ts (DECISIONS T10.13).
import { run, type Run } from "../src/run.js";

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

/** The command line the console shows, as a user would type it. */
export function commandLine(file: Runnable): string {
  return `node dist/bin.js ${pathOf(file)}`;
}

/** Runs herbie-lite on the file, as `commandLine` shows it. */
export function runFile(file: Runnable): Promise<Run> {
  // The whole text as one chunk: the reader splits it as it does a file.
  return run([pathOf(file)], () => [file.text]);
}

/** SGR sequences for the pane. Only this module's own text carries them. */
const STYLE = {
  prompt: "\u001b[1m",
  note: "\u001b[2m",
  stderr: "\u001b[33m",
  exit: "\u001b[2m",
  reset: "\u001b[0m",
} as const;

function styled(style: keyof typeof STYLE, text: string): string {
  return `${STYLE[style]}${text}${STYLE.reset}`;
}

/**
 * One run as the pane shows it: the command, a note when the text run is
 * not what the file holds, then stderr, stdout and the
 * notes in the order the CLI writes them, stderr in its own colour, then the
 * exit code (Q27). Every line ends `\n`; the pane turns that into a line
 * break. What the program prints needs no escaping here: quoted input is
 * already escaped (T6.11), and names are letters only (Q9).
 */
export function transcript(
  command: string,
  result: Run,
  unsaved = false,
): string {
  const stderr = (lines: readonly string[]): string =>
    lines.map((line) => `${styled("stderr", line)}\n`).join("");
  return (
    `${styled("prompt", `$ ${command}`)}\n` +
    (unsaved
      ? `${styled("note", "(the editor's text, with unsaved changes)")}\n`
      : "") +
    stderr(result.stderr) +
    result.stdout +
    stderr(result.notes) +
    `${styled("exit", `exit ${String(result.code)}`)}\n\n`
  );
}
