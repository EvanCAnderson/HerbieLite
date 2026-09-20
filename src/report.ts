// Report layer (DECISIONS T1.11, layer 3): a pure function from the resolved
// network to the lines of the report (FR3, FR4). No I/O — the cli prints what
// this returns (T6c).
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
 * The partner with the strongest relationship to one company (FR5), or
 * `undefined` when the company has no contacts at all (Q2). Equal strengths
 * go to the alphabetically first partner (Q1).
 */
function strongest(
  strengths: Strengths | undefined,
): { readonly partner: string; readonly strength: number } | undefined {
  if (strengths === undefined) return undefined;
  let best: { partner: string; strength: number } | undefined;
  for (const [partner, strength] of strengths) {
    if (
      best === undefined ||
      strength > best.strength ||
      (strength === best.strength && compareNames(partner, best.partner) < 0)
    ) {
      best = { partner, strength };
    }
  }
  return best;
}

/**
 * The report: one line per declared company, sorted alphabetically (FR4).
 * The company list drives the output, so every declared company appears even
 * with no employees or no contacts (Q2), and Drive Capital never does, since
 * it is never declared with `Company` (Q3).
 */
export function reportLines(network: Network): readonly string[] {
  const byCompany = tallyStrengths(network);
  return [...network.companies].sort(compareNames).map((company) => {
    const best = strongest(byCompany.get(company));
    return best === undefined
      ? `${company}: No current relationship`
      : `${company}: ${best.partner} (${best.strength})`;
  });
}
