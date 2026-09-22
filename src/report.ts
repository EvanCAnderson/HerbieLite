// Report layer (DECISIONS T1.11, layer 3): pure functions from the resolved
// network to lines of output: the report (FR3, FR4) and the ties behind it
// (Q21), and the queries about one company (Q31, Q32). No I/O — the cli prints
// what these return (T6c).
import type { Network } from "./network.js";

/**
 * Orders two names by UTF-16 code unit: the machine-independent reading of
 * "sorted alphabetically" (Q14), under which every uppercase letter sorts
 * before every lowercase one. Names are letters only (Q9), so this is also
 * their code-point order. One rule serves every place an order is needed:
 * the company list (Q14), the tie-break between equally strong partners (Q1),
 * and the employees a query lists (Q32).
 */
function compareNames(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Contacts per partner, for one company or one employee. For a company this
 * is each partner's relationship strength (FR5). Every contact counts 1
 * whatever its type, and a repeated Contact line counts again (PLAN §1, Q13).
 */
type Strengths = ReadonlyMap<string, number>;

/**
 * Tallies every contact per partner, grouped by the key `group` gives it: the
 * company its employee works for, or the employee. A group with no contacts
 * gets no entry at all, which the caller reads as no relationship (Q2).
 */
function tally(
  network: Network,
  group: (employee: string, company: string) => string,
): Map<string, Strengths> {
  const groups = new Map<string, Map<string, number>>();
  for (const { employee, partner } of network.contacts) {
    const company = network.employers.get(employee);
    if (company === undefined) {
      // Network states this as an invariant: a contact only survives
      // resolution once its employee is declared (Q8). Reaching here means
      // the network was built some other way, and skipping the contact
      // silently would lower a strength and could change the partner named.
      throw new Error(
        `Network invariant broken: contact names an employee with no employer: ${employee}`,
      );
    }
    const key = group(employee, company);
    let strengths = groups.get(key);
    if (strengths === undefined) {
      strengths = new Map<string, number>();
      groups.set(key, strengths);
    }
    strengths.set(partner, (strengths.get(partner) ?? 0) + 1);
  }
  return groups;
}

const byCompany = (_employee: string, company: string): string => company;
const byEmployee = (employee: string): string => employee;

interface Ranked {
  readonly partner: string;
  readonly strength: number;
}

/**
 * Partners strongest first, equal strengths alphabetically (Q1). The one
 * ranking behind the report, its ties, and both queries, so they cannot
 * disagree about who comes first. Empty when there are no contacts (Q2).
 */
function rank(strengths: Strengths | undefined): readonly Ranked[] {
  return [...(strengths ?? [])]
    .map(([partner, strength]) => ({ partner, strength }))
    .sort(
      (a, b) => b.strength - a.strength || compareNames(a.partner, b.partner),
    );
}

/** `Chris (2), Molly (1)`: partners as a report line shows each one. */
function listed(ranked: readonly Ranked[]): string {
  return ranked
    .map(({ partner, strength }) => `${partner} (${strength})`)
    .join(", ");
}

/**
 * Partners equally strongest at one company (Q21). The report line names the
 * first of them, by the alphabetical rule (Q1); the rest are what the line
 * cannot show.
 */
export interface Tie {
  readonly company: string;
  /** Two or more, in the order Q1 ranks them, so the first is the one named. */
  readonly partners: readonly [string, ...string[]];
  readonly strength: number;
}

/** The report's lines (FR4), and every tie a line settled by the alphabet. */
export interface Report {
  readonly lines: readonly string[];
  readonly ties: readonly Tie[];
}

/**
 * The partners with the strongest relationship to one company (FR5), in the
 * order Q1 ranks them, or `undefined` when the company has no contacts at all
 * (Q2). More than one partner is a tie (Q21).
 */
function strongest(strengths: Strengths | undefined):
  | {
      readonly partners: readonly [string, ...string[]];
      readonly strength: number;
    }
  | undefined {
  const [top, ...rest] = rank(strengths);
  if (top === undefined) return undefined;
  const tied = rest.filter(({ strength }) => strength === top.strength);
  return {
    partners: [top.partner, ...tied.map(({ partner }) => partner)],
    strength: top.strength,
  };
}

/**
 * The report: one line per declared company, sorted alphabetically (FR4),
 * with the ties behind those lines in the same order (Q21). The line and its
 * tie come from one pick, so the partner a line names is always the first of
 * its tie. The company list drives the output, so every declared company
 * appears even with no employees or no contacts (Q2), and Drive Capital never
 * does, since it is never declared with `Company` (Q3).
 */
export function buildReport(network: Network): Report {
  const strengths = tally(network, byCompany);
  const lines: string[] = [];
  const ties: Tie[] = [];
  for (const company of [...network.companies].sort(compareNames)) {
    const best = strongest(strengths.get(company));
    if (best === undefined) {
      lines.push(`${company}: No current relationship`);
      continue;
    }
    const { partners, strength } = best;
    lines.push(`${company}: ${partners[0]} (${strength})`);
    if (partners.length > 1) ties.push({ company, partners, strength });
  }
  return { lines, ties };
}

/**
 * `--partners`: every partner who has contacted the company, with their
 * strength, strongest first (Q32), on one line in the report's shape; or
 * `No current relationship`, as the report says it (Q2). `undefined` when no
 * such company was declared (Q33).
 */
export function partnersOf(
  network: Network,
  company: string,
): readonly string[] | undefined {
  if (!network.companies.has(company)) return undefined;
  const ranked = rank(tally(network, byCompany).get(company));
  return [
    ranked.length === 0
      ? `${company}: No current relationship`
      : `${company}: ${listed(ranked)}`,
  ];
}

/**
 * `--employees`: one line per employee of the company, alphabetically, each
 * with the partners who contacted them, strongest first (Q32); `No contacts`
 * for an employee nobody contacted. A company with no employees has no lines,
 * as no companies has no report (T6.14). `undefined` when no such company was
 * declared (Q33).
 */
export function employeesOf(
  network: Network,
  company: string,
): readonly string[] | undefined {
  if (!network.companies.has(company)) return undefined;
  const strengths = tally(network, byEmployee);
  return [...network.employers]
    .filter(([, employer]) => employer === company)
    .map(([employee]) => employee)
    .sort(compareNames)
    .map((employee) => {
      const ranked = rank(strengths.get(employee));
      return ranked.length === 0
        ? `${employee}: No contacts`
        : `${employee}: ${listed(ranked)}`;
    });
}
