import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { main } from "./cli.js";
import { HELP, OPENING } from "./help.js";
import type { SourceLine } from "./parser.js";

// The parser, made to throw on request, so a test can throw from inside the
// read loop itself (T6.12). Every other test gets the real parser.
const parser = vi.hoisted(() => ({ fault: undefined as Error | undefined }));
vi.mock("./parser.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./parser.js")>();
  return {
    ...actual,
    parseLine: (source: SourceLine) => {
      if (parser.fault !== undefined) throw parser.fault;
      return actual.parseLine(source);
    },
  };
});

const ROOT = join(import.meta.dirname, "..");
const EXAMPLES = join(ROOT, "examples");
const INPUT = join(EXAMPLES, "input.txt");

/** The brief's expected output (PLAN §7), as the program writes it. */
const EXPECTED =
  "ACME: No current relationship\nGlobex: Chris (2)\nHooli: Molly (1)\n";

function sink(): NodeJS.WritableStream & { readonly text: () => string } {
  let text = "";
  const stream = new Writable({
    write(chunk: Buffer | string, _encoding, done) {
      text += chunk.toString();
      done();
    },
  });
  return Object.assign(stream, { text: () => text });
}

/** A stdout that fails every write, as a closed pipe does (Q17). */
function failingSink(code: string): NodeJS.WritableStream {
  return new Writable({
    write(_chunk, _encoding, done) {
      done(Object.assign(new Error(`write ${code}`), { code }));
    },
  });
}

interface Run {
  readonly code: number;
  readonly out: string;
  readonly err: string;
}

async function run(
  args: readonly string[],
  input = "",
  options: { readonly stdout?: NodeJS.WritableStream } = {},
): Promise<Run> {
  const out = sink();
  const err = sink();
  const code = await main(
    args,
    Readable.from([input]),
    options.stdout ?? out,
    err,
  );
  return { code, out: out.text(), err: err.text() };
}

describe("choosing an input source (T1.10)", () => {
  it("reads the file named by the only argument", async () => {
    expect(await run([INPUT])).toEqual({ code: 0, out: EXPECTED, err: "" });
  });

  it("reads STDIN when no argument is given", async () => {
    const input = readFileSync(INPUT, "utf8");
    expect(await run([], input)).toEqual({ code: 0, out: EXPECTED, err: "" });
  });

  it("prefers the file argument over STDIN", async () => {
    const run_ = await run([INPUT], "Company Ignored\n");
    expect(run_.out).toBe(EXPECTED);
  });
});

describe("invalid invocation (Q15)", () => {
  it("refuses more than one argument, and prints no report", async () => {
    const { code, out, err } = await run([INPUT, INPUT]);
    expect(code).toBe(1);
    expect(out).toBe("");
    expect(err).toBe(
      "herbie-lite: expected at most one file argument, got 2; usage: node dist/bin.js [--help | [--partners <Company> | --employees <Company>] file]\n",
    );
  });

  it("reports a file it cannot read, and prints no report", async () => {
    const { code, out, err } = await run([join(ROOT, "nosuch.txt")]);
    expect(code).toBe(1);
    expect(out).toBe("");
    expect(err).toMatch(/^herbie-lite: cannot read ".*nosuch\.txt": .*ENOENT/);
  });

  it("shows an empty path as an empty quote (T8.4)", async () => {
    const { code, err } = await run([""]);
    expect(code).toBe(1);
    expect(err).toMatch(/^herbie-lite: cannot read "": /);
  });

  it("escapes a terminal escape sequence in the path (T8.4)", async () => {
    const { code, err } = await run(["bad[31m"]);
    expect(code).toBe(1);
    expect(err).toMatch(/^herbie-lite: cannot read "bad\\u001b\[31m": /);
    expect(err).not.toContain("");
  });
});

