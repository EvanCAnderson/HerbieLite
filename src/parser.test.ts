import { describe, expect, expectTypeOf, it } from "vitest";
import { assertNever } from "./assert-never.js";
import {
  COMMAND_SYNTAX,
  CONTACT_TYPES,
  isContactType,
  parseLine,
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
  // Compile-time check (T1.12): a switch that misses a kind fails to
  // type-check.
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

describe("parseLine", () => {
  const parse = (text: string) => parseLine({ lineNumber: 7, text });

  const command = (text: string, expected: Command) => ({
    outcome: "command",
    source: { lineNumber: 7, text },
    command: expected,
  });

  const malformed = (
    text: string,
    reason: MalformedLine["reason"],
    kind?: CommandKind,
  ) => ({
    outcome: "malformed",
    source: { lineNumber: 7, text },
    reason,
    ...(kind === undefined ? {} : { kind }),
  });

  describe("each command", () => {
    it.each<[string, Command]>([
      ["Partner Chris", { kind: "Partner", name: "Chris" }],
      ["Company Globex", { kind: "Company", name: "Globex" }],
      [
        "Employee Laurie Globex",
        { kind: "Employee", name: "Laurie", company: "Globex" },
      ],
      ...CONTACT_TYPES.map((contactType): [string, Command] => [
        `Contact Laurie Chris ${contactType}`,
        { kind: "Contact", employee: "Laurie", partner: "Chris", contactType },
      ]),
    ])("parses %j", (text, expected) => {
      expect(parse(text)).toEqual(command(text, expected));
    });

    it("allows a keyword as a name", () => {
      expect(parse("Company Contact")).toEqual(
        command("Company Contact", { kind: "Company", name: "Contact" }),
      );
    });
  });

  describe("blank lines (Q6)", () => {
    it.each(["", " ", "\t \t", "\r", "  \r"])("skips %j", (text) => {
      expect(parse(text)).toEqual({
        outcome: "blank",
        source: { lineNumber: 7, text },
      });
    });
  });

  describe("whitespace (Q10)", () => {
    it.each([
      "Employee  Laurie   Globex",
      "Employee\tLaurie \t Globex",
      "  Employee Laurie Globex  ",
      "\tEmployee Laurie Globex\t",
      "Employee Laurie Globex\r",
      "Employee Laurie Globex \r",
    ])("splits %j on runs of spaces and tabs", (text) => {
      // The source keeps the raw text; only the words are normalised.
      expect(parse(text)).toEqual(
        command(text, { kind: "Employee", name: "Laurie", company: "Globex" }),
      );
    });

    it("keeps other whitespace inside a word", () => {
      expect(parse("Partner Chris\u00a0")).toEqual(
        malformed("Partner Chris\u00a0", "invalid-word", "Partner"),
      );
      expect(parse("Partner\u00a0Chris")).toEqual(
        malformed("Partner\u00a0Chris", "unknown-command"),
      );
    });

    it("strips only a trailing carriage return", () => {
      expect(parse("Partner Chris\r ")).toEqual(
        malformed("Partner Chris\r ", "invalid-word", "Partner"),
      );
    });
  });

  describe("unknown keywords (Q7, Q11)", () => {
    it.each([
      "partner Chris",
      "PARTNER Chris",
      "Partners Chris",
      "Hello",
      "Chris Partner",
    ])("rejects %j", (text) => {
      expect(parse(text)).toEqual(malformed(text, "unknown-command"));
    });

    it.each(["constructor Chris", "__proto__ Chris", "toString Chris"])(
      "does not treat an object property as a command: %j",
      (text) => {
        expect(parse(text)).toEqual(malformed(text, "unknown-command"));
      },
    );
  });

  describe("word count (Q7)", () => {
    it.each<[string, CommandKind]>([
      ["Partner", "Partner"],
      ["Partner Chris Molly", "Partner"],
      ["Company", "Company"],
      ["Company Globex Inc", "Company"],
      ["Employee Laurie", "Employee"],
      ["Employee Laurie Globex Hooli", "Employee"],
      ["Contact Laurie Chris", "Contact"],
      ["Contact Laurie Chris email coffee", "Contact"],
    ])("rejects %j", (text, kind) => {
      expect(parse(text)).toEqual(malformed(text, "wrong-word-count", kind));
    });
  });

  describe("letters-only names (Q9)", () => {
    it.each<[string, CommandKind]>([
      ["Partner Chr1s", "Partner"],
      ["Partner Zoë", "Partner"],
      // `[` and `_` lie between `Z` and `a` in ASCII.
      ["Partner Chris[", "Partner"],
      ["Company ACME_Co", "Company"],
      ["Employee Laurie Globex-Inc", "Employee"],
      ["Employee O'Hara Globex", "Employee"],
      ["Contact L4urie Chris email", "Contact"],
      ["Contact Laurie Chris. email", "Contact"],
    ])("rejects %j", (text, kind) => {
      expect(parse(text)).toEqual(malformed(text, "invalid-word", kind));
    });
  });

  describe("contact types (FR1)", () => {
    it.each(["text", "Email", "CALL", "e-mail", "meeting"])(
      "rejects %j",
      (contactType) => {
        const text = `Contact Laurie Chris ${contactType}`;
        expect(parse(text)).toEqual(
          malformed(text, "invalid-contact-type", "Contact"),
        );
      },
    );
  });

  describe("check order (T3.4)", () => {
    it.each<[string, MalformedLine["reason"]]>([
      ["Partner Chr1s Molly", "wrong-word-count"],
      ["Contact L4urie Chris", "wrong-word-count"],
      ["Contact L4urie Chris text", "invalid-word"],
    ])("reports the first failure for %j", (text, reason) => {
      const line = parse(text);
      expect(line.outcome === "malformed" && line.reason).toBe(reason);
    });
  });
});
