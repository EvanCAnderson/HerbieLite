import { describe, expect, it, vi } from "vitest";
import { OPENING } from "../src/help.js";
import type { Run } from "../src/run.js";
import { EXAMPLES } from "./examples.js";
import {
  CONSOLE_HELP,
  LineEditor,
  pageFiles,
  readCommandLine,
  runLine,
  TaskQueue,
  visible,
  words,
  type Files,
} from "./shell.js";

const files: Files = (path) => {
  if (path.startsWith("examples/")) return EXAMPLES.get(path.slice(9));
  return path === "draft.txt" ? "Company ACME\n" : undefined;
};

const REPORT =
  "ACME: No current relationship\nGlobex: Chris (2)\nHooli: Molly (1)\n";

describe("splitting a line into words", () => {
  it("splits on spaces and keeps quoted words together", () => {
    expect(words("  node  dist/bin.js 'a b.txt' \"c\"")).toEqual([
      "node",
      "dist/bin.js",
      "a b.txt",
      "c",
    ]);
  });

  it("makes a pipe a word of its own, spaced or not", () => {
    expect(words("cat a.txt|node dist/bin.js")).toEqual([
      "cat",
      "a.txt",
      "|",
      "node",
      "dist/bin.js",
    ]);
  });

  it("returns nothing for a quote left open", () => {
    expect(words("node 'dist/bin.js")).toBeUndefined();
  });
});

describe("what a typed line asks for (T11.5)", () => {
  it("runs node dist/bin.js with its arguments", () => {
    expect(
      readCommandLine("node dist/bin.js --partners Globex examples/input.txt"),
    ).toEqual({
      kind: "run",
      args: ["--partners", "Globex", "examples/input.txt"],
      piped: undefined,
    });
    expect(readCommandLine("node ./dist/bin.js")).toEqual({
      kind: "run",
      args: [],
      piped: undefined,
    });
  });

  it("runs npm start with the arguments after --", () => {
    expect(readCommandLine("npm start -- examples/input.txt")).toEqual({
      kind: "run",
      args: ["examples/input.txt"],
      piped: undefined,
    });
    expect(readCommandLine("npm start")).toMatchObject({ args: [] });
  });

  it("refuses npm start arguments without --, as npm would take them", () => {
    expect(readCommandLine("npm start --help")).toMatchObject({
      kind: "refused",
      message: expect.stringContaining("npm start -- --help") as string,
    });
  });

  it("pipes a file in with cat", () => {
    expect(
      readCommandLine("cat examples/input.txt | node dist/bin.js"),
    ).toEqual({ kind: "run", args: [], piped: "examples/input.txt" });
  });

  it("knows help, clear, and an empty line", () => {
    expect(readCommandLine("help")).toEqual({ kind: "help" });
    expect(readCommandLine("clear")).toEqual({ kind: "clear" });
    expect(readCommandLine("   ")).toEqual({ kind: "empty" });
  });

  it("refuses a command typed as input, pointing at a file instead", () => {
    expect(readCommandLine("Partner Chris")).toMatchObject({
      kind: "refused",
      message: expect.stringContaining("command for an input file") as string,
    });
  });

  it("escapes a control character in a refusal (Q38)", () => {
    expect(readCommandLine("\u009b2J")).toEqual({
      kind: "refused",
      message:
        "\\u009b2J: not available here; this console runs herbie-lite only (type help)",
    });
    expect(readCommandLine("npm start \u001b[31m")).toMatchObject({
      kind: "refused",
      message: expect.stringContaining("npm start -- \\u001b[31m") as string,
    });
  });

  it("refuses every other program", () => {
    for (const line of [
      "ls",
      "rm -rf /",
      "node other.js",
      "bash",
      "echo hi | node dist/bin.js",
      "cat a.txt | node dist/bin.js | cat",
      "cat a.txt | sh",
    ]) {
      expect(readCommandLine(line).kind).toBe("refused");
    }
  });
});