describe("help and options (Q19)", () => {
  it("prints the help to stdout for --help and exits 0", async () => {
    expect(await run(["--help"])).toEqual({ code: 0, out: HELP, err: "" });
  });

  it("treats -h as --help", async () => {
    expect(await run(["-h"])).toEqual({ code: 0, out: HELP, err: "" });
  });

  it("prints the help wherever --help appears, ignoring the rest", async () => {
    expect(await run([INPUT, INPUT, "--help"])).toEqual({
      code: 0,
      out: HELP,
      err: "",
    });
  });

  it("refuses any other option, with the usage, and prints no report", async () => {
    expect(await run(["--verbose", INPUT])).toEqual({
      code: 1,
      out: "",
      err: 'herbie-lite: unknown option "--verbose"; usage: node dist/bin.js [--help | [--partners <Company> | --employees <Company>] file]\n',
    });
  });

  it("does not take - to mean STDIN", async () => {
    const { code, err } = await run(["-"], "Company ACME\n");
    expect(code).toBe(1);
    expect(err).toMatch(/^herbie-lite: unknown option "-"; usage: /);
  });

  it("reads a file whose name starts with - when written as ./-name", async () => {
    const { code, err } = await run(["./-nosuch.txt"]);
    expect(code).toBe(1);
    expect(err).toMatch(/^herbie-lite: cannot read "\.\/-nosuch\.txt": /);
  });

  it("escapes a terminal escape sequence in an option (T8.4)", async () => {
    const { err } = await run(["-\u001b[31m"]);
    expect(err).toMatch(/^herbie-lite: unknown option "-\\u001b\[31m"; /);
    expect(err).not.toContain("\u001b");
  });

  it("ends quietly with exit 0 when --help meets a closed pipe (Q17)", async () => {
    const { code, err } = await run(["--help"], "", {
      stdout: failingSink("EPIPE"),
    });
    expect({ code, err }).toEqual({ code: 0, err: "" });
  });
});

describe("queries about one company (Q31, Q33)", () => {
  it("answers --partners instead of the report", async () => {
    expect(await run(["--partners", "Globex", INPUT])).toEqual({
      code: 0,
      out: "Globex: Chris (2), Molly (1)\n",
      err: "",
    });
  });

  it("answers --employees, with the option after the file", async () => {
    expect(await run([INPUT, "--employees", "Globex"])).toEqual({
      code: 0,
      out: "Jamie: No contacts\nLaurie: Chris (2), Molly (1)\n",
      err: "",
    });
  });

  it("answers from a pipe, for a company declared on the last line", async () => {
    expect(
      await run(
        ["--partners", "Hooli"],
        "Partner Molly\nEmployee Abdi Hooli\nContact Abdi Molly email\nCompany Hooli\n",
      ),
    ).toEqual({ code: 0, out: "Hooli: Molly (1)\n", err: "" });
  });

  it("still prints warnings, and no tie note", async () => {
    const { code, out, err } = await run(
      ["--partners", "Zebra"],
      "Partner Bo\nPartner Al\nCompany Zebra\nEmployee Ada Zebra\nContact Ada Bo call\nContact Ada Al email\npartner Cy\n",
    );
    expect(code).toBe(0);
    expect(out).toBe("Zebra: Al (1), Bo (1)\n");
    expect(err).toBe(
      "herbie-lite: line 7: unknown command; expected one of Partner, Company, Employee, Contact; discarded: partner Cy\n",
    );
  });

  it("prints nothing for a company with no employees", async () => {
    expect(await run(["--employees", "ACME", INPUT])).toEqual({
      code: 0,
      out: "",
      err: "",
    });
  });

  it("refuses a company never declared, after reading the input (Q33)", async () => {
    expect(await run(["--partners", "Initech", INPUT])).toEqual({
      code: 1,
      out: "",
      err: 'herbie-lite: no company named "Initech" was declared\n',
    });
  });

  it("refuses a query with no company, with the usage", async () => {
    const { code, err } = await run(["--partners"]);
    expect(code).toBe(1);
    expect(err).toMatch(
      /^herbie-lite: --partners needs a company name; usage: /,
    );
  });

  it("does not take the next option as the company", async () => {
    const { code, err } = await run([
      "--partners",
      "--employees",
      "ACME",
      INPUT,
    ]);
    expect(code).toBe(1);
    expect(err).toMatch(/^herbie-lite: --partners needs a company name; /);
  });

  it("refuses two queries in one run", async () => {
    const { code, err } = await run([
      "--partners",
      "ACME",
      "--employees",
      "ACME",
      INPUT,
    ]);
    expect(code).toBe(1);
    expect(err).toMatch(
      /^herbie-lite: expected at most one of --partners and --employees; usage: /,
    );
  });

  it("still prints the help when --help appears with a query (Q19)", async () => {
    expect(await run(["--partners", "Globex", "--help"])).toEqual({
      code: 0,
      out: HELP,
      err: "",
    });
  });
});

