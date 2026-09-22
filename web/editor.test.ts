import { describe, expect, it } from "vitest";
import { runFile } from "./console.js";
import { checkText, summary } from "./editor.js";
import { EXAMPLES } from "./examples.js";

describe("checking a file as it is edited (Q29)", () => {
  it("marks nothing in the brief's example", async () => {
    expect(await checkText(EXAMPLES.get("input.txt") ?? "")).toEqual([]);
  });

  it("marks a malformed line as discarded, in the warning's words", async () => {
    expect(await checkText("Company ACME\npartner Chris\n")).toEqual([
      {
        lineNumber: 2,
        severity: "discarded",
        message:
          "unknown command; expected one of Partner, Company, Employee, Contact",
      },
    ]);
  });

  it("marks a name not declared yet as pending", async () => {
    expect(await checkText("Employee Laurie Globex\n")).toEqual([
      {
        lineNumber: 1,
        severity: "pending",
        message: "no company named Globex was declared",
      },
    ]);
    expect(
      await checkText("Partner Chris\nContact Laurie Chris email\n"),
    ).toEqual([
      {
        lineNumber: 2,
        severity: "pending",
        message: "no employee named Laurie was declared",
      },
    ]);
  });

  it("clears a pending mark once the name is declared, even later (Q8)", async () => {
    expect(await checkText("Employee Laurie Globex\nCompany Globex\n")).toEqual(
      [],
    );
  });

  it("marks a repeated declaration or a wrong role as discarded (Q12, Q13)", async () => {
    const marks = await checkText(
      "Company ACME\nCompany ACME\nPartner Chris\nEmployee Ida ACME\nContact Chris Ida call\n",
    );
    expect(
      marks.map(({ lineNumber, severity }) => [lineNumber, severity]),
    ).toEqual([
      [2, "discarded"],
      [5, "discarded"],
    ]);
    expect(marks[0]?.message).toBe("repeats the declaration on line 1");
  });

  it("marks exactly the lines the CLI warns about, in its words, for every example", async () => {
    for (const [name, text] of EXAMPLES) {
      const marks = await checkText(text);
      const { stderr } = await runFile({ source: "example", name, text });
      expect(
        marks.map(
          (mark) =>
            `herbie-lite: line ${mark.lineNumber}: ${mark.message}; discarded: `,
        ),
      ).toEqual(
        stderr.map((line) => line.slice(0, line.indexOf("; discarded: ") + 13)),
      );
    }
  });

  it("numbers lines as the CLI's reader does, byte-order mark and CRLF included", async () => {
    expect(await checkText("﻿Company ACME\r\n\r\nPartner 9\r\n")).toEqual([
      {
        lineNumber: 3,
        severity: "discarded",
        message: 'names must be letters only; expected "Partner <Name>"',
      },
    ]);
  });
});

describe("the summary", () => {
  it("counts each kind, or says there is nothing", () => {
    expect(summary([])).toBe("No problems.");
    expect(
      summary([
        { lineNumber: 1, severity: "discarded", message: "" },
        { lineNumber: 2, severity: "discarded", message: "" },
        { lineNumber: 3, severity: "pending", message: "" },
      ]),
    ).toBe("2 discarded, 1 pending.");
    expect(summary([{ lineNumber: 1, severity: "pending", message: "" }])).toBe(
      "1 pending.",
    );
  });
});