describe("running an accepted line (Q28)", () => {
  it("prints the report for a named example, as the CLI does", async () => {
    const { cat, result } = await runLine(
      { args: ["examples/input.txt"], piped: undefined },
      files,
    );
    expect(cat).toEqual([]);
    expect(result).toEqual({ stderr: [], stdout: REPORT, notes: [], code: 0 });
  });

  /** Runs the text as the workspace file draft.txt, by name. */
  async function runText(text: string): Promise<Run> {
    const { result } = await runLine(
      { args: ["draft.txt"], piped: undefined },
      (path) => (path === "draft.txt" ? text : undefined),
    );
    return result;
  }

  it("warns about a bad line and still prints the report (Q7)", async () => {
    const result = await runText("Company ACME\nPartner chris9\n");
    expect(result.stderr).toEqual([
      'herbie-lite: line 2: names must be letters only; expected "Partner <Name>"; discarded: Partner chris9',
    ]);
    expect(result.stdout).toBe("ACME: No current relationship\n");
    expect(result.code).toBe(0);
  });

  it("splits lines as the CLI's reader does, byte-order mark and all (Q16)", async () => {
    const result = await runText("﻿Company ACME\r\nCompany Hooli");
    expect(result.stderr).toEqual([]);
    expect(result.stdout).toBe(
      "ACME: No current relationship\nHooli: No current relationship\n",
    );
  });

  it("returns a tie's note separately, to follow the report (Q21)", async () => {
    const result = await runText(EXAMPLES.get("ties.txt") ?? "");
    expect(result.notes.length).toBeGreaterThan(0);
    expect(result.notes[0]).toMatch(/^herbie-lite: \w+ is a tie between /);
  });

  it("answers a query about a workspace file", async () => {
    const { result } = await runLine(
      { args: ["--partners", "ACME", "./draft.txt"], piped: undefined },
      files,
    );
    expect(result.stdout).toBe("ACME: No current relationship\n");
  });

  it("reads a piped file from standard input", async () => {
    const { result } = await runLine(
      { args: [], piped: "examples/input.txt" },
      files,
    );
    expect(result.stdout).toBe(REPORT);
  });

  it("fails on a missing file with the CLI's own error", async () => {
    const { result } = await runLine(
      { args: ["nope.txt"], piped: undefined },
      files,
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toEqual([
      "herbie-lite: cannot read \"nope.txt\": ENOENT: no such file or directory, open 'nope.txt'",
    ]);
  });

  it("lets cat complain about a missing piped file, and reads nothing", async () => {
    const { cat, result } = await runLine(
      { args: [], piped: "nope.txt" },
      files,
    );
    expect(cat).toEqual(["cat: nope.txt: No such file or directory"]);
    expect(result).toEqual({ stderr: [], stdout: "", notes: [], code: 0 });
  });

  it("escapes a control character in cat's complaint (Q38)", async () => {
    const { cat } = await runLine({ args: [], piped: "a\u009b.txt" }, files);
    expect(cat).toEqual(["cat: a\\u009b.txt: No such file or directory"]);
  });

  it("prints the opening with no file, since the console is a terminal (Q20)", async () => {
    const { result } = await runLine({ args: [], piped: undefined }, files);
    expect(result).toMatchObject({ stdout: OPENING, code: 1 });
  });

  it("describes what it accepts", () => {
    expect(CONSOLE_HELP).toContain("npm start --");
    expect(CONSOLE_HELP).toContain("cat <file> | node dist/bin.js");
  });
});

describe("the page's files by path", () => {
  const find = pageFiles(new Map([["input.txt", "example"]]), (name) =>
    name === "draft.txt" ? "workspace" : undefined,
  );

  it("finds an example under examples/ and a workspace file by name", () => {
    expect(find("examples/input.txt")).toBe("example");
    expect(find("draft.txt")).toBe("workspace");
  });

  it("finds nothing anywhere else", () => {
    for (const path of [
      "input.txt",
      "examples/draft.txt",
      "a/b.txt",
      "examples/x/input.txt",
      "/etc/passwd",
    ]) {
      expect(find(path)).toBeUndefined();
    }
  });
});

describe("building a line from keys", () => {
  it("echoes printable keys and submits on Enter", () => {
    const editor = new LineEditor("$ ");
    expect(editor.feed("help")).toEqual([{ kind: "write", text: "help" }]);
    expect(editor.feed("\r")).toEqual([
      { kind: "write", text: "\r\n" },
      { kind: "submit", line: "help", echo: "" },
    ]);
    expect(editor.current).toBe("");
  });

  it("erases with Backspace, and not past the start", () => {
    const editor = new LineEditor("$ ");
    editor.feed("ab\u007f\u007f\u007f");
    expect(editor.current).toBe("");
  });

  it("runs each line of a paste in turn, CRLF counted once", () => {
    const editor = new LineEditor("$ ");
    const submitted = editor
      .feed("help\r\nclear\n")
      .filter((effect) => effect.kind === "submit");
    expect(submitted.map((effect) => effect.line)).toEqual(["help", "clear"]);
  });

  it("echoes a paste's first line now, and each later one as it runs (Q39)", () => {
    const editor = new LineEditor("$ ");
    expect(editor.feed("help\nclear\nnode\u007fde\u0003\rpart")).toEqual([
      { kind: "write", text: "help\r\n" },
      { kind: "submit", line: "help", echo: "" },
      { kind: "submit", line: "clear", echo: "clear\r\n" },
      { kind: "submit", line: "", echo: "\r\n" },
    ]);
    // What follows the last line break is shown with the prompt, once the
    // lines before it have run.
    expect(editor.promptLine()).toBe("$ part");
  });

  it("recalls earlier lines with Up and returns to the draft with Down", () => {
    const editor = new LineEditor("$ ");
    editor.feed("one\rtwo\rdraft");
    editor.feed("\u001b[A");
    expect(editor.current).toBe("two");
    editor.feed("\u001b[A\u001b[A");
    expect(editor.current).toBe("one");
    editor.feed("\u001b[B\u001b[B");
    expect(editor.current).toBe("draft");
  });

  it("drops the line on Ctrl+C and ignores left and right", () => {
    const editor = new LineEditor("$ ");
    editor.feed("abc\u001b[D\u001b[C");
    expect(editor.current).toBe("abc");
    expect(editor.feed("\u0003")).toEqual([
      { kind: "write", text: "^C\r\n$ " },
    ]);
    expect(editor.current).toBe("");
  });

  it("enters a line for a button, in place of what was typed, into history", () => {
    const editor = new LineEditor("$ ");
    editor.feed("half");
    expect(editor.enter("node dist/bin.js a.txt")).toBe(
      "\r\u001b[K$ node dist/bin.js a.txt\r\n",
    );
    expect(editor.current).toBe("");
    editor.feed("\u001b[A");
    expect(editor.current).toBe("node dist/bin.js a.txt");
  });

  it("refuses every control character, C1 included (Q38)", () => {
    const editor = new LineEditor("$ ");
    expect(editor.feed("a\u009b2J\u0007\u0000\u0085b")).toEqual([
      { kind: "write", text: "a2Jb" },
    ]);
    expect(editor.current).toBe("a2Jb");
  });

  it("echoes a format or separator character escaped, and erases it whole (Q38)", () => {
    const editor = new LineEditor("$ ");
    expect(editor.feed("a\u00a0b\u202e")).toEqual([
      { kind: "write", text: "a\\u00a0b\\u202e" },
    ]);
    editor.feed("\u007f");
    expect(editor.feed("\u007f")).toEqual([{ kind: "write", text: "\b \b" }]);
    expect(editor.feed("\u007f")).toEqual([
      { kind: "write", text: "\b \b".repeat(6) },
    ]);
    expect(editor.current).toBe("a");
  });

  it("keeps a character outside the BMP whole, and shows it as typed", () => {
    const editor = new LineEditor("$ ");
    expect(editor.feed("\u{1f600}")).toEqual([
      { kind: "write", text: "\u{1f600}" },
    ]);
    editor.feed("\u007f");
    expect(editor.current).toBe("");
  });

  it("escapes a control character in a line a button enters, and when recalled (Q38)", () => {
    const editor = new LineEditor("$ ");
    const line = "node dist/bin.js --partners '\u009b2J' a.txt";
    const shown = "node dist/bin.js --partners '\\u009b2J' a.txt";
    expect(editor.enter(line)).toBe(`\r\u001b[K$ ${shown}\r\n`);
    expect(editor.feed("\u001b[A")).toEqual([
      { kind: "write", text: `\r\u001b[K$ ${shown}` },
    ]);
    expect(editor.current).toBe(line);
  });

  it("asks for a cleared pane on Ctrl+L, keeping the line", () => {
    const editor = new LineEditor("$ ");
    editor.feed("abc");
    expect(editor.feed("\u000c")).toEqual([
      { kind: "clear" },
      { kind: "write", text: "$ abc" },
    ]);
  });
});

describe("text the console echoes (Q38)", () => {
  it("shows controls, format and separator characters as the warnings do", () => {
    expect(visible("a\u009b\u001b[2J\u00a0\u200b b")).toBe(
      "a\\u009b\\u001b[2J\\u00a0\\u200b b",
    );
  });

  it("leaves a backslash and visible non-ASCII as typed", () => {
    expect(visible("a\\b Zo\u00eb")).toBe("a\\b Zo\u00eb");
  });
});

describe("running lines in turn (T12e)", () => {
  it("runs each task after the last has finished", async () => {
    const order: string[] = [];
    const queue = new TaskQueue(() => undefined);
    let finish = (): void => undefined;
    queue.add(
      () =>
        new Promise<void>((resolve) => {
          finish = () => {
            order.push("first");
            resolve();
          };
        }),
    );
    queue.add(() => {
      order.push("second");
    });
    expect(queue.pending).toBe(2);
    await Promise.resolve();
    finish();
    await vi.waitFor(() => {
      expect(queue.pending).toBe(0);
    });
    expect(order).toEqual(["first", "second"]);
  });

  it("hands a throw to its handler, and still runs the tasks after it", async () => {
    const errors: unknown[] = [];
    const ran: string[] = [];
    const queue = new TaskQueue((error) => errors.push(error));
    const bug = new Error("bug");
    queue.add(() => {
      throw bug;
    });
    queue.add(() => Promise.reject(bug));
    queue.add(() => {
      ran.push("after");
    });
    await vi.waitFor(() => {
      expect(queue.pending).toBe(0);
    });
    expect(errors).toEqual([bug, bug]);
    expect(ran).toEqual(["after"]);
  });

  it("still moves on when the handler itself throws", async () => {
    const quiet = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const ran: string[] = [];
    const queue = new TaskQueue(() => {
      throw new Error("handler");
    });
    queue.add(() => {
      throw new Error("bug");
    });
    queue.add(() => {
      ran.push("after");
    });
    await vi.waitFor(() => {
      expect(queue.pending).toBe(0);
    });
    expect(ran).toEqual(["after"]);
    expect(quiet).toHaveBeenCalledOnce();
    quiet.mockRestore();
  });
});