describe("warnings never cost the report (Q7, Q8)", () => {
  it("warns on stderr, prints the report, and exits 0", async () => {
    const { code, out, err } = await run(
      [],
      `partner Chris
Partner Molly
Company Globex
Employee Laurie Globex
Contact Laurie Molly call
Contact Laurie Chris email
`,
    );
    expect(code).toBe(0);
    expect(out).toBe("Globex: Molly (1)\n");
    expect(err.split("\n").filter((line) => line !== "")).toEqual([
      "herbie-lite: line 1: unknown command; expected one of Partner, Company, Employee, Contact; discarded: partner Chris",
      "herbie-lite: line 6: no partner named Chris was declared; discarded: Contact Laurie Chris email",
    ]);
  });

  it("notes a tie after the warnings and the report, and still exits 0 (Q21)", async () => {
    const { code, out, err } = await run(
      [],
      `Partner Molly
Partner Chris
Company Globex
Employee Laurie Globex
Contact Laurie Molly call
Contact Laurie Chris email
Contact Laurie Rezzan coffee
`,
    );
    expect(code).toBe(0);
    expect(out).toBe("Globex: Chris (1)\n");
    expect(err).toBe(
      "herbie-lite: line 7: no partner named Rezzan was declared; discarded: Contact Laurie Rezzan coffee\n" +
        "herbie-lite: Globex is a tie between Chris and Molly (1 contact each); Chris is shown because it comes first alphabetically\n",
    );
  });

  it("writes a tie's note after the report, as a footnote (Q21)", async () => {
    // One stream for both, so the order a terminal would show is visible.
    const both = sink();
    const tie = `Partner Bo
Partner Al
Company Zebra
Employee Ada Zebra
Contact Ada Bo call
Contact Ada Al email
`;
    await expect(main([], Readable.from([tie]), both, both)).resolves.toBe(0);
    expect(both.text()).toBe(
      "Zebra: Al (1)\n" +
        "herbie-lite: Zebra is a tie between Al and Bo (1 contact each); Al is shown because it comes first alphabetically\n",
    );
  });

  it("notes no tie when the report could not be written (Q21, Q17)", async () => {
    const { code, err } = await run(
      [],
      `Partner Bo
Partner Al
Company Zebra
Employee Ada Zebra
Contact Ada Bo call
Contact Ada Al email
`,
      { stdout: failingSink("EIO") },
    );
    expect(code).toBe(1);
    expect(err).toBe("herbie-lite: cannot write output: write EIO\n");
  });

  it("prints every warning in line order, whichever layer found it (T9.13)", async () => {
    // Line 2 is only known to be a repeat once all input is in, and line 3
    // fails in the parser as it is read; stderr still follows the file.
    const { err } = await run(
      [],
      `Partner Molly
Partner Molly
Compny Globex
`,
    );
    expect(err.split("\n").filter((line) => line !== "")).toEqual([
      "herbie-lite: line 2: repeats the declaration on line 1; discarded: Partner Molly",
      "herbie-lite: line 3: unknown command; expected one of Partner, Company, Employee, Contact; discarded: Compny Globex",
    ]);
  });
});

describe("output shape (FR3, FR4)", () => {
  it("ends the report with exactly one newline", async () => {
    const { out } = await run([], "Company ACME\nCompany Globex\n");
    expect(out).toBe(
      "ACME: No current relationship\nGlobex: No current relationship\n",
    );
  });

  it("prints nothing at all when no company is declared", async () => {
    expect(await run([], "Partner Chris\n")).toEqual({
      code: 0,
      out: "",
      err: "",
    });
  });

  it("prints nothing for empty input", async () => {
    expect(await run([], "")).toEqual({ code: 0, out: "", err: "" });
  });
});

describe("commands come from a file, not typing (Q20)", () => {
  /** STDIN as a terminal presents it: a stream with `isTTY` set (T6.2). */
  async function runAtTerminal(args: readonly string[]): Promise<Run> {
    const out = sink();
    const err = sink();
    const stdin = Object.assign(Readable.from(["Company ACME\n"]), {
      isTTY: true,
    });
    const code = await main(args, stdin, out, err);
    return { code, out: out.text(), err: err.text() };
  }

  it("explains how to give a file instead of reading typed input, and exits 1", async () => {
    expect(await runAtTerminal([])).toEqual({
      code: 1,
      out: OPENING,
      err: "",
    });
  });

  it("reads a named file when STDIN is a terminal", async () => {
    expect(await runAtTerminal([INPUT])).toEqual({
      code: 0,
      out: EXPECTED,
      err: "",
    });
  });

  it("prints the help for --help when STDIN is a terminal", async () => {
    expect(await runAtTerminal(["--help"])).toEqual({
      code: 0,
      out: HELP,
      err: "",
    });
  });

  it("reads a pipe, which is file contents, not typing", async () => {
    expect(await run([], "Company ACME\n")).toEqual({
      code: 0,
      out: "ACME: No current relationship\n",
      err: "",
    });
  });
});

