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
  (see T1.10).
- **FR3 — Output to stdout**, one line per company.
- **FR4 — Company report.** List **all** companies, **sorted alphabetically**. For each:
  - has a relationship → `<CompanyName>: <PartnerName> (<RelationshipStrength>)`
  - no relationship → `<CompanyName>: No current relationship`
- **FR5 — Strongest partner** per company = the partner with the highest
  relationship strength to that company.
- **FR6 — README** with build/run/test instructions, approach & design notes
  (incl. how LLMs were used), and assumptions/edge cases.

## 3. Design decisions (index)

All decided in T1; full text in [DECISIONS — T1](./DECISIONS.md#t1).

- [**T1.10**](./DECISIONS.md#t1-10) — Input: file argument, STDIN, and interactive entry.
- [**T1.11**](./DECISIONS.md#t1-11) — Layers: `parser` / `network` / `report` / `cli`.
- [**T1.12**](./DECISIONS.md#t1-12) — Commands as a discriminated union.
- [**T1.13**](./DECISIONS.md#t1-13) — Store raw facts; compute strongest partner at report time.

## 4. Questions and assumptions (document all in README)

### Open

Each open question names the subtask that settles it, and that subtask in §6
names the question back (see [DECISIONS T2.2](./DECISIONS.md#t2-2)). The
question and its default live only here. When the subtask settles it, the
question moves to DECISIONS and to the Decided list below. Listed in the order
their subtasks are built.

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
- **Q16 — A byte-order mark (BOM) at the start of the file.** Some editors
  (Windows Notepad, Excel's UTF-8 CSV) begin a file with an invisible U+FEFF,
  and Node does not remove it when reading, so line 1 arrives as
  `\uFEFFPartner Chris` and is rejected as an unknown command (Q7, Q11).
  **Default: not handled in the base; line 1 is discarded with the Q7
  warning, even when it looks blank (a BOM alone is not a blank line, Q6),
  and the README names the cause and how to remove it (T7d).
  Stripping the BOM is [UPGRADES U2](./UPGRADES.md#u2).** Settle in T6c.

### Decided (full text in [DECISIONS](./DECISIONS.md))

- [**Q2**](./DECISIONS.md#q2) (T1.14) — Zero contacts (or no employees) → "No current relationship".
- [**Q3**](./DECISIONS.md#q3) (T1.15) — Drive Capital never appears in the output.
- [**Q4**](./DECISIONS.md#q4) (T1.16) — Names are case-sensitive.
- [**Q5**](./DECISIONS.md#q5) (T1.17) — Duplicate and conflicting declarations.
- [**Q6**](./DECISIONS.md#q6) (T1.18) — Error handling depth: every malformed line gets Q7.
- [**Q7**](./DECISIONS.md#q7) (T1.19) — Malformed lines: discard, warn with expected format, continue.
- [**Q8**](./DECISIONS.md#q8) (T1.20) — Contacts resolved after all input; unresolved ones warned and discarded.
- [**Q9**](./DECISIONS.md#q9) (T1.21) — A word is letters only, `[A-Za-z]+`.
- [**Q12**](./DECISIONS.md#q12) (T2.7) — One name, one person: partners and employees share a namespace; companies don't.
- [**Q13**](./DECISIONS.md#q13) (T2.6) — Every `Contact` line counts; a repeated declaration is discarded with a warning.
- [**Q10**](./DECISIONS.md#q10) (T3.2) — Words split on runs of spaces or tabs; edges and a CRLF `\r` ignored.
- [**Q11**](./DECISIONS.md#q11) (T3.3) — Command keywords are case-sensitive.

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
- [x] T2 — Types: `Command` union, malformed-line result, domain types.
  - [x] T2a — Decide where types live (one shared module vs. the layer that
        owns them) and record it.
  - [x] T2b — Contact types as one `const` list with a derived union type, so
        parser validation and warning text share a single source (FR1).
  - [x] T2c — `Command` discriminated union on `kind` with named fields, plus
        an `assertNever` helper for exhaustive switches (T1.12).
  - [x] T2d — Per-line parse result: command, malformed (reason and command
        kind, Q7), or blank (skipped, Q6), each carrying its 1-based line
        number and raw text for later warnings (Q5, Q8). The grammar as data
        (`COMMAND_SYNTAX`), so warnings can quote each command's format.
  - [x] T2e — Network state and warning types: partner and company sets,
        employee → company map, contact list (T1.13), and one warning for any
        repeated declaration (Q12, Q13). Pending partners, employees, and
        contacts stay private to `network` (T2.5).
- [x] T3 — `parser`: line → `Command` or malformed (Q7, Q9); unit tests.
  - [x] T3a — Split a line into words; skip blank lines (Q6). Settles Q10.
  - [x] T3b — Recognise the command keyword; unknown keyword → malformed,
        listing the valid commands (Q7). Settles Q11.
  - [x] T3c — Per-command word count, read from `COMMAND_SYNTAX`, and
        `[A-Za-z]+` word check (Q9); a failure → malformed with that
        command's kind (Q7, T2.5).
  - [x] T3d — Contact type restricted to `email|call|coffee`; anything else →
        malformed (FR1, Q7).
- [ ] T4 — `network`: apply commands, hold pending partners, employees, and
      contacts, resolve at end of input (Q5, Q8, Q12); unit tests.
  - [ ] T4a — Apply `Company` at once; a repeated company is discarded with
        the duplicate-declaration warning (Q13).
  - [ ] T4b — Hold each `Partner` and `Employee` as pending with its line
        number (Q5, Q12).
  - [ ] T4c — Hold each `Contact` as pending with its line number (Q8);
        every line is kept, repeats included (Q13).
  - [ ] T4d — End-of-input resolution: partners and employees together in
        input order, the first valid declaration of a name standing and any
        later one warned (Q12, Q13), unknown companies warned (Q5); then
        contacts (each failed slot warned as undeclared or wrong role, Q8,
        Q12). Returns the resolved network and warnings in input order.
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
      arg, STDIN, interactive entry (T1.10); warnings on stderr; end-to-end
      tests.
  - [ ] T6a — Replace the placeholder with `main(argv, stdin, stdout, stderr)`
        returning an exit code; `bin.ts` passes the process streams and sets
        `process.exitCode`. Replace the scaffold smoke test.
  - [ ] T6b — Choose the input source: file argument, else STDIN (T1.10).
        Settles Q15.
  - [ ] T6c — Stream lines through the parser, printing Q7 warnings as each
        line is read; at end of input print Q5/Q8 warnings, then the report on
        stdout; exit 0. Choose the line reader and how line numbers are
        counted: `readline` already strips `\r\n`, and treats a lone `\r` as a
        line break, which shifts every later line number (Q10). Settles Q16.
  - [ ] T6d — When STDIN is a terminal, print the one-line hint to stderr
        before reading (T1.10).
  - [ ] T6e — Process-level test through `bin.ts`: file argument and a pipe
        both produce §7's output with empty stderr.
- [ ] T7 — README (build/run/test, approach, LLM usage, every §3 decision
      and Q).
  - [ ] T7a — Build, run, and test: Node 22.13+, `npm install`,
        `npm run check`, `npm run build`, and every run form in T1.10, including
        interactive entry (brief 3, 7.1).
  - [ ] T7b — Approach and design: the four layers and T1.10–T1.13 with
        their tradeoffs, linking to DECISIONS (brief 7.2).
  - [ ] T7c — How LLMs were used: workflow, what was accepted, modified, or
        rejected, citing DECISIONS Origin lines (brief 7.2.1).
  - [ ] T7d — Assumptions and edge cases: every Q, flagging where the brief
        was interpreted (brief 7.3, 7.3.1). Note that a keyword may be used
        as a name (`Company Contact`), which follows from Q9.
- [ ] T8 — Final pass: naming, comments, tradeoff notes.
  - [ ] T8a — Code read-through: naming, comments that cite DECISIONS IDs,
        no placeholder text or dead code.
  - [ ] T8b — Docs consistency: PLAN §3–§4 index matches DECISIONS, no
        questions left open, README covers every §3 decision and Q,
        deferred ideas are in UPGRADES.
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
- README covers every entry in §3–§4.
