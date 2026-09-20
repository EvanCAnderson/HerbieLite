// Network layer (DECISIONS T1.11, layer 2): applies commands, holds pending
// partners, employees, and contacts, and resolves them at end of input (Q5,
// Q8, Q12).
import { assertNever } from "./assert-never.js";
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
 * (DECISIONS T1.13).
 *
 * Three invariants hold by construction, and `report` relies on them (T5):
 * every contact's employee is a key of `employers`, every contact's partner
 * is in `partners`, and every value of `employers` is in `companies`. So a
 * contact always leads to a declared company, while a company may have no
 * employees and no contacts (Q2).
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

/** What `buildNetwork` returns: data only, as the parser does (DECISIONS T2.5). */
export interface NetworkResult {
  readonly network: Network;
  /** In input order, at most one per line; the cli writes the text (T6). */
  readonly warnings: readonly NetworkWarning[];
}

/** A company name claim; companies have their own namespace (Q12). */
type CompanyDeclaration = Extract<Declaration, { kind: "Company" }>;

/** A person name claim; partners and employees share one namespace (Q12). */
type PersonDeclaration = Extract<Declaration, { kind: "Partner" | "Employee" }>;

/** Narrows to the non-empty tuple `NetworkWarning.failures` requires (T2.5). */
function isNotEmpty<T>(items: readonly T[]): items is readonly [T, ...T[]] {
  return items.length > 0;
}

/**
 * Why one name in a Contact line didn't resolve, or `undefined` if it did.
 * A name declared as the other kind of person is a wrong role rather than an
 * unknown name, because one name is one person (Q12).
 */
function slotFailure(
  role: ContactFailure["role"],
  name: string,
  people: ReadonlyMap<string, SourcedCommand<PersonDeclaration>>,
): ContactFailure | undefined {
  const declared = people.get(name);
  if (declared === undefined) {
    return { role, name, cause: "undeclared" };
  }
  const expected = role === "employee" ? "Employee" : "Partner";
  if (declared.command.kind !== expected) {
    return { role, name, cause: "wrong-role" };
  }
  return undefined;
}

/**
 * Applies every command, then resolves what was held back (Q5, Q8, Q12).
 *
 * Companies are applied as they arrive, since nothing they depend on can be
 * declared later. Partners, employees, and contacts are held: a name claim is
 * only judged once all input is read, so declaration order never changes the
 * result. Resolution runs people before contacts, both in input order, and the
 * warnings are merged back into input order at the end.
 */
export function buildNetwork(
  commands: Iterable<SourcedCommand>,
): NetworkResult {
  const warnings: NetworkWarning[] = [];
  /** Name → the declaration that stands (Q5, Q13). */
  const companies = new Map<string, SourcedCommand<CompanyDeclaration>>();
  const people = new Map<string, SourcedCommand<PersonDeclaration>>();
  const pendingPeople: SourcedCommand<PersonDeclaration>[] = [];
  const pendingContacts: SourcedCommand<ContactCommand>[] = [];

  for (const { source, command } of commands) {
    switch (command.kind) {
      case "Company": {
        const standing = companies.get(command.name);
        if (standing !== undefined) {
          warnings.push({
            problem: "duplicate-declaration",
            source,
            command,
            standing,
          });
          break;
        }
        companies.set(command.name, { source, command });
        break;
      }
      case "Partner":
      case "Employee":
        pendingPeople.push({ source, command });
        break;
      case "Contact":
        pendingContacts.push({ source, command });
        break;
      default:
        assertNever(command);
    }
  }

  for (const { source, command } of pendingPeople) {
    // The company is checked before the name, and the first failure is the
    // only one reported (T4.4): a line naming no declared company describes
    // no employee, so its name claim never arises. Discarding it here also
    // lets a later valid declaration of that name stand (Q5, fourth bullet).
    if (command.kind === "Employee" && !companies.has(command.company)) {
      warnings.push({
        problem: "unknown-company",
        source,
        company: command.company,
      });
      continue;
    }
    const standing = people.get(command.name);
    if (standing !== undefined) {
      warnings.push({
        problem: "duplicate-declaration",
        source,
        command,
        standing,
      });
      continue;
    }
    people.set(command.name, { source, command });
  }

  const partners = new Set<string>();
  const employers = new Map<string, string>();
  for (const [name, { command }] of people) {
    if (command.kind === "Partner") {
      partners.add(name);
    } else {
      employers.set(name, command.company);
    }
  }

  const contacts: Contact[] = [];
  for (const { source, command } of pendingContacts) {
    const { employee, partner, contactType } = command;
    const failures = [
      slotFailure("employee", employee, people),
      slotFailure("partner", partner, people),
    ].filter((failure) => failure !== undefined);
    if (isNotEmpty(failures)) {
      warnings.push({ problem: "unresolved-contact", source, failures });
      continue;
    }
    contacts.push({ employee, partner, contactType });
  }

  return {
    network: {
      partners,
      companies: new Set(companies.keys()),
      employers,
      contacts,
    },
    // Each pass warns in input order; no two warnings share a line, since a
    // line yields at most one command and a command at most one warning.
    warnings: warnings.sort(
      (a, b) => a.source.lineNumber - b.source.lineNumber,
    ),
  };
}
