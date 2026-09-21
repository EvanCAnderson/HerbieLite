import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { commandSyntax, HELP, USAGE } from "./help.js";
import { COMMAND_SYNTAX, CONTACT_TYPES, type CommandKind } from "./parser.js";

const README = readFileSync(
  join(import.meta.dirname, "..", "README.md"),
  "utf8",
);

describe("the help text (Q18, Q19)", () => {
  it("reads exactly as the user sees it", () => {
    expect(HELP).toBe(
      [
        "Welcome to herbie-lite!",
        "",
        "Usage: node dist/bin.js [--help | file]",
        "",
        "Reads commands from the file, or from standard input when no file is",
        "given, and prints each company's strongest partner. Commands typed at a",
        "terminal are standard input too: press Ctrl+D to finish.",
        "",
        "From source, put -- before the arguments, or npm keeps them for itself:",
        "  npm start -- [file]",
        "  npm start -- --help",
        "",
        "Commands, one per line:",
        "  Partner <Name>",
        "      A partner: an employee of Drive Capital.",
        "  Company <Name>",
        "      A company other than Drive Capital.",
        "  Employee <Name> <CompanyName>",
        "      An employee of a company. Each name belongs to one person.",
        "  Contact <EmployeeName> <PartnerName> <ContactType>",
        "      One interaction between an employee and a partner. Each counts 1",
        "      toward that partner's relationship with the employee's company.",
        "",
        "<ContactType> is one of: email, call, coffee.",
        "Names are letters only, A-Z and a-z.",
        "",
      ].join("\n"),
    );
  });

  it("shows every command in the grammar, in its parsed shape", () => {
    for (const kind of Object.keys(COMMAND_SYNTAX) as CommandKind[]) {
      expect(HELP).toContain(`  ${commandSyntax(kind)}\n`);
    }
  });

  it("lists every contact type the parser accepts", () => {
    for (const type of CONTACT_TYPES) expect(HELP).toContain(type);
  });
});

describe("the usage line and the README agree (Q18)", () => {
  it("quotes the usage line verbatim in the README", () => {
    expect(README).toContain(USAGE);
  });
});
