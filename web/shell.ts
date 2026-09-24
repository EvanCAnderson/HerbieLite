// The console as a shell that runs herbie-lite and nothing else (T11c,
// DECISIONS T11.5): what a typed line asks for, how the keys typed build a
// line, and running an accepted line through the CLI's own run() (Q28).
// Apart from the DOM, so it is tested in vitest (T10.13); the pane is
// console-panel.ts.
import { USAGE } from "../src/help.js";
import { escaped } from "../src/warnings.js";
import { COMMAND_SYNTAX } from "../src/parser.js";
import { run, type Run } from "../src/run.js";

/**
 * Text the console echoes that the program did not print, made safe for the
 * pane (Q38): a typed or entered line, `cat`'s complaint, a refused line.
 * A control, format or separator character other than a space shows in the
 * warnings' notation (`\u009b`, T6.11), so it can neither act on the
 * terminal nor pass unseen. A backslash stays as typed.
 */
export function visible(text: string): string {
  return text.replace(/[\p{C}\p{Z}]/gu, (character) =>
    character === " " ? character : escaped(character),
  );
}

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
    const typed = visible(rest.join(" "));
    return {
      refused: `npm start ${typed}: npm would read these arguments itself; put -- before them: npm start -- ${typed}`,
    };
  }
  if (first !== undefined && Object.hasOwn(COMMAND_SYNTAX, first)) {
    return {
      refused: `${first} is a command for an input file, not for this console: write it in a workspace file, then run the file`,
    };
  }
  return {
    refused: `${visible(first ?? "")}: not available here; this console runs herbie-lite only (type help)`,
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
      cat.push(`cat: ${visible(line.piped)}: No such file or directory`);
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

/**
 * Runs tasks one at a time, in the order added, so a paste of several lines,
 * or quick clicks, cannot interleave their output. A task that throws is
 * handed to `onError`, and the tasks after it still run (T12e).
 */
export class TaskQueue {
  private tail: Promise<void> = Promise.resolve();
  private count = 0;

  constructor(private readonly onError: (error: unknown) => void) {}

  /** Tasks added and not yet finished, the one running included. */
  get pending(): number {
    return this.count;
  }

  add(task: () => Promise<void> | void): void {
    this.count += 1;
    this.tail = this.tail
      .then(task)
      .catch((error: unknown) => {
        try {
          this.onError(error);
        } catch (again) {
          // The handler failed too; the queue must still move on.
          console.error(again);
        }
      })
      .finally(() => {
        this.count -= 1;
      });
  }
}

/**
 * What a keypress does: text to echo, a line to run, or a cleared pane. A
 * submitted line carries `echo`, the text that shows it once it runs; it is
 * empty when the line is on screen already (Q39).
 */
export type KeyEffect =
  | { readonly kind: "write"; readonly text: string }
  | { readonly kind: "submit"; readonly line: string; readonly echo: string }
  | { readonly kind: "clear" };

/**
 * Builds a line from what the terminal sends: printable text, Backspace,
 * Enter, Up and Down through history, Ctrl+C to drop the line and Ctrl+L to
 * clear. Other keys, the arrows left and right among them, are ignored, so
 * the cursor is always at the end of the line, and so is every control
 * character, C1 included, which could otherwise act on the pane (Q38). The
 * line is echoed by `visible`. Pasted text arrives as one chunk: its first
 * line is echoed as it arrives, and each later one when it runs, so each
 * answer sits under its own command (Q39).
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

  /** The prompt and the line so far, as the pane shows them. */
  promptLine(): string {
    return `${this.prompt}${visible(this.line)}`;
  }

  feed(data: string): KeyEffect[] {
    const effects: KeyEffect[] = [];
    let echo = "";
    // After a line is submitted, the rest of the chunk waits to run behind
    // it, so nothing more is echoed now; each later line shows as it runs.
    let waiting = false;
    const show = (text: string): void => {
      if (!waiting) echo += text;
    };
    const flush = (): void => {
      if (echo !== "") effects.push({ kind: "write", text: echo });
      echo = "";
    };
    // By code point, so a character outside the BMP is one character.
    const characters = [...data];
    for (let i = 0; i < characters.length; i++) {
      const character = characters[i] ?? "";
      const wasReturn = this.afterReturn;
      this.afterReturn = false;
      if (character === "\u001b") {
        // An escape sequence: ESC [ then parameters, then a final letter.
        let end = i + 1;
        if (characters[end] === "[" || characters[end] === "O") end++;
        while (
          end < characters.length &&
          !/[A-Za-z~]/.test(characters[end] ?? "")
        ) {
          end++;
        }
        const final = characters[end];
        if (final === "A") show(this.recall(1));
        if (final === "B") show(this.recall(-1));
        i = end;
      } else if (character === "\r" || character === "\n") {
        // A pasted CRLF is one line break, not two.
        if (character === "\n" && wasReturn) continue;
        this.afterReturn = character === "\r";
        const line = this.line;
        if (waiting) {
          effects.push({ kind: "submit", line, echo: `${visible(line)}\r\n` });
        } else {
          echo += "\r\n";
          flush();
          effects.push({ kind: "submit", line, echo: "" });
        }
        waiting = true;
        this.remember(line);
        this.line = "";
      } else if (character === "\u007f" || character === "\b") {
        const kept = [...this.line];
        const last = kept.pop();
        if (last !== undefined) {
          this.line = kept.join("");
          // An escaped character takes more than one cell to erase.
          show("\b \b".repeat(visible(last).length));
        }
      } else if (character === "\u0003") {
        show(`^C\r\n${this.prompt}`);
        this.line = "";
        this.back = 0;
      } else if (character === "\u000c") {
        flush();
        effects.push({ kind: "clear" });
        show(this.promptLine());
      } else if (!/\p{Cc}/u.test(character)) {
        this.line += character;
        this.back = 0;
        show(visible(character));
      }
    }
    flush();
    return effects;
  }

  /**
   * Enters `line` as if it were typed, in place of whatever was on the
   * prompt, and returns the text that shows it when it runs; a button uses
   * this to run its command in the console (T11c).
   */
  enter(line: string): string {
    this.remember(line);
    this.line = "";
    return `\r\u001b[K${this.prompt}${visible(line)}\r\n`;
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
    return `\r\u001b[K${this.promptLine()}`;
  }
}
