// The console as a shell that runs herbie-lite and nothing else (T11c,
// DECISIONS T11.5): what a typed line asks for, how the keys typed build a
// line, and running an accepted line through the CLI's own run() (Q28).
// Apart from the DOM, so it is tested in vitest (T10.13); the pane is
// console-panel.ts.
import { USAGE } from "../src/help.js";
import { COMMAND_SYNTAX } from "../src/parser.js";
import { run, type Run } from "../src/run.js";

/** What a typed line asks the console to do. */
export type CommandLine =
  | { readonly kind: "empty" }
  | { readonly kind: "help" }
  | { readonly kind: "clear" }
  | {
      readonly kind: "run";
      /** The program's arguments, as `process.argv.slice(2)` would hold them. */
      readonly args: readonly string[];
      /** The file `cat` pipes to standard input, if the line has a pipe. */
      readonly piped: string | undefined;
    }
  | { readonly kind: "refused"; readonly message: string };

/**
 * Splits a line into words as a shell would, on runs of spaces, with
 * single or double quotes keeping a word together. Returns undefined for
 * a quote left open. `|` is a word of its own, spaced or not.
 */
export function words(line: string): string[] | undefined {
  const out: string[] = [];
  let word: string | undefined;
  let quote: string | undefined;
  for (const character of line) {
    if (quote !== undefined) {
      if (character === quote) quote = undefined;
      else word = (word ?? "") + character;
    } else if (character === '"' || character === "'") {
      quote = character;
      word ??= "";
    } else if (character === " " || character === "\t") {
      if (word !== undefined) out.push(word);
      word = undefined;
    } else if (character === "|") {
      if (word !== undefined) out.push(word);
      out.push("|");
      word = undefined;
    } else {
      word = (word ?? "") + character;
    }
  }
  if (quote !== undefined) return undefined;
  if (word !== undefined) out.push(word);
  return out;
}

const PROGRAMS = new Set(["dist/bin.js", "./dist/bin.js"]);

/**
 * The program's arguments, if `tokens` invoke herbie-lite as the README
 * shows (`node dist/bin.js ...` or `npm start -- ...`); otherwise why not.
 */
function program(
  tokens: readonly string[],
): { args: string[] } | { refused: string } {
  const [first, second, ...rest] = tokens;
  if (first === "node" && second !== undefined && PROGRAMS.has(second)) {
    return { args: rest };
  }
  if (first === "npm" && second === "start") {
    if (rest.length === 0) return { args: [] };
    if (rest[0] === "--") return { args: rest.slice(1) };
    // npm reads what comes before `--` itself, as the README warns.
    return {
      refused: `npm start ${rest.join(" ")}: npm would read these arguments itself; put -- before them: npm start -- ${rest.join(" ")}`,
    };
  }
  if (first !== undefined && Object.hasOwn(COMMAND_SYNTAX, first)) {
    return {
      refused: `${first} is a command for an input file, not for this console: write it in a workspace file, then run the file`,
    };
  }
  return {
    refused: `${first ?? ""}: not available here; this console runs herbie-lite only (type help)`,
  };
}

/**
 * What a typed line asks for. Only herbie-lite runs: as `node dist/bin.js`,
 * as `npm start --`, or with a file piped in by `cat`, the three forms the
 * README gives. Anything else is refused with a reason, and nothing runs.
 */
export function readCommandLine(line: string): CommandLine {
  const tokens = words(line);
  if (tokens === undefined) {
    return { kind: "refused", message: "a quote is not closed" };
  }
  if (tokens.length === 0) return { kind: "empty" };
  if (tokens.length === 1 && tokens[0] === "help") return { kind: "help" };
  if (tokens.length === 1 && tokens[0] === "clear") return { kind: "clear" };

  const pipe = tokens.indexOf("|");
  if (pipe === -1) {
    const invoked = program(tokens);
    return "args" in invoked
      ? { kind: "run", args: invoked.args, piped: undefined }
      : { kind: "refused", message: invoked.refused };
  }
  const left = tokens.slice(0, pipe);
  const right = tokens.slice(pipe + 1);
  if (right.includes("|")) {
    return { kind: "refused", message: "one pipe at most: cat <file> | ..." };
  }
  if (left[0] !== "cat" || left.length !== 2 || left[1] === undefined) {
    return {
      kind: "refused",
      message: "only a file can be piped in: cat <file> | node dist/bin.js",
    };
  }
  const invoked = program(right);
  return "args" in invoked
    ? { kind: "run", args: invoked.args, piped: left[1] }
    : { kind: "refused", message: invoked.refused };
}

/** What `help` prints: everything the console accepts. */
export const CONSOLE_HELP = [
  "This console runs herbie-lite and nothing else. It takes:",
  `  ${USAGE}`,
  "  npm start -- [the same arguments]",
  "  cat <file> | node dist/bin.js [arguments]",
  "  help      this text",
  "  clear     empty the console",
  "",
  "A file is examples/<name> for an example, or a workspace file by its",
  "name, as last saved. Commands such as Partner Chris go in a file, not",
  "here. node dist/bin.js --help describes the commands.",
  "",
].join("\n");

/** Finds a file's saved text by the path typed, or undefined. */
export type Files = (path: string) => string | undefined;

/**
 * The page's files by path: `examples/<name>` for an example, as it sits in
 * the repository, and a workspace file by its bare name, as it downloads
 * (Q25). Any other path names nothing here.
 */
