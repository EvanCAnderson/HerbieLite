import { describe, expect, expectTypeOf, it } from "vitest";
import { buildNetwork } from "./network.js";
import type { Declaration, NetworkResult, NetworkWarning } from "./network.js";
import { parseLine } from "./parser.js";

/**
 * Builds a network from the text of an input file, so each case reads as the
 * input a user would write and line numbers in assertions are the lines you
 * can count. Malformed and blank lines are the parser's business (Q7) and are
 * dropped here, exactly as the cli will drop them (T6c).
 */
function build(file: string): NetworkResult {
  const commands = file
    .split("\n")
    .map((text, index) => parseLine({ lineNumber: index + 1, text }))
    .filter((line) => line.outcome === "command");
  return buildNetwork(commands);
}

/** The lines warned about, in the order the warnings came back. */
function warnedLines(result: NetworkResult): number[] {
  return result.warnings.map((warning) => warning.source.lineNumber);
}

describe("Declaration", () => {
  it("is every command except Contact, which may repeat (Q13)", () => {
    expectTypeOf<Declaration["kind"]>().toEqualTypeOf<
      "Partner" | "Company" | "Employee"
    >();
  });
});

describe("NetworkWarning", () => {
  // Compile-time check (Q13): a Contact line is never a duplicate declaration.
  it("rejects a Contact as a duplicate declaration", () => {
    const source = { lineNumber: 2, text: "Partner Chris" };
    const standing = {
      source: { lineNumber: 1, text: "Partner Chris" },
      command: { kind: "Partner", name: "Chris" },
    } as const;

    const repeat: NetworkWarning = {
      problem: "duplicate-declaration",
      source,
      command: { kind: "Partner", name: "Chris" },
      standing,
    };

    const contact: NetworkWarning = {
      problem: "duplicate-declaration",
      source,
      command: {
        // @ts-expect-error -- contacts are counted, never deduplicated.
        kind: "Contact",
        employee: "Laurie",
        partner: "Chris",
        contactType: "email",
      },
      standing,
    };

    expect([repeat, contact]).toHaveLength(2);
  });

  // Compile-time check (Q8): an unresolved contact names at least one slot.
  it("requires at least one failure for an unresolved contact", () => {
    const source = { lineNumber: 5, text: "Contact Chris Laurie email" };

    const swapped: NetworkWarning = {
      problem: "unresolved-contact",
      source,
      failures: [
        { role: "employee", name: "Chris", cause: "wrong-role" },
        { role: "partner", name: "Laurie", cause: "wrong-role" },
      ],
    };

    const empty: NetworkWarning = {
      problem: "unresolved-contact",
      source,
      // @ts-expect-error -- an empty list would warn about nothing.
      failures: [],
    };

    expect([swapped, empty]).toHaveLength(2);
  });
});

// T4a: companies are applied as they arrive.
describe("buildNetwork: companies (T4a)", () => {
  it("declares each company once", () => {
    const { network, warnings } = build(`Company ACME
Company Hooli`);

    expect([...network.companies]).toEqual(["ACME", "Hooli"]);
    expect(warnings).toEqual([]);
  });

  it("discards a repeated company, naming the one that stands (Q13)", () => {
    const { network, warnings } = build(`Company ACME
Company ACME`);

    expect([...network.companies]).toEqual(["ACME"]);
    expect(warnings).toEqual([
      {
        problem: "duplicate-declaration",
        source: { lineNumber: 2, text: "Company ACME" },
        command: { kind: "Company", name: "ACME" },
        standing: {
          source: { lineNumber: 1, text: "Company ACME" },
          command: { kind: "Company", name: "ACME" },
        },
      },
    ]);
  });

  it("lets a company and a person share a name (Q12)", () => {
    const { network, warnings } = build(`Partner Chris
Company Chris`);

    expect([...network.partners]).toEqual(["Chris"]);
    expect([...network.companies]).toEqual(["Chris"]);
    expect(warnings).toEqual([]);
  });
});

