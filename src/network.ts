// Network layer (DECISIONS T1.11, layer 2): applies commands, holds pending
// partners, employees, and contacts, and resolves them at end of input (Q5,
// Q8, Q12). Types only for now; the implementation lands in T4.
import type {
  Command,
  ContactCommand,
  SourceLine,
  SourcedCommand,
} from "./parser.js";

/** One resolved interaction between a partner and an employee. */
export type Contact = Omit<ContactCommand, "kind">;

/** A command that declares something exists; declaring it twice is an error (Q13). */
export type Declaration = Exclude<Command, ContactCommand>;

/**
 * The resolved network: raw facts only, with no pre-computed strengths
 * (DECISIONS T1.13). Every contact's employee and partner are declared.
 *
 * The shapes encode Q12 and Q13: each declared name is held once (sets and a
 * map), while contacts are a list, because every Contact line counts. A name
 * is never both in `partners` and a key of `employers`.
 */
export interface Network {
  readonly partners: ReadonlySet<string>;
  readonly companies: ReadonlySet<string>;
  /** Employee name → company name. */
  readonly employers: ReadonlyMap<string, string>;
  /** In input order. */
  readonly contacts: readonly Contact[];
}

/** A line the network layer discarded (Q5, Q8, Q12, Q13). */
export type NetworkWarning =
  | {
      readonly problem: "unknown-company";
      readonly source: SourceLine;
      readonly company: string;
    }
  | {
      /**
       * The name is already declared: an exact repeat, an employee at a
       * different company, or a person name held by the other kind. The cli
       * layer tells these apart by comparing the two commands.
       */
      readonly problem: "duplicate-declaration";
      readonly source: SourceLine;
      readonly command: Declaration;
      /** The first valid declaration of the name, which stands. */
      readonly standing: SourcedCommand<Declaration>;
    }
  | {
      readonly problem: "unresolved-contact";
      readonly source: SourceLine;
      /** One entry per slot that failed; never empty. */
      readonly failures: readonly [ContactFailure, ...ContactFailure[]];
    };

/**
 * Why one name in a Contact line didn't resolve (Q8). Names belong to one
 * person (Q12), so a name declared as the other kind of person is reported
 * as a wrong role, e.g. a swapped employee and partner. A name whose
 * declaration was discarded counts as undeclared; its own warning says why.
 */
export interface ContactFailure {
  readonly role: "employee" | "partner";
  readonly name: string;
  readonly cause: "undeclared" | "wrong-role";
}
