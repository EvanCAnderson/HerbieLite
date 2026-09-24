import { describe, expect, it } from "vitest";
import { buildNetwork } from "./network.js";
import { parseLine } from "./parser.js";
import {
  malformedWarning,
  missingCompany,
  networkWarning,
  tieNote,
  tooManyQueries,
  unknownCompany,
} from "./warnings.js";

/** Cases read as the input file a user would write (the T4.3 pattern). */
function parse(file: string): ReturnType<typeof parseLine>[] {
  return file
    .split("\n")
    .map((text, index) => parseLine({ lineNumber: index + 1, text }));
}

function parserWarnings(file: string): string[] {
  return parse(file)
    .filter((line) => line.outcome === "malformed")
    .map(malformedWarning);
}

function resolutionWarnings(file: string): string[] {
  const commands = parse(file).filter((line) => line.outcome === "command");
  return buildNetwork(commands).warnings.map(networkWarning);
}

describe("malformed lines (Q7)", () => {
  it("lists every command when the keyword is unknown", () => {
    expect(parserWarnings("partner Chris")).toEqual([
      "herbie-lite: line 1: unknown command; expected one of Partner, Company, Employee, Contact; discarded: partner Chris",
    ]);
  });

  it("quotes the command's format when the word count is wrong", () => {
    expect(parserWarnings("Employee Laurie")).toEqual([
      'herbie-lite: line 1: wrong number of words; expected "Employee <Name> <CompanyName>"; discarded: Employee Laurie',
    ]);
  });

  it("names the letters-only rule for a bad name (Q9)", () => {
    expect(parserWarnings("Partner Ch4is")).toEqual([
      'herbie-lite: line 1: names must be letters only; expected "Partner <Name>"; discarded: Partner Ch4is',
    ]);
  });

  it("lists the contact types for a bad one (FR1)", () => {
    expect(parserWarnings("Contact Laurie Chris text")).toEqual([
      'herbie-lite: line 1: contact type must be one of email, call, coffee; expected "Contact <EmployeeName> <PartnerName> <ContactType>"; discarded: Contact Laurie Chris text',
    ]);
  });

  it("quotes the line as written, showing a tab it cannot otherwise show (Q10, T6.11)", () => {
    expect(parserWarnings("  partner\tChris  ")).toEqual([
      "herbie-lite: line 1: unknown command; expected one of Partner, Company, Employee, Contact; discarded:   partner\\tChris  ",
    ]);
  });

  it("warns per line, and says nothing about a blank one (Q6)", () => {
    expect(parserWarnings("partner Chris\n\nCompny Globex")).toEqual([
      "herbie-lite: line 1: unknown command; expected one of Partner, Company, Employee, Contact; discarded: partner Chris",
      "herbie-lite: line 3: unknown command; expected one of Partner, Company, Employee, Contact; discarded: Compny Globex",
    ]);
  });
});

describe("repeated declarations (Q13)", () => {
  it("calls an identical line a repeat", () => {
    expect(resolutionWarnings("Partner Molly\nPartner Molly")).toEqual([
      "herbie-lite: line 2: repeats the declaration on line 1; discarded: Partner Molly",
    ]);
  });

  it("calls a repeated company a repeat too", () => {
    expect(resolutionWarnings("Company Globex\nCompany Globex")).toEqual([
      "herbie-lite: line 2: repeats the declaration on line 1; discarded: Company Globex",
    ]);
  });

  it("quotes the standing declaration when the name is claimed twice (Q12)", () => {
    expect(
      resolutionWarnings(
        "Company Globex\nEmployee Laurie Globex\nPartner Laurie",
      ),
    ).toEqual([
      'herbie-lite: line 3: Laurie is already declared on line 2 as "Employee Laurie Globex"; discarded: Partner Laurie',
    ]);
  });

  it("treats the same employee at another company as a claim, not a repeat", () => {
    expect(
      resolutionWarnings(
        "Company Globex\nCompany Hooli\nEmployee Sam Globex\nEmployee Sam Hooli",
      ),
    ).toEqual([
      'herbie-lite: line 4: Sam is already declared on line 3 as "Employee Sam Globex"; discarded: Employee Sam Hooli',
    ]);
  });
});

describe("an employee's company (Q5)", () => {
  it("names the company that was never declared", () => {
    expect(resolutionWarnings("Employee Laurie Globex")).toEqual([
      "herbie-lite: line 1: no company named Globex was declared; discarded: Employee Laurie Globex",
    ]);
  });
});

describe("unresolved contacts (Q8, Q12)", () => {
  const declared = "Partner Molly\nCompany Globex\nEmployee Laurie Globex\n";

  it("names an undeclared employee", () => {
    expect(resolutionWarnings(`${declared}Contact Nobody Molly call`)).toEqual([
      "herbie-lite: line 4: no employee named Nobody was declared; discarded: Contact Nobody Molly call",
    ]);
  });

  it("names an undeclared partner", () => {
    expect(resolutionWarnings(`${declared}Contact Laurie Chris call`)).toEqual([
      "herbie-lite: line 4: no partner named Chris was declared; discarded: Contact Laurie Chris call",
    ]);
  });

  it("says which way round a swapped line is, rather than calling both unknown", () => {
    expect(resolutionWarnings(`${declared}Contact Molly Laurie call`)).toEqual([
      "herbie-lite: line 4: Molly is declared as a partner, not an employee, and Laurie is declared as an employee, not a partner; discarded: Contact Molly Laurie call",
    ]);
  });

  it("reports both slots when one is unknown and the other misplaced", () => {
    expect(resolutionWarnings(`${declared}Contact Molly Nobody call`)).toEqual([
      "herbie-lite: line 4: Molly is declared as a partner, not an employee, and no partner named Nobody was declared; discarded: Contact Molly Nobody call",
    ]);
  });
});