describe("a reader that stops early (Q17)", () => {
  it("ends quietly with exit 0 when stdout is a closed pipe", async () => {
    const { code, out, err } = await run([INPUT], "", {
      stdout: failingSink("EPIPE"),
    });
    expect(code).toBe(0);
    expect(out).toBe("");
    expect(err).toBe("");
  });

  it("reports any other write failure and exits 1", async () => {
    const { code, err } = await run([INPUT], "", {
      stdout: failingSink("ENOSPC"),
    });
    expect(code).toBe(1);
    expect(err).toBe("herbie-lite: cannot write output: write ENOSPC\n");
  });
});

describe("quoted input is escaped and bounded (T6.11)", () => {
  it("escapes a CRLF file's carriage return, so the message survives", async () => {
    const { err } = await run(
      [],
      "Company Globex\r\nEmployee Laurie Globex\r\nPartner Laurie\r\n",
    );
    expect(err).toBe(
      "herbie-lite: line 3: Laurie is already declared on line 2 as " +
        '"Employee Laurie Globex\\r"; discarded: Partner Laurie\\r\n',
    );
    expect(err).not.toContain("\r");
  });

  it("escapes a terminal escape sequence rather than sending it", async () => {
    const { err } = await run([], "Partner Chris\u001b[2J\n");
    expect(err).toContain("discarded: Partner Chris\\u001b[2J");
    expect(err).not.toContain("\u001b");
  });

  it("bounds a very long line and says how long it was", async () => {
    const { err } = await run([], `${"x".repeat(5000)}\n`);
    expect(err.length).toBeLessThan(400);
    expect(err.trimEnd().endsWith("... (5000 characters)")).toBe(true);
  });
});

describe("decoding (T6.4)", () => {
  it("reassembles a character split across two byte chunks", async () => {
    // Why main sets an encoding rather than concatenating buffers: the two
    // bytes of `é` arrive separately. Names are ASCII (Q9), so this only
    // shows up in the text a warning quotes.
    const stdin = Readable.from(
      [Buffer.from([0xc3]), Buffer.from([0xa9, 0x0a])],
      { objectMode: false },
    );
    const err = sink();
    await main([], stdin, sink(), err);
    expect(err.text()).toContain("discarded: é\n");
  });
});

describe("an I/O failure and a bug are told apart (T6.12)", () => {
  it("reports a stream that fails partway as an I/O failure", async () => {
    const exploding = new Readable({
      read() {
        this.destroy(new Error("stream gave up"));
      },
    });
    const err = sink();
    await expect(main([], exploding, sink(), err)).resolves.toBe(1);
    expect(err.text()).toBe(
      "herbie-lite: cannot read standard input: stream gave up\n",
    );
  });

  it("still prints the warnings for lines read before the failure (T9.13)", async () => {
    let sent = false;
    const failsAfterOneLine = new Readable({
      read() {
        if (sent) this.destroy(new Error("stream gave up"));
        else {
          sent = true;
          this.push("partner Chris\n");
        }
      },
    });
    const err = sink();
    await expect(main([], failsAfterOneLine, sink(), err)).resolves.toBe(1);
    expect(err.text()).toBe(
      "herbie-lite: line 1: unknown command; expected one of Partner, Company, Employee, Contact; discarded: partner Chris\n" +
        "herbie-lite: cannot read standard input: stream gave up\n",
    );
  });

  it("lets any other throw from inside the read loop propagate", async () => {
    // buildReport already crashes on a broken invariant (T5.2); this holds
    // the other half, that the try around the read loop catches only
    // ReadError and never dresses a bug up as a problem with the user's file.
    const boom = new Error("bug in the parser");
    parser.fault = boom;
    const err = sink();
    try {
      await expect(
        main([], Readable.from(["Partner Chris\n"]), sink(), err),
      ).rejects.toBe(boom);
    } finally {
      parser.fault = undefined;
    }
    expect(err.text()).toBe("");
  });
});

/**
 * T7e: every shipped example, asserted exactly. The file a reviewer runs and
 * the output this suite asserts are then the same bytes, which is what T5.5
 * asks of the brief's example; warnings.txt doubles as a regression test for
 * the wording of every warning (T6.7, T6.8, T6.11). The brief's own example
 * is asserted above and in report.test.ts.
 */
