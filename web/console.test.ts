import { describe, expect, it } from "vitest";
import {
  commandLine,
  companiesIn,
  pathOf,
  output,
  UNSAVED_NOTE,
} from "./console.js";
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

describe("the command a query is run with (T11c)", () => {
  it("puts the option and company before the file", () => {
    expect(
      commandLine(input, { option: "--partners", company: "Globex" }),
    ).toBe("node dist/bin.js --partners Globex examples/input.txt");
  });

  it("quotes a company that is not letters only, so it stays one word", () => {
    expect(
      commandLine(input, { option: "--employees", company: "Big Co" }),
    ).toBe("node dist/bin.js --employees 'Big Co' examples/input.txt");
  });
});

describe("the companies a file declares", () => {
  it("lists them in code-unit order, ignoring bad lines", async () => {
    expect(await companiesIn(input.text)).toEqual(["ACME", "Globex", "Hooli"]);
    expect(
      await companiesIn("Company zeta\nCompany Beta\ncompany Nope\n"),
    ).toEqual(["Beta", "zeta"]);
  });
});

describe("what the pane shows (Q27)", () => {
  it("shows stderr in its colour, stdout, notes, then the exit code", () => {
    expect(
      output({
        stderr: ["warning"],
        stdout: "ACME: No current relationship\n",
        notes: ["note"],
        code: 0,
      }),
    ).toBe(
      "\u001b[33mwarning\u001b[0m\n" +
        "ACME: No current relationship\n" +
        "\u001b[33mnote\u001b[0m\n" +
        "\u001b[2mexit 0\u001b[0m\n\n",
    );
  });

  it("shows a run with no output as its exit code alone", () => {
    expect(output({ stderr: [], stdout: "", notes: [], code: 1 })).toBe(
      "\u001b[2mexit 1\u001b[0m\n\n",
    );
  });

  it("dims the note for the editor's unsaved text (T10g)", () => {
    expect(UNSAVED_NOTE).toBe(
      "\u001b[2m(the editor's text, with unsaved changes)\u001b[0m",
    );
  });
});
