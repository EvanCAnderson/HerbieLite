# Herbie Lite — Plan & Requirements

Working document. Breaks the [brief](./BRIEF.md) into concrete, checkable
requirements, indexes the design decisions, and tracks open questions and tasks.
Full text and rationale for every decided item lives in
[`DECISIONS.md`](./DECISIONS.md); this document links to it rather than
repeating it.

---

## 1. Domain model

Four entity kinds, drawn straight from the four commands:

| Entity   | Meaning                                             | Key                                      |
| -------- | --------------------------------------------------- | ---------------------------------------- |
| Partner  | Employee of "Drive Capital"                         | name (unique)                            |
| Company  | A company that is **not** Drive Capital             | name (unique)                            |
| Employee | Works at exactly one declared Company               | name (globally unique)                   |
| Contact  | One interaction: a Partner ↔ an Employee, of a type | (employee, partner, type) — many allowed |

- Contact types: `email`, `call`, `coffee` (a closed set).
- **Relationship strength** (Partner → Company) = count of all Contacts between
  that Partner and every Employee of that Company. Contact _type_ does not affect
  weight — each contact counts as 1 (the brief says "total amount of Contacts").

## 2. Functional requirements (from the brief)

- **FR1 — Parse commands.** One command per line, space-separated words `[A-Za-z]+`.
  - `Partner <Name>`
  - `Company <Name>`
  - `Employee <Name> <CompanyName>` (company already declared; employee name globally unique)
  - `Contact <EmployeeName> <PartnerName> <email|call|coffee>`
  - Contact types are a closed set: `email`, `call`, `coffee`. The brief says the
    program "should only accept" these; any other type is rejected (see Q7).
- **FR2 — Input.** The brief lets us assume well-formed input; malformed lines are
  still handled (Q7). Accept via **file argument, STDIN, and interactive entry**
  (see D1).
- **FR3 — Output to stdout**, one line per company.
- **FR4 — Company report.** List **all** companies, **sorted alphabetically**. For each:
  - has a relationship → `<CompanyName>: <PartnerName> (<RelationshipStrength>)`
  - no relationship → `<CompanyName>: No current relationship`
- **FR5 — Strongest partner** per company = the partner with the highest
  relationship strength to that company.
- **FR6 — README** with build/run/test instructions, approach & design notes
  (incl. how LLMs were used), and assumptions/edge cases.

## 3. Design decisions (index)

All decided; full text in [DECISIONS — T1 review](./DECISIONS.md#t1-review).

- [**D1**](./DECISIONS.md#d1) — Input: file argument, STDIN, and interactive entry.
- [**D2**](./DECISIONS.md#d2) — Layers: `parser` / `network` / `report` / `cli`.
- [**D3**](./DECISIONS.md#d3) — Commands as a discriminated union.
- [**D4**](./DECISIONS.md#d4) — Store raw facts; compute strongest partner at report time.

## 4. Questions and assumptions (document all in README)

### Open

- **Q1 — Tie-break between partners with equal strength.** Brief is silent.
  **Default: alphabetical by partner name.** Deterministic and testable. Confirm
  in T5, then move to DECISIONS.

### Decided (full text in [DECISIONS](./DECISIONS.md#t1-review))

- [**Q2**](./DECISIONS.md#q2) — Zero contacts (or no employees) → "No current relationship".
- [**Q3**](./DECISIONS.md#q3) — Drive Capital never appears in the output.
- [**Q4**](./DECISIONS.md#q4) — Names are case-sensitive.
- [**Q5**](./DECISIONS.md#q5) — Duplicate and conflicting declarations.
- [**Q6**](./DECISIONS.md#q6) — Error handling depth: every malformed line gets Q7.
- [**Q7**](./DECISIONS.md#q7) — Malformed lines: discard, warn with expected format, continue.
- [**Q8**](./DECISIONS.md#q8) — Contacts resolved after all input; unresolved ones warned and discarded.
- [**Q9**](./DECISIONS.md#q9) — A word is letters only, `[A-Za-z]+`.

## 5. Tooling

Decided; see [DECISIONS](./DECISIONS.md) T0.1 (toolchain), T0.2 (ESM/NodeNext),
T1.1 (test layout), T1.2 (lint + format), T1.3 (build vs. type-check split,
`npm run check`), T1.5–T1.9 (strictness, entry file, Node version, package
settings, dependency versions).
Scripts are defined in `package.json`.

## 6. Task breakdown

- [x] T0 — Confirm tooling (§5). Tie-break (Q1) deferred to implementation.
- [x] T1 — Scaffold project: `package.json`, `tsconfig`(+`.build`), vitest,
      eslint+prettier, `src/` entry + smoke test. All scripts green.
- [ ] T2 — Types: `Command` union, malformed-line result, domain types.
- [ ] T3 — `parser`: line → `Command` or malformed (Q7, Q9); unit tests.
- [ ] T4 — `network`: apply commands, hold pending employees and contacts,
      resolve at end of input (Q5, Q8); unit tests.
- [ ] T5 — `report`: network → sorted lines; settle Q1; add the brief's
      `input.txt` fixture; unit tests incl. the brief's example.
- [ ] T6 — `cli`: `async main(argv, stdin, stdout, stderr)` → exit code; file
      arg, STDIN, interactive entry (D1); warnings on stderr; end-to-end tests.
- [ ] T7 — README (build/run/test, approach, LLM usage, every D and Q).
- [ ] T8 — Final pass: naming, comments, tradeoff notes.

## 7. Definition of done

- `input.txt` from the brief produces exactly:
  ```
  ACME: No current relationship
  Globex: Chris (2)
  Hooli: Molly (1)
  ```
- Runs via file arg, STDIN, and interactive entry.
- Malformed and unresolved lines produce stderr warnings, the report still
  prints, and the exit code is 0 (Q5, Q7, Q8).
- `npm run check` passes (typecheck, lint, format, tests).
- Tests cover parser, network, report, and `cli` end-to-end.
- README covers every D and Q in §3–§4.
