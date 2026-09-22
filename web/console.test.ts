import { describe, expect, it } from "vitest";
import { commandLine, pathOf, runFile, transcript } from "./console.js";
import { EXAMPLES } from "./examples.js";

const input = {
  source: "example",
  name: "input.txt",
  text: EXAMPLES.get("input.txt") ?? "",
} as const;

describe("the command a file is run with (Q28)", () => {
  it("names an example where it sits in the repository", () => {
    expect(pathOf(input)).toBe("examples/input.txt");
    expect(commandLine(input)).toBe("node dist/bin.js examples/input.txt");
  });

  it("names a workspace file as it is saved when downloaded", () => {
    expect(pathOf({ source: "workspace", name: "draft.txt", text: "" })).toBe(
      "draft.txt",
    );
  });
});

describe("running a file in the page (Q28)", () => {
  it("prints the brief's report for examples/input.txt (PLAN §7)", async () => {
    expect(await runFile(input)).toEqual({
      stderr: [],
      stdout:
        "ACME: No current relationship\nGlobex: Chris (2)\nHooli: Molly (1)\n",
      notes: [],
      code: 0,
    });
  });

  it("warns about a bad line and still prints the report (Q7)", async () => {
    const result = await runFile({
      source: "workspace",
      name: "draft.txt",
      text: "Company ACME\nPartner chris9\n",
    });
    expect(result.stderr).toEqual([
      'herbie-lite: line 2: names must be letters only; expected "Partner <Name>"; discarded: Partner chris9',
    ]);
    expect(result.stdout).toBe("ACME: No current relationship\n");
    expect(result.code).toBe(0);
  });

  it("splits lines as the CLI's reader does, byte-order mark and all (Q16)", async () => {
    const result = await runFile({
      source: "workspace",
      name: "bom.txt",
      text: "﻿Company ACME\r\nCompany Hooli",
    });
    expect(result.stderr).toEqual([]);
    expect(result.stdout).toBe(
      "ACME: No current relationship\nHooli: No current relationship\n",
    );
  });

  it("returns a tie's note separately, to follow the report (Q21)", async () => {
    const result = await runFile({
      source: "example",
      name: "ties.txt",
      text: EXAMPLES.get("ties.txt") ?? "",
    });
    expect(result.notes.length).toBeGreaterThan(0);
    expect(result.notes[0]).toMatch(/^herbie-lite: \w+ is a tie between /);
  });
});

describe("what the pane shows (Q27)", () => {
  it("shows the command, stderr in its colour, stdout, notes, then the exit code", () => {
    const shown = transcript("node dist/bin.js a.txt", {
      stderr: ["warning"],
      stdout: "ACME: No current relationship\n",
      notes: ["note"],
      code: 0,
    });
    expect(shown).toBe(
      "\u001b[1m$ node dist/bin.js a.txt\u001b[0m\n" +
        "\u001b[33mwarning\u001b[0m\n" +
        "ACME: No current relationship\n" +
        "\u001b[33mnote\u001b[0m\n" +
        "\u001b[2mexit 0\u001b[0m\n\n",
    );
  });

  it("notes when the text run is the editor's, not the saved file (T10g)", () => {
    const shown = transcript(
      "node dist/bin.js a.txt",
      { stderr: [], stdout: "", notes: [], code: 0 },
      true,
    );
    expect(shown.split("\n")[1]).toBe(
      "\u001b[2m(the editor's text, with unsaved changes)\u001b[0m",
    );
  });

  it("shows a run with no output as the command and its exit code", () => {
    expect(
      transcript("node dist/bin.js a.txt", {
        stderr: [],
        stdout: "",
        notes: [],
        code: 0,
      }),
    ).toBe(
      "\u001b[1m$ node dist/bin.js a.txt\u001b[0m\n\u001b[2mexit 0\u001b[0m\n\n",
    );
  });
});