describe("the shipped examples (T7e)", () => {
  function example(name: string): Promise<Run> {
    return run([join(EXAMPLES, name)]);
  }

  it("resolves names declared after the lines that use them", async () => {
    expect(await example("late-declarations.txt")).toEqual({
      code: 0,
      out: "ACME: Molly (2)\nGlobex: Chris (1)\n",
      err: "",
    });
  });

  it("breaks a tie alphabetically, notes it, and sorts by code unit", async () => {
    expect(await example("ties.txt")).toEqual({
      code: 0,
      out: "Zebra: Al (1)\nacme: Bo (2)\n",
      err: "herbie-lite: Zebra is a tie between Al and Bo (1 contact each); Al is shown because it comes first alphabetically\n",
    });
  });

  it("answers both queries, and notes the tie only in the report", async () => {
    const file = join(EXAMPLES, "queries.txt");
    expect(await run([file])).toEqual({
      code: 0,
      out: "Globex: Chris (3)\nHooli: Molly (1)\nInitech: No current relationship\n",
      err: "herbie-lite: Hooli is a tie between Molly and Rezzan (1 contact each); Molly is shown because it comes first alphabetically\n",
    });
    expect(await run(["--partners", "Globex", file])).toEqual({
      code: 0,
      out: "Globex: Chris (3), Molly (2), Rezzan (1)\n",
      err: "",
    });
    expect(await run(["--employees", "Globex", file])).toEqual({
      code: 0,
      out: "Jamie: Chris (1), Molly (1), Rezzan (1)\nLaurie: Chris (2), Molly (1)\nSam: No contacts\n",
      err: "",
    });
    expect(await run(["--partners", "Hooli", file])).toEqual({
      code: 0,
      out: "Hooli: Molly (1), Rezzan (1)\n",
      err: "",
    });
  });

  it("keeps people and companies apart, and counts a repeated contact", async () => {
    expect(await example("names-and-repeats.txt")).toEqual({
      code: 0,
      out: "Contact: Dell (2)\nDell: No current relationship\nHooli: No current relationship\n",
      err: "",
    });
  });

  it("warns once per bad line and still prints the report", async () => {
    const warnings = [
      "line 6: unknown command; expected one of Partner, Company, Employee, Contact; discarded: # A comment is not a command",
      "line 7: unknown command; expected one of Partner, Company, Employee, Contact; discarded: partner Rezzan",
      'line 8: wrong number of words; expected "Company <Name>"; discarded: Company Drive Capital',
      'line 9: names must be letters only; expected "Partner <Name>"; discarded: Partner Jean-Luc',
      'line 10: names must be letters only; expected "Partner <Name>"; discarded: Partner Chris\\u00a0Smith',
      'line 11: contact type must be one of email, call, coffee; expected "Contact <EmployeeName> <PartnerName> <ContactType>"; discarded: Contact Laurie Chris text',
      "line 13: repeats the declaration on line 1; discarded: Company Globex",
      'line 14: Laurie is already declared on line 2 as "Employee Laurie Globex"; discarded: Partner Laurie',
      "line 15: no company named Hooli was declared; discarded: Employee Sam Hooli",
      "line 16: no employee named Nobody was declared; discarded: Contact Nobody Chris call",
      "line 17: no partner named Zoe was declared; discarded: Contact Laurie Zoe email",
      "line 18: Chris is declared as a partner, not an employee, and Laurie is declared as an employee, not a partner; discarded: Contact Chris Laurie email",
    ];
    expect(await example("warnings.txt")).toEqual({
      code: 0,
      out: "Globex: Chris (2)\n",
      err: warnings.map((warning) => `herbie-lite: ${warning}\n`).join(""),
    });
  });
});

/**
 * T6e: the program as a reviewer runs it, through bin.ts. It runs the source
 * with tsx rather than the built dist/, so `npm test` needs no build step
 * (T1.3); the clean-clone check (T8d) covers the built artifact.
 */
describe("the program as a process (brief 3, PLAN §7)", () => {
  function herbie(args: readonly string[], stdin?: string): Promise<Run> {
    const child = spawn(
      join(ROOT, "node_modules", ".bin", "tsx"),
      [join("src", "bin.ts"), ...args],
      { cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] },
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk: Buffer) => (out += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (err += chunk.toString()));
    child.stdin.end(stdin ?? "");
    return new Promise((resolve, reject) => {
      child.on("error", reject);
      // A child killed by a signal has no exit code; reading that as 0
      // would pass a crash as a success.
      child.on("close", (code, signal) => {
        if (code === null) reject(new Error(`killed by ${String(signal)}`));
        else resolve({ code, out, err });
      });
    });
  }

  it("prints the brief's output for a file argument", async () => {
    expect(await herbie([join("examples", "input.txt")])).toEqual({
      code: 0,
      out: EXPECTED,
      err: "",
    });
  }, 30_000);

  it("prints the brief's output for piped input", async () => {
    expect(await herbie([], readFileSync(INPUT, "utf8"))).toEqual({
      code: 0,
      out: EXPECTED,
      err: "",
    });
  }, 30_000);
});
