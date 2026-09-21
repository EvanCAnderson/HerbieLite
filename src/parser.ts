// Parser layer (DECISIONS T1.11, layer 1): one input line → a typed Command,
// or a malformed-line result (Q7).
import { assertNever } from "./assert-never.js";

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
 * The one variant named on its own, because it is the one the rules treat
 * apart: a contact is an event and every line counts, while the other three
 * declare that something exists and may not repeat (Q13). `network` names it
 * three times, once to define the rest as `Declaration`; no rule applies to
 * Partner, Company or Employee alone, so none of them has an alias.
 */
export type ContactCommand = Extract<Command, { kind: "Contact" }>;

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

/** Used to name the reasons a recognised command can fail on, below. */
type MalformedReason = MalformedLine["reason"];

/** The result of parsing one line. */
export type ParsedLine =
  | ({ readonly outcome: "command" } & SourcedCommand)
  | MalformedLine
  | { readonly outcome: "blank"; readonly source: SourceLine };

/** Words are separated by runs of spaces or tabs (Q10). */
const SEPARATOR = /[ \t]+/;

/** A name is letters only (Q9). */
const WORD = /^[A-Za-z]+$/;

function isWord(word: string): boolean {
  return WORD.test(word);
}

/**
 * Keywords are matched exactly (Q11). Own keys only, so words such as
 * `constructor` or `__proto__` are not mistaken for commands.
 */
function isCommandKind(word: string): word is CommandKind {
  return Object.hasOwn(COMMAND_SYNTAX, word);
}

/**
 * The words after a command's keyword, one per COMMAND_SYNTAX argument. A
 * tuple type, so `const [name] = args` is a `string` rather than
 * `string | undefined` under `noUncheckedIndexedAccess` (DECISIONS T1.5).
 */
type ArgumentsOf<K extends CommandKind> = {
  readonly [I in keyof (typeof COMMAND_SYNTAX)[K]]: string;
};

function hasArgumentCount<K extends CommandKind>(
  kind: K,
  words: readonly string[],
): words is readonly string[] & ArgumentsOf<K> {
  return words.length === COMMAND_SYNTAX[kind].length;
}

/**
 * Splits a line into words (Q10): ignores leading and trailing spaces and
 * tabs, and a trailing `\r` left by a CRLF file.
 */
function splitWords(text: string): string[] {
  const line = text.endsWith("\r") ? text.slice(0, -1) : text;
  return line.split(SEPARATOR).filter((word) => word !== "");
}

/**
 * Parses one input line. Checks run in a fixed order and the first failure
 * is the reason reported (DECISIONS T3.4): keyword, word count, letters-only
 * names, then contact type. The source is returned unchanged.
 */
export function parseLine(source: SourceLine): ParsedLine {
  const [keyword, ...args] = splitWords(source.text);
  if (keyword === undefined) {
    return { outcome: "blank", source };
  }
  if (!isCommandKind(keyword)) {
    return { outcome: "malformed", source, reason: "unknown-command" };
  }

  const kind = keyword;
  const malformed = (
    reason: Exclude<MalformedReason, "unknown-command">,
  ): MalformedLine => ({ outcome: "malformed", source, reason, kind });
  const parsed = (command: Command): ParsedLine => ({
    outcome: "command",
    source,
    command,
  });

  switch (kind) {
    case "Partner":
    case "Company": {
      if (!hasArgumentCount(kind, args)) return malformed("wrong-word-count");
      const [name] = args;
      if (!isWord(name)) return malformed("invalid-word");
      return parsed({ kind, name });
    }
    case "Employee": {
      if (!hasArgumentCount(kind, args)) return malformed("wrong-word-count");
      const [name, company] = args;
      if (!isWord(name) || !isWord(company)) return malformed("invalid-word");
      return parsed({ kind, name, company });
    }
    case "Contact": {
      if (!hasArgumentCount(kind, args)) return malformed("wrong-word-count");
      const [employee, partner, contactType] = args;
      if (!isWord(employee) || !isWord(partner)) {
        return malformed("invalid-word");
      }
      // Checked against the closed set alone, which is stricter than the
      // letters-only rule, so `e-mail` gets the warning that lists the types.
      if (!isContactType(contactType)) return malformed("invalid-contact-type");
      return parsed({ kind, employee, partner, contactType });
    }
    default:
      return assertNever(kind);
  }
}
