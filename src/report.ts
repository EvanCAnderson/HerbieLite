// Report layer (DECISIONS T1.11, layer 3): a pure function from the resolved
// network to the lines of the report (FR3, FR4) and the ties behind them
// (Q21). No I/O — the cli prints what this returns (T6c).
import type { Network } from "./network.js";

/**
 * Orders two names by UTF-16 code unit: the machine-independent reading of
 * "sorted alphabetically" (Q14), under which every uppercase letter sorts
 * before every lowercase one. Names are letters only (Q9), so this is also
 * their code-point order. One rule serves both places an order is needed:
 * the company list (Q14) and the tie-break between equally strong partners
 * (Q1).
 */
function compareNames(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Relationship strength per partner, for one company: the number of contacts
 * between that partner and that company's employees (FR5). Every contact
 * counts 1 whatever its type, and a repeated Contact line counts again
 * (PLAN §1, Q13).
 */
type Strengths = ReadonlyMap<string, number>;

/**
 * Tallies every contact onto the company its employee works for. A company
 * with no contacts gets no entry at all, which the caller reads as
 * "No current relationship" (Q2).
 */
function tallyStrengths(network: Network): Map<string, Strengths> {
  const byCompany = new Map<string, Map<string, number>>();
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
    let strengths = byCompany.get(company);
    if (strengths === undefined) {
      strengths = new Map<string, number>();
      byCompany.set(company, strengths);
    }
    strengths.set(partner, (strengths.get(partner) ?? 0) + 1);
  }
  return byCompany;
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
  if (strengths === undefined) return undefined;
  let strength = 0;
  let partners: string[] = [];
  for (const [partner, count] of strengths) {
    if (count > strength) {
      strength = count;
      partners = [partner];
    } else if (count === strength) {
      partners.push(partner);
    }
  }
  const [first, ...rest] = partners.sort(compareNames);
  return first === undefined
    ? undefined
    : { partners: [first, ...rest], strength };
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
  const byCompany = tallyStrengths(network);
  const lines: string[] = [];
  const ties: Tie[] = [];
  for (const company of [...network.companies].sort(compareNames)) {
    const best = strongest(byCompany.get(company));
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
