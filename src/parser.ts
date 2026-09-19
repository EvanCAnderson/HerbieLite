// Parser layer (DECISIONS T1.11, layer 1): one input line → a typed Command,
// or a malformed-line result (Q7). Types and grammar only for now; parsing
// lands in T3.

/** The closed set of contact types (FR1); validation and warnings read it. */
export const CONTACT_TYPES = ["email", "call", "coffee"] as const;

export type ContactType = (typeof CONTACT_TYPES)[number];

export function isContactType(word: string): word is ContactType {
  return (CONTACT_TYPES as readonly string[]).includes(word);
}

/** One input command, discriminated on its keyword (DECISIONS T1.12). */
export type Command =
  | { readonly kind: "Partner"; readonly name: string }
  | { readonly kind: "Company"; readonly name: string }
  | {
      readonly kind: "Employee";
      readonly name: string;
      readonly company: string;
    }
  | {
      readonly kind: "Contact";
      readonly employee: string;
      readonly partner: string;
      readonly contactType: ContactType;
    };

export type CommandKind = Command["kind"];

/**
 * The grammar as data (DECISIONS T2.5): each command's argument names, in
 * input order. The parser's word count and the cli's warnings (expected
 * format, list of valid commands) are both derived from it.
 */
export const COMMAND_SYNTAX = {
  Partner: ["Name"],
  Company: ["Name"],
  Employee: ["Name", "CompanyName"],
  Contact: ["EmployeeName", "PartnerName", "ContactType"],
} as const satisfies Record<CommandKind, readonly string[]>;

export type EmployeeCommand = Extract<Command, { kind: "Employee" }>;

export type ContactCommand = Extract<Command, { kind: "Contact" }>;

/** Where a line came from, kept so later warnings can quote it (Q5, Q7, Q8). */
export interface SourceLine {
  /** 1-based. */
  readonly lineNumber: number;
  readonly text: string;
}

/** A command together with the line it was parsed from. */
export interface SourcedCommand<C extends Command = Command> {
  readonly source: SourceLine;
  readonly command: C;
}

/**
 * A line discarded as soon as it is read (Q7). Data only: the cli layer
 * writes the warning from `reason` and COMMAND_SYNTAX.
 */
export type MalformedLine =
  | {
      readonly outcome: "malformed";
      readonly source: SourceLine;
      /** No such keyword; the warning lists every command. */
      readonly reason: "unknown-command";
    }
  | {
      readonly outcome: "malformed";
      readonly source: SourceLine;
      readonly reason:
        "wrong-word-count" | "invalid-word" | "invalid-contact-type";
      /** The recognised command; the warning quotes its syntax. */
      readonly kind: CommandKind;
    };

export type MalformedReason = MalformedLine["reason"];

/** The result of parsing one line. */
export type ParsedLine =
  | ({ readonly outcome: "command" } & SourcedCommand)
  | MalformedLine
  | { readonly outcome: "blank"; readonly source: SourceLine };
