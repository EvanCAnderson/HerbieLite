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

Each open question names the subtask that settles it, and that subtask in §6
names the question back (see [DECISIONS T2.2](./DECISIONS.md#t2-2)). The
question and its default live only here. When the subtask settles it, the
question moves to DECISIONS and to the Decided list below. Listed in the order
their subtasks are built.

- **Q10 — Whitespace within a line.** Brief says "space-separated" only.
  **Default: split on runs of spaces or tabs, ignore leading and trailing
  whitespace, and strip a trailing `\r` (CRLF files).** Settle in T3a.
- **Q11 — Command keyword case.** Q4 covers names, not keywords.
  **Default: case-sensitive, like names; `partner Chris` is malformed (Q7).**
  Settle in T3b.
- **Q12 — One name used by more than one entity kind** (e.g. a Partner and an
  Employee both named `Sam`, or a Partner and a Company). Brief only requires
  employee names to be unique among employees. **Default: allowed; each kind
  has its own namespace, and a name's position in a `Contact` line says which
  kind it is.** Settle in T4a.
- **Q13 — Identical `Contact` lines.** Q5 ignores exact repeats, but a second
  identical contact is a second interaction. **Default: every `Contact` line
  counts; Q5's exact-repeat rule covers `Partner`, `Company`, and `Employee`
  only, and its wording is narrowed when this is settled.** Settle in T4c.
- **Q1 — Tie-break between partners with equal strength.** Brief is silent.
  **Default: alphabetical by partner name.** Deterministic and testable.
  Settle in T5b.
- **Q14 — What "sorted alphabetically" means.** Names are case-sensitive (Q4),
  so `acme` and `ACME` can both exist. **Default: code-point order (every
  uppercase letter before every lowercase one), which gives the same output
  on any machine; locale-aware sorting varies by environment.** Settle in T5c.
- **Q15 — Invalid invocation.** Q7 covers bad lines, not a bad command line.
  **Default: a missing or unreadable file, or more than one argument, prints
  an error to stderr, prints no report, and exits 1.** Settle in T6b.

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

Subtasks (lettered, see [DECISIONS T2.1](./DECISIONS.md#t2-1)) are listed in
the order they are built. Each subtask ships with its own tests and DECISIONS
entries, and is a natural commit boundary (commits still use the `T<n>:`
prefix).

- [x] T0 — Confirm tooling (§5). Tie-break (Q1) deferred to implementation.
- [x] T1 — Scaffold project: `package.json`, `tsconfig`(+`.build`), vitest,
      eslint+prettier, `src/` entry + smoke test. All scripts green.
- [ ] T2 — Types: `Command` union, malformed-line result, domain types.
  - [ ] T2a — Decide where types live (one shared module vs. the layer that
        owns them) and record it.
  - [ ] T2b — Contact types as one `const` list with a derived union type, so
        parser validation and warning text share a single source (FR1).
  - [ ] T2c — `Command` discriminated union on `kind` with named fields, plus
        an `assertNever` helper for exhaustive switches (D3).
  - [ ] T2d — Per-line parse result: command, malformed (reason and expected
        format, Q7), or blank (skipped, Q6), each carrying its 1-based line
        number and raw text for later warnings (Q5, Q8).
  - [ ] T2e — Network state and warning types: partner and company sets,
        employee → company map, contact list, pending employees and contacts
        (D4).
- [ ] T3 — `parser`: line → `Command` or malformed (Q7, Q9); unit tests.
  - [ ] T3a — Split a line into words; skip blank lines (Q6). Settles Q10.
  - [ ] T3b — Recognise the command keyword; unknown keyword → malformed,
        listing the valid commands (Q7). Settles Q11.
  - [ ] T3c — Per-command word count and `[A-Za-z]+` word check (Q9); a
        failure → malformed with that command's expected format (Q7).
  - [ ] T3d — Contact type restricted to `email|call|coffee`; anything else →
        malformed (FR1, Q7).
- [ ] T4 — `network`: apply commands, hold pending employees and contacts,
      resolve at end of input (Q5, Q8); unit tests.
  - [ ] T4a — Apply `Partner` and `Company` at once; exact repeats ignored
        silently (Q5). Settles Q12.
  - [ ] T4b — Hold each `Employee` as pending with its line number (Q5); exact
        repeats ignored.
  - [ ] T4c — Hold each `Contact` as pending with its line number (Q8).
        Settles Q13.
  - [ ] T4d — End-of-input resolution: employees in input order (first valid
        declaration wins; conflicts and unknown companies warned), then
        contacts (unknown employee or partner warned). Returns the resolved
        network and warnings in input order (Q5, Q8).
- [ ] T5 — `report`: network → sorted lines; add the brief's
      `input.txt` fixture; unit tests incl. the brief's example.
  - [ ] T5a — Tally relationship strength per (company, partner) from resolved
        contacts; every contact counts 1 regardless of type (§1).
  - [ ] T5b — Pick each company's strongest partner. Settles Q1.
  - [ ] T5c — Sort all declared companies and format each line exactly as
        FR4 (Q2, Q3). Settles Q14.
  - [ ] T5d — Add the brief's example as `input.txt` (its demo comment line
        removed, its trailing blank line kept) and a test asserting the exact
        output in §7.
- [ ] T6 — `cli`: `async main(argv, stdin, stdout, stderr)` → exit code; file
      arg, STDIN, interactive entry (D1); warnings on stderr; end-to-end tests.
  - [ ] T6a — Replace the placeholder with `main(argv, stdin, stdout, stderr)`
        returning an exit code; `bin.ts` passes the process streams and sets
        `process.exitCode`. Replace the scaffold smoke test.
  - [ ] T6b — Choose the input source: file argument, else STDIN (D1).
        Settles Q15.
  - [ ] T6c — Stream lines through the parser, printing Q7 warnings as each
        line is read; at end of input print Q5/Q8 warnings, then the report on
        stdout; exit 0.
  - [ ] T6d — When STDIN is a terminal, print the one-line hint to stderr
        before reading (D1).
  - [ ] T6e — Process-level test through `bin.ts`: file argument and a pipe
        both produce §7's output with empty stderr.
- [ ] T7 — README (build/run/test, approach, LLM usage, every D and Q).
  - [ ] T7a — Build, run, and test: Node 22.13+, `npm install`,
        `npm run check`, `npm run build`, and every run form in D1, including
        interactive entry (brief 3, 7.1).
  - [ ] T7b — Approach and design: the four layers and D1–D4 with their
        tradeoffs, linking to DECISIONS (brief 7.2).
  - [ ] T7c — How LLMs were used: workflow, what was accepted, modified, or
        rejected, citing DECISIONS Origin lines (brief 7.2.1).
  - [ ] T7d — Assumptions and edge cases: every Q, flagging where the brief was interpreted (brief 7.3, 7.3.1).
- [ ] T8 — Final pass: naming, comments, tradeoff notes.
  - [ ] T8a — Code read-through: naming, comments that cite DECISIONS IDs,
        no placeholder text or dead code.
  - [ ] T8b — Docs consistency: PLAN §3–§4 index matches DECISIONS, no
        questions left open, README covers every D and Q, deferred ideas are
        in UPGRADES.
  - [ ] T8c — Walk BRIEF requirements 1–7 and §7, recording the test or
        command that shows each is met.
  - [ ] T8d — Clean-clone check: `npm ci`, `npm run check`, `npm run build`,
        then run `node dist/bin.js input.txt` and the piped form.

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
