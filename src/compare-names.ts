// The one order for names, used by the report and by every list the web page
// sorts (DECISIONS T12.15). Its own module, like assert-never.ts, because
// more than one layer uses it.

/**
 * Orders two names by UTF-16 code unit: the machine-independent reading of
 * "sorted alphabetically" (Q14), under which every uppercase letter sorts
 * before every lowercase one. Names are letters only (Q9), so this is also
 * their code-point order. One rule serves every place an order is needed:
 * the company list (Q14), the tie-break between equally strong partners (Q1),
 * the employees a query lists (Q32), and the page's files and companies.
 */
export function compareNames(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
