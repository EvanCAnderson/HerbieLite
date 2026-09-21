import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Readable, Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { main } from "./cli.js";
import { HELP } from "./help.js";

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
      "herbie-lite: expected at most one file argument, got 2; usage: node dist/bin.js [--help | file]\n",
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
      err: 'herbie-lite: unknown option "--verbose"; usage: node dist/bin.js [--help | file]\n',
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

  it("prints malformed lines as they are read, before resolution warnings", async () => {
    // The price of answering typed input immediately (Q7, T1.10): stderr is
    // in two passes, not one run of input order (T6.7).
    const { err } = await run(
      [],
      `Partner Molly
Partner Molly
Compny Globex
`,
    );
    expect(err.split("\n").filter((line) => line !== "")).toEqual([
      "herbie-lite: line 3: unknown command; expected one of Partner, Company, Employee, Contact; discarded: Compny Globex",
      "herbie-lite: line 2: repeats the declaration on line 1; discarded: Partner Molly",
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

describe("interactive entry (T1.10, T6.13)", () => {
  it("prints no hint or banner, whatever STDIN is", async () => {
    // Typed input is STDIN with no file argument, and the base adds nothing
    // to stderr for it; an opening explanation is UPGRADES U6.
    const typed = Object.assign(Readable.from(["Company ACME\n"]), {
      isTTY: true,
    });
    const out = sink();
    const err = sink();
    const code = await main([], typed, out, err);
    expect({ code, out: out.text(), err: err.text() }).toEqual({
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

  it("lets any other throw from inside the read loop propagate", async () => {
    // reportLines already crashes on a broken invariant (T5.2); this holds
    // the other half, that the try around the loop catches only ReadError
    // and never dresses a bug up as a problem with the user's file.
    const boom = new Error("bug in a layer below");
    const exploding = Object.assign(new Writable({ write: () => undefined }), {
      write: () => {
        throw boom;
      },
    }) as unknown as NodeJS.WritableStream;
    await expect(
      main([], Readable.from(["not a command\n"]), sink(), exploding),
    ).rejects.toBe(boom);
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

  it("breaks a tie alphabetically and sorts by code unit", async () => {
    expect(await example("ties.txt")).toEqual({
      code: 0,
      out: "Zebra: Al (1)\nacme: Bo (2)\n",
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
      child.on("close", (code) => {
        resolve({ code: code ?? 0, out, err });
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
