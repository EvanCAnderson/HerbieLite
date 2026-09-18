import { describe, expect, expectTypeOf, it } from "vitest";
import { assertNever } from "./assert-never.js";
import {
  COMMAND_SYNTAX,
  CONTACT_TYPES,
  isContactType,
  type Command,
  type CommandKind,
  type ContactType,
  type MalformedLine,
} from "./parser.js";

describe("contact types", () => {
  it("are exactly the brief's closed set", () => {
    expect(CONTACT_TYPES).toEqual(["email", "call", "coffee"]);
    expectTypeOf<ContactType>().toEqualTypeOf<"email" | "call" | "coffee">();
  });

  it.each(CONTACT_TYPES)("accepts %s", (type) => {
    expect(isContactType(type)).toBe(true);
  });

  it.each(["text", "Email", "EMAIL", ""])("rejects %j", (word) => {
    expect(isContactType(word)).toBe(false);
  });
});

describe("Command", () => {
  // Compile-time check (D3): a switch that misses a kind fails to type-check.
  it("forces switches to handle every kind", () => {
    const describeCommand = (command: Command): string => {
      switch (command.kind) {
        case "Partner":
        case "Company":
          return command.name;
        case "Employee":
          return `${command.name} at ${command.company}`;
        case "Contact":
          return `${command.employee} ${command.partner} ${command.contactType}`;
        default:
          return assertNever(command);
      }
    };

    const incomplete = (command: Command): string => {
      switch (command.kind) {
        case "Partner":
        case "Company":
        case "Employee":
          return command.name;
        default:
          // @ts-expect-error -- "Contact" is not handled, so this is not never.
          return assertNever(command);
      }
    };

    expect(describeCommand({ kind: "Partner", name: "Chris" })).toBe("Chris");
    expect(() =>
      incomplete({
        kind: "Contact",
        employee: "Laurie",
        partner: "Chris",
        contactType: "email",
      }),
    ).toThrow("Unexpected value");
  });
});

describe("COMMAND_SYNTAX", () => {
  it("covers exactly the command kinds, in the brief's order", () => {
    expectTypeOf<keyof typeof COMMAND_SYNTAX>().toEqualTypeOf<CommandKind>();
    expect(Object.keys(COMMAND_SYNTAX)).toEqual([
      "Partner",
      "Company",
      "Employee",
      "Contact",
    ]);
  });

  it("names each command's arguments as the brief does", () => {
    expect(COMMAND_SYNTAX).toEqual({
      Partner: ["Name"],
      Company: ["Name"],
      Employee: ["Name", "CompanyName"],
      Contact: ["EmployeeName", "PartnerName", "ContactType"],
    });
  });
});

describe("MalformedLine", () => {
  // Compile-time check (T2.5): a reason and its data can't disagree.
  it("carries a command kind for every reason except unknown-command", () => {
    const source = { lineNumber: 1, text: "Employee Laurie" };
    const valid: MalformedLine[] = [
      { outcome: "malformed", source, reason: "unknown-command" },
      {
        outcome: "malformed",
        source,
        reason: "wrong-word-count",
        kind: "Employee",
      },
    ];

    // @ts-expect-error -- a known command's warning needs its kind.
    const missingKind: MalformedLine = {
      outcome: "malformed",
      source,
      reason: "wrong-word-count",
    };

    const unknownWithKind: MalformedLine = {
      outcome: "malformed",
      source,
      reason: "unknown-command",
      // @ts-expect-error -- an unknown keyword has no kind.
      kind: "Employee",
    };

    expect([...valid, missingKind, unknownWithKind]).toHaveLength(4);
  });
});
