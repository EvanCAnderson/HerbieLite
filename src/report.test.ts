import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildNetwork } from "./network.js";
import type { Network } from "./network.js";
import { parseLine } from "./parser.js";
import { buildReport, type Report } from "./report.js";

/**
 * Builds a network from the text of an input file, so each case reads as the
 * input a user would write (the pattern T4.3 set for the network tests).
 * Malformed and blank lines are dropped here exactly as the cli will drop
 * them (Q7, T6c).
 */
function analyse(file: string): Report {
  const commands = file
    .split("\n")
    .map((text, index) => parseLine({ lineNumber: index + 1, text }))
    .filter((line) => line.outcome === "command");
  return buildReport(buildNetwork(commands).network);
}

function report(file: string): readonly string[] {
  return analyse(file).lines;
}

describe("relationship strength (FR5)", () => {
  it("counts every contact as 1, whatever its type", () => {
    expect(
      report(`Partner Chris
Company Globex
Employee Laurie Globex
Contact Laurie Chris email
Contact Laurie Chris call
Contact Laurie Chris coffee`),
    ).toEqual(["Globex: Chris (3)"]);
  });

  it("counts a repeated Contact line again (Q13)", () => {
    expect(
      report(`Partner Chris
Company Globex
Employee Laurie Globex
Contact Laurie Chris email
Contact Laurie Chris email`),
    ).toEqual(["Globex: Chris (2)"]);
  });

  it("sums a partner's contacts across all employees of the company", () => {
    expect(
      report(`Partner Chris
Company Globex
Employee Laurie Globex
Employee Jamie Globex
Contact Laurie Chris email
Contact Jamie Chris call`),
    ).toEqual(["Globex: Chris (2)"]);
  });

  it("keeps a partner's companies separate", () => {
    expect(
      report(`Partner Chris
Company Globex
Company Hooli
Employee Laurie Globex
Employee Abdi Hooli
Contact Laurie Chris email
Contact Laurie Chris call
Contact Abdi Chris coffee`),
    ).toEqual(["Globex: Chris (2)", "Hooli: Chris (1)"]);
  });

  it("names the strongest partner, not the first or the last", () => {
    expect(
      report(`Partner Ada
Partner Bo
Partner Cy
Company Globex
Employee Laurie Globex
Contact Laurie Ada email
Contact Laurie Bo email
Contact Laurie Bo call
Contact Laurie Cy coffee`),
    ).toEqual(["Globex: Bo (2)"]);
  });
});

describe("companies with no relationship (Q2)", () => {
  it("reports a company with no employees", () => {
    expect(report("Company ACME")).toEqual(["ACME: No current relationship"]);
  });

  it("reports a company whose employees have no contacts", () => {
    expect(
      report(`Company ACME
Employee Sarah ACME`),
    ).toEqual(["ACME: No current relationship"]);
  });

  it("does not credit a company with another company's contacts", () => {
    expect(
      report(`Partner Chris
Company ACME
Company Globex
Employee Laurie Globex
Contact Laurie Chris email`),
    ).toEqual(["ACME: No current relationship", "Globex: Chris (1)"]);
  });

  it("prints nothing when no company is declared", () => {
    expect(
      report(`Partner Chris
Partner Molly`),
    ).toEqual([]);
  });
});

describe("Drive Capital is never a line (Q3)", () => {
  it("lists only declared companies, never partners", () => {
    expect(
      report(`Partner Chris
Company Globex
Employee Laurie Globex
Contact Laurie Chris email`),
    ).toEqual(["Globex: Chris (1)"]);
  });
});

describe("tie-break between equally strong partners (Q1)", () => {
  it("names the alphabetically first partner, whatever the input order", () => {
    const later = `Partner Molly
Partner Chris
Company Globex
Employee Laurie Globex
Contact Laurie Molly email
Contact Laurie Chris call`;
    const earlier = `Partner Chris
Partner Molly
Company Globex
Employee Laurie Globex
Contact Laurie Chris call
Contact Laurie Molly email`;
    expect(report(later)).toEqual(["Globex: Chris (1)"]);
    expect(report(earlier)).toEqual(["Globex: Chris (1)"]);
  });

  it("breaks a tie by code unit, so an uppercase name wins (Q14)", () => {
    expect(
      report(`Partner alice
Partner Bob
Company Globex
Employee Laurie Globex
Contact Laurie alice email
Contact Laurie Bob call`),
    ).toEqual(["Globex: Bob (1)"]);
  });
});

describe("ties (Q21)", () => {
  it("lists the tied partners in the order Q1 ranks them", () => {
    expect(
      analyse(`Partner Molly
Partner Chris
Company Globex
Employee Laurie Globex
Contact Laurie Molly email
Contact Laurie Chris call`).ties,
    ).toEqual([
      { company: "Globex", partners: ["Chris", "Molly"], strength: 1 },
    ]);
  });

  it("names the first tied partner on the line", () => {
    const { lines, ties } = analyse(`Partner Cy
Partner Bo
Partner Ada
Company Globex
Employee Laurie Globex
Contact Laurie Cy email
Contact Laurie Bo call
Contact Laurie Ada coffee`);
    expect(lines).toEqual(["Globex: Ada (1)"]);
    expect(ties).toEqual([
      { company: "Globex", partners: ["Ada", "Bo", "Cy"], strength: 1 },
    ]);
  });

  it("ignores a tie below the strongest partner", () => {
    expect(
      analyse(`Partner Ada
Partner Bo
Partner Cy
Company Globex
Employee Laurie Globex
Contact Laurie Ada email
Contact Laurie Ada call
Contact Laurie Bo email
Contact Laurie Cy email`).ties,
    ).toEqual([]);
  });

  it("finds no tie where there is no relationship (Q2)", () => {
    expect(analyse("Company Globex").ties).toEqual([]);
  });

  it("lists ties in the report's company order (Q14)", () => {
    expect(
      analyse(`Partner Al
Partner Bo
Company acme
Company Zebra
Employee Ida acme
Employee Ada Zebra
Contact Ida Al email
Contact Ida Bo email
Contact Ada Al email
Contact Ada Bo email`).ties.map((tie) => tie.company),
    ).toEqual(["Zebra", "acme"]);
  });
});

describe("company order (Q14)", () => {
  it("sorts alphabetically, not by declaration order", () => {
    expect(
      report(`Company Hooli
Company ACME
Company Globex`),
    ).toEqual([
      "ACME: No current relationship",
      "Globex: No current relationship",
      "Hooli: No current relationship",
    ]);
  });

  it("puts every uppercase letter before every lowercase one", () => {
    expect(
      report(`Company acme
Company Zebra
Company ACME`),
    ).toEqual([
      "ACME: No current relationship",
      "Zebra: No current relationship",
      "acme: No current relationship",
    ]);
  });
});

describe("a network that breaks its own invariants", () => {
  it("throws rather than silently dropping a contact", () => {
    const broken: Network = {
      partners: new Set(["Chris"]),
      companies: new Set(["Globex"]),
      employers: new Map(),
      contacts: [
        { employee: "Laurie", partner: "Chris", contactType: "email" },
      ],
    };
    expect(() => buildReport(broken)).toThrowError(/Laurie/);
  });
});

describe("the brief's example (PLAN §7)", () => {
  it("produces the expected output from the shipped examples/input.txt", () => {
    const file = readFileSync(
      join(import.meta.dirname, "..", "examples", "input.txt"),
      "utf8",
    );
    expect(report(file)).toEqual([
      "ACME: No current relationship",
      "Globex: Chris (2)",
      "Hooli: Molly (1)",
    ]);
  });
});