// T4b, T4d: partners and employees are held, then resolved together.
describe("buildNetwork: people (T4b, T4d)", () => {
  it("resolves an employee declared before their company (Q5)", () => {
    const { network, warnings } = build(`Employee Laurie ACME
Company ACME`);

    expect([...network.employers]).toEqual([["Laurie", "ACME"]]);
    expect(warnings).toEqual([]);
  });

  it("discards an employee whose company is never declared (Q5)", () => {
    const { network, warnings } = build(`Employee Laurie Nowhere`);

    expect([...network.employers]).toEqual([]);
    expect(warnings).toEqual([
      {
        problem: "unknown-company",
        source: { lineNumber: 1, text: "Employee Laurie Nowhere" },
        company: "Nowhere",
      },
    ]);
  });

  // Q12: companies are their own namespace, so a partner named Dell is not
  // evidence that a company Dell exists; the line is undeclared, not a role
  // mix-up (T4.4).
  it("does not let a person's name serve as a company (Q12)", () => {
    const { network, warnings } = build(`Partner Dell
Employee Laurie Dell`);

    expect([...network.partners]).toEqual(["Dell"]);
    expect([...network.employers]).toEqual([]);
    expect(warnings).toEqual([
      {
        problem: "unknown-company",
        source: { lineNumber: 2, text: "Employee Laurie Dell" },
        company: "Dell",
      },
    ]);
  });

  it("keeps the first of two declarations of one name (Q12, Q13)", () => {
    const { network, warnings } = build(`Company ACME
Company Hooli
Employee Sam ACME
Employee Sam Hooli
Partner Sam`);

    expect([...network.employers]).toEqual([["Sam", "ACME"]]);
    expect([...network.partners]).toEqual([]);
    expect(warnedLines({ network, warnings })).toEqual([4, 5]);
    expect(warnings.map((warning) => warning.problem)).toEqual([
      "duplicate-declaration",
      "duplicate-declaration",
    ]);
  });

  it("warns a repeated partner, exact repeat included (Q13)", () => {
    const { network, warnings } = build(`Partner Chris
Partner Chris`);

    expect([...network.partners]).toEqual(["Chris"]);
    expect(warnedLines({ network, warnings })).toEqual([2]);
  });

  // Q5, fourth bullet: "first valid declaration" is judged after resolution.
  it("lets a later valid name claim beat a discarded earlier one", () => {
    const { network, warnings } = build(`Employee Sam Nowhere
Partner Sam`);

    expect([...network.partners]).toEqual(["Sam"]);
    expect([...network.employers]).toEqual([]);
    expect(warnings.map((warning) => warning.problem)).toEqual([
      "unknown-company",
    ]);
  });
});

// T4c, T4d: contacts are held, then resolved against the declared names.
describe("buildNetwork: contacts (T4c, T4d)", () => {
  it("resolves contacts whatever the declaration order (Q8)", () => {
    const { network, warnings } = build(`Contact Laurie Chris email
Company ACME
Employee Laurie ACME
Partner Chris`);

    expect(network.contacts).toEqual([
      { employee: "Laurie", partner: "Chris", contactType: "email" },
    ]);
    expect(warnings).toEqual([]);
  });

  it("counts every contact line, exact repeats included (Q13)", () => {
    const { network } = build(`Company ACME
Partner Chris
Employee Laurie ACME
Contact Laurie Chris email
Contact Laurie Chris email
Contact Laurie Chris coffee`);

    expect(network.contacts).toEqual([
      { employee: "Laurie", partner: "Chris", contactType: "email" },
      { employee: "Laurie", partner: "Chris", contactType: "email" },
      { employee: "Laurie", partner: "Chris", contactType: "coffee" },
    ]);
  });

  it("reports a swapped contact as two wrong roles, not two unknowns (Q12)", () => {
    const { network, warnings } = build(`Company ACME
Partner Chris
Employee Laurie ACME
Contact Chris Laurie email`);

    expect(network.contacts).toEqual([]);
    expect(warnings).toEqual([
      {
        problem: "unresolved-contact",
        source: { lineNumber: 4, text: "Contact Chris Laurie email" },
        failures: [
          { role: "employee", name: "Chris", cause: "wrong-role" },
          { role: "partner", name: "Laurie", cause: "wrong-role" },
        ],
      },
    ]);
  });

  // Q12: the mirror of the company case — a name declared only as a company
  // is not a person, so the slot is undeclared rather than a wrong role.
  it("does not let a company's name fill a person slot (Q12)", () => {
    const { network, warnings } = build(`Company Chris
Company ACME
Employee Laurie ACME
Contact Laurie Chris email`);

    expect(network.contacts).toEqual([]);
    expect(warnings).toEqual([
      {
        problem: "unresolved-contact",
        source: { lineNumber: 4, text: "Contact Laurie Chris email" },
        failures: [{ role: "partner", name: "Chris", cause: "undeclared" }],
      },
    ]);
  });

  it("names only the slot that failed (Q8)", () => {
    const { warnings } = build(`Partner Chris
Contact Laurie Chris email`);

    expect(warnings).toEqual([
      {
        problem: "unresolved-contact",
        source: { lineNumber: 2, text: "Contact Laurie Chris email" },
        failures: [{ role: "employee", name: "Laurie", cause: "undeclared" }],
      },
    ]);
  });

  // Q8: a name whose declaration was discarded counts as undeclared; the
  // discarded declaration carries its own warning.
  it("treats a discarded employee as undeclared", () => {
    const { network, warnings } = build(`Partner Chris
Employee Laurie Nowhere
Contact Laurie Chris email`);

    expect(network.contacts).toEqual([]);
    expect(warnings.map((warning) => warning.problem)).toEqual([
      "unknown-company",
      "unresolved-contact",
    ]);
  });
});

describe("buildNetwork: warning order (T4d)", () => {
  it("returns warnings from every pass in input order", () => {
    const result = build(`Company ACME
Company ACME
Partner Chris
Employee Laurie Nowhere
Contact Laurie Chris email
Employee Chris ACME`);

    expect(warnedLines(result)).toEqual([2, 4, 5, 6]);
    expect(result.warnings.map((warning) => warning.problem)).toEqual([
      "duplicate-declaration",
      "unknown-company",
      "unresolved-contact",
      "duplicate-declaration",
    ]);
  });
});