describe("quoting input back (T6.11)", () => {
  it("leaves an ordinary line untouched", () => {
    expect(parserWarnings("Compny Globex")[0]).toContain(
      "discarded: Compny Globex",
    );
  });

  it("shows the invisible character that broke a line (T3.4, U3)", () => {
    // The case T3.4 recorded as a known tradeoff: without escaping, the
    // quoted line looks perfectly valid and the warning cannot say why.
    expect(parserWarnings("Partner Chris\u00a0")[0]).toContain(
      "discarded: Partner Chris\\u00a0",
    );
  });

  it("escapes a carriage return, so a CRLF line cannot rewrite the message", () => {
    expect(parserWarnings("Compny Globex\r")[0]?.endsWith("Globex\\r")).toBe(
      true,
    );
  });

  it("escapes a terminal escape sequence", () => {
    expect(parserWarnings("Partner Chris\u001b[2J")[0]).toContain(
      "Partner Chris\\u001b[2J",
    );
  });

  it("escapes a backslash, so an escape is never ambiguous", () => {
    expect(parserWarnings("Partner Chris\\u00a0")[0]).toContain(
      "Partner Chris\\\\u00a0",
    );
  });

  it("leaves visible non-ASCII as typed", () => {
    expect(parserWarnings("Partner Zoë")[0]).toContain(
      "discarded: Partner Zoë",
    );
  });

  it("escapes an astral character by code point", () => {
    expect(parserWarnings("Partner \u{e0041}")[0]).toContain(
      "discarded: Partner \\u{e0041}",
    );
  });

  it("bounds a long line and says how long it was", () => {
    const warning = parserWarnings(`Partner ${"1".repeat(5000)}`)[0] ?? "";
    expect(warning.length).toBeLessThan(400);
    expect(warning.endsWith("... (5008 characters)")).toBe(true);
  });

  it("never cuts an escape in half at the limit", () => {
    const warning = parserWarnings(`Partner ${"\u00a0".repeat(200)}`)[0] ?? "";
    expect(warning).not.toMatch(/\\u[0-9a-f]{0,3}\.\.\./);
  });

  /** The quoted line in a warning, less any "... (N characters)". */
  function quote(warning: string | undefined): string {
    const text = (warning ?? "").split("discarded: ")[1] ?? "";
    return text.replace(/\.\.\. \(\d+ characters\)$/, "");
  }

  it("quotes at most 200 characters, and a line of exactly 200 whole (Q40)", () => {
    const whole = parserWarnings(`Partner ${"1".repeat(192)}`)[0];
    expect(quote(whole)).toHaveLength(200);
    expect(whole).not.toContain("...");
    const cut = parserWarnings(`Partner ${"1".repeat(193)}`)[0];
    expect(quote(cut)).toHaveLength(200);
    expect(cut?.endsWith("... (201 characters)")).toBe(true);
  });

  it("leaves out an escape that would pass the limit (Q40)", () => {
    // 9 characters, then 31 escapes of 6 make 195; a 32nd would make 201.
    const warning = parserWarnings(`Partner x${"\u00a0".repeat(40)}`)[0];
    expect(quote(warning)).toBe(`Partner x${"\\u00a0".repeat(31)}`);
  });

  it("counts characters, not UTF-16 units (Q40)", () => {
    const warning = parserWarnings(`Partner ${"\u{1f600}".repeat(300)}`)[0];
    expect([...quote(warning)]).toHaveLength(200);
    expect(warning?.endsWith("... (308 characters)")).toBe(true);
  });

  it("escapes the standing declaration too, not only the discarded line", () => {
    expect(
      resolutionWarnings(
        "Company Globex\r\nEmployee Laurie Globex\r\nPartner Laurie\r",
      ),
    ).toEqual([
      'herbie-lite: line 3: Laurie is already declared on line 2 as "Employee Laurie Globex\\r"; discarded: Partner Laurie\\r',
    ]);
  });
});

describe("ties (Q21)", () => {
  it("names both partners, the strength, and the one the line shows", () => {
    expect(
      tieNote({ company: "Globex", partners: ["Chris", "Molly"], strength: 2 }),
    ).toBe(
      "herbie-lite: Globex is a tie between Chris and Molly (2 contacts each); Chris is shown because it comes first alphabetically",
    );
  });

  it("lists three or more partners with commas, and says contact for 1", () => {
    expect(
      tieNote({
        company: "Globex",
        partners: ["Ada", "Bo", "Cy"],
        strength: 1,
      }),
    ).toBe(
      "herbie-lite: Globex is a tie between Ada, Bo and Cy (1 contact each); Ada is shown because it comes first alphabetically",
    );
  });
});

describe("queries (Q31, Q33)", () => {
  const usage =
    "usage: node dist/bin.js [--help | [--partners <Company> | --employees <Company>] file]";

  it("names the option that needs a company, with the usage", () => {
    expect(missingCompany("--partners")).toBe(
      `herbie-lite: --partners needs a company name; ${usage}`,
    );
  });

  it("refuses a second query, with the usage", () => {
    expect(tooManyQueries()).toBe(
      `herbie-lite: expected at most one of --partners and --employees; ${usage}`,
    );
  });

  it("quotes and escapes a company never declared (T8.4)", () => {
    expect(unknownCompany("Initech")).toBe(
      'herbie-lite: no company named "Initech" was declared',
    );
    expect(unknownCompany("bad\u001b[31m")).toBe(
      'herbie-lite: no company named "bad\\u001b[31m" was declared',
    );
  });
});
