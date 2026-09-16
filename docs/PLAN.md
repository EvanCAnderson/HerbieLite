# Herbie Lite — Plan & Requirements

Working document. Breaks the [brief](./BRIEF.md) into concrete, checkable
requirements plus the design decisions and open questions behind them.

---

## 1. Domain model

Four entity kinds, drawn straight from the four commands:

| Entity   | Meaning                                              | Key                |
| -------- | --------------------------------------------------- | ------------------ |
| Partner  | Employee of "Drive Capital"                         | name (unique)      |
| Company  | A company that is **not** Drive Capital             | name (unique)      |
| Employee | Works at exactly one declared Company               | name (globally unique) |
| Contact  | One interaction: a Partner ↔ an Employee, of a type | (employee, partner, type) — many allowed |

- Contact types: `email`, `call`, `coffee` (a closed set).
- **Relationship strength** (Partner → Company) = count of all Contacts between
  that Partner and every Employee of that Company. Contact *type* does not affect
  weight — each contact counts as 1 (the brief says "total amount of Contacts").

## 2. Functional requirements (from the brief)

- **FR1 — Parse commands.** One command per line, space-separated words `[A-Za-z]+`.
  - `Partner <Name>`
  - `Company <Name>`
  - `Employee <Name> <CompanyName>` (company already declared; employee name globally unique)
  - `Contact <EmployeeName> <PartnerName> <email|call|coffee>`
- **FR2 — Input.** Well-formed input assumed. Accept via **file argument and STDIN**
  (see decision D1).
- **FR3 — Output to stdout**, one line per company.
- **FR4 — Company report.** List **all** companies, **sorted alphabetically**. For each:
  - has a relationship → `<CompanyName>: <PartnerName> (<RelationshipStrength>)`
  - no relationship → `<CompanyName>: No current relationship`
- **FR5 — Strongest partner** per company = the partner with the highest
  relationship strength to that company.
- **FR6 — README** with build/run/test instructions, approach & design notes
  (incl. how LLMs were used), and assumptions/edge cases.

## 3. Design decisions

- **D1 — Input sources: file arg *and* STDIN.** `node cli.js input.txt` or
  `cat input.txt | node cli.js`. Low cost, matches the brief's examples, shows care.
- **D2 — Layered architecture.** Keep pure logic independent of I/O so it's testable:
  1. `parser` — line → typed `Command` (a discriminated union).
  2. `network` — the domain model; applies commands, holds state.
  3. `report` — pure function: network → sorted output lines.
  4. `cli` — thin I/O shell: read source, wire the layers, print.
- **D3 — Discriminated union for commands** — leans on TypeScript's exhaustiveness
  checking so adding a command type surfaces every place that must handle it.
- **D4 — Counting model.** Store per-company, per-partner contact tallies (or derive
  them). Aim for a clean single pass; O(commands) with map lookups.

## 4. Open questions / assumptions to document (in README)

- **Q1 — Tie-break between partners with equal strength.** Brief is silent.
  **Default: alphabetical by partner name.** Deterministic and testable. (Revisit.)
- **Q2 — Company with employees but zero contacts** → "No current relationship"
  (strength 0 is not a relationship). Same for companies with no employees.
- **Q3 — Drive Capital in output?** It is never declared via `Company`, so it does
  **not** appear. Only `Company`-declared companies are listed.
- **Q4 — Case sensitivity.** Names treated case-sensitively (`Chris` ≠ `chris`).
- **Q5 — Duplicate declarations / blank lines.** Assume well-formed; decide how
  lenient to be (skip blanks; last-writer-wins vs. ignore re-declares) and document.
- **Q6 — Error handling depth.** Brief allows "as much or as little as appropriate."
  Plan: tolerate blank lines; keep validation light but explicit where cheap.

## 5. Tooling (decided)

**D-tooling — `tsx` + `vitest` + `tsc`.** Fast dev loop *and* a real build artifact.
- **Run:** `tsx` executes `.ts` directly (transpiles, does not type-check).
- **Build:** `tsc` emits `dist/`.
- **Type-check:** `tsc --noEmit` (separate from run, since `tsx` skips checking — a
  clean submission runs both `typecheck` and `test`).
- **Tests:** `vitest` (TS-native, zero-config, Jest-style API).
- **Package manager:** `npm`.
- **Lint/format:** optional — `eslint` + `prettier` if time allows.

Proposed `package.json` scripts:
- `start` → `tsx src/cli.ts`
- `build` → `tsc`
- `typecheck` → `tsc --noEmit`
- `test` → `vitest run`

## 6. Task breakdown

- [x] T0 — Confirm tooling (§5). Tie-break (Q1) deferred to implementation.
- [ ] T1 — Scaffold project: `package.json`, `tsconfig.json`, test runner, `src/`.
- [ ] T2 — Define types: `Command` union + domain types.
- [ ] T3 — `parser`: line → `Command`; unit tests.
- [ ] T4 — `network`: apply commands, build state; unit tests.
- [ ] T5 — `report`: network → sorted lines; unit tests (incl. the brief's example).
- [ ] T6 — `cli`: file arg + STDIN; end-to-end test against the brief's example.
- [ ] T7 — Sample `input.txt` fixture matching the brief; verify exact output.
- [ ] T8 — README (build/run/test, approach, LLM usage, assumptions/edge cases).
- [ ] T9 — Final pass: naming, comments, tradeoff notes; optional lint/format.

## 7. Definition of done

- `input.txt` from the brief produces exactly:
  ```
  ACME: No current relationship
  Globex: Chris (2)
  Hooli: Molly (1)
  ```
- Runs via both file arg and STDIN.
- Tests cover parser, network, report, and the example end-to-end; all green.
- README complete.