export function pageFiles(
  examples: ReadonlyMap<string, string>,
  workspace: (name: string) => string | undefined,
): Files {
  return (path) => {
    const [first, second, ...rest] = path.split("/");
    if (first === undefined || rest.length > 0) return undefined;
    if (second === undefined) return workspace(first);
    return first === "examples" ? examples.get(second) : undefined;
  };
}

/** A path as typed, less a leading `./`. */
function normal(path: string): string {
  return path.startsWith("./") ? path.slice(2) : path;
}

/** Input that fails as Node's does for a missing file (Q15). */
function missing(path: string): Iterable<string> {
  return {
    [Symbol.iterator]() {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    },
  };
}

/** What a run printed, and anything `cat` said before it. */
export interface ShellRun {
  readonly cat: readonly string[];
  readonly result: Run;
}

/**
 * Runs an accepted line. A named file is read from `files`; a missing one
 * fails as the CLI's would. A piped file goes to standard input, and a
 * missing one makes `cat` complain and the program read nothing, as a
 * shell would. With neither, standard input is this console, a terminal,
 * so the program prints its opening (Q20).
 */
export async function runLine(
  line: {
    readonly args: readonly string[];
    readonly piped: string | undefined;
  },
  files: Files,
): Promise<ShellRun> {
  const cat: string[] = [];
  let stdin: Iterable<string> | undefined;
  if (line.piped !== undefined) {
    const text = files(normal(line.piped));
    if (text === undefined) {
      cat.push(`cat: ${line.piped}: No such file or directory`);
    }
    stdin = [text ?? ""];
  }
  const result = await run(line.args, (file) => {
    if (file === undefined) return stdin;
    const text = files(normal(file));
    return text === undefined ? missing(file) : [text];
  });
  return { cat, result };
}

/** What a keypress does: text to echo, a line to run, or a cleared pane. */
export type KeyEffect =
  | { readonly kind: "write"; readonly text: string }
  | { readonly kind: "submit"; readonly line: string }
  | { readonly kind: "clear" };

/**
 * Builds a line from what the terminal sends: printable text, Backspace,
 * Enter, Up and Down through history, Ctrl+C to drop the line and Ctrl+L to
 * clear. Other keys, the arrows left and right among them, are ignored, so
 * the cursor is always at the end of the line. Pasted text arrives as one
 * chunk, and each line in it runs in turn.
 */
export class LineEditor {
  private line = "";
  private readonly history: string[] = [];
  /** How far back in history the line is; 0 is the line being typed. */
  private back = 0;
  private draft = "";
  private afterReturn = false;

  constructor(private readonly prompt: string) {}

  /** The line as typed so far. */
  get current(): string {
    return this.line;
  }

  feed(data: string): KeyEffect[] {
    const effects: KeyEffect[] = [];
    let echo = "";
    const flush = (): void => {
      if (echo !== "") effects.push({ kind: "write", text: echo });
      echo = "";
    };
    for (let i = 0; i < data.length; i++) {
      const character = data[i] ?? "";
      const wasReturn = this.afterReturn;
      this.afterReturn = false;
      if (character === "\u001b") {
        // An escape sequence: ESC [ then parameters, then a final letter.
        let end = i + 1;
        if (data[end] === "[" || data[end] === "O") end++;
        while (end < data.length && !/[A-Za-z~]/.test(data[end] ?? "")) end++;
        const final = data[end];
        if (final === "A") echo += this.recall(1);
        if (final === "B") echo += this.recall(-1);
        i = end;
      } else if (character === "\r" || character === "\n") {
        // A pasted CRLF is one line break, not two.
        if (character === "\n" && wasReturn) continue;
        this.afterReturn = character === "\r";
        echo += "\r\n";
        flush();
        effects.push({ kind: "submit", line: this.line });
        this.remember(this.line);
        this.line = "";
      } else if (character === "\u007f" || character === "\b") {
        if (this.line !== "") {
          this.line = [...this.line].slice(0, -1).join("");
          echo += "\b \b";
        }
      } else if (character === "\u0003") {
        echo += `^C\r\n${this.prompt}`;
        this.line = "";
        this.back = 0;
      } else if (character === "\u000c") {
        flush();
        effects.push({ kind: "clear" });
        echo += this.prompt + this.line;
      } else if (character >= " ") {
        this.line += character;
        this.back = 0;
        echo += character;
      }
    }
    flush();
    return effects;
  }

  /**
   * Enters `line` as if it were typed, in place of whatever was on the
   * prompt, and returns the text that shows it; a button uses this to run
   * its command in the console (T11c).
   */
  enter(line: string): string {
    this.remember(line);
    this.line = "";
    return `\r\u001b[K${this.prompt}${line}\r\n`;
  }

  private remember(line: string): void {
    this.back = 0;
    this.draft = "";
    if (line.trim() !== "" && this.history.at(-1) !== line) {
      this.history.push(line);
    }
  }

  /** Moves `step` lines back (1) or forward (-1) in history. */
  private recall(step: 1 | -1): string {
    const back = Math.min(Math.max(this.back + step, 0), this.history.length);
    if (back === this.back) return "";
    if (this.back === 0) this.draft = this.line;
    this.back = back;
    this.line =
      back === 0
        ? this.draft
        : (this.history[this.history.length - back] ?? "");
    return `\r\u001b[K${this.prompt}${this.line}`;
  }
}
