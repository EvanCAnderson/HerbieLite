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

The decisions a reviewer should read first, chosen by judgment rather than by
a rule ([T5.7](./DECISIONS.md#t5-7)); full text in
[DECISIONS](./DECISIONS.md), in the section of the task that made each one.
That log keeps the complete record, in task order.

- [**T1.10**](./DECISIONS.md#t1-10) — Input: file argument, STDIN, and interactive entry.
- [**T1.11**](./DECISIONS.md#t1-11) — Layers: `parser` / `network` / `report` / `cli`.
- [**T1.12**](./DECISIONS.md#t1-12) — Commands as a discriminated union.
- [**T1.13**](./DECISIONS.md#t1-13) — Store raw facts; compute strongest partner at report time.
- [**T4.3**](./DECISIONS.md#t4-3) — `buildNetwork` takes the whole command stream; resolve in two passes.
- [**T5.1**](./DECISIONS.md#t5-1) — `report` exports one function; the tally stays private.
- [**T5.2**](./DECISIONS.md#t5-2) — A network that breaks its own invariants throws.
- [**T5.5**](./DECISIONS.md#t5-5) — The example test reads the shipped `input.txt`.
- [**T6.1**](./DECISIONS.md#t6-1) — Bad data warns; a broken invariant crashes.
- [**T6.2**](./DECISIONS.md#t6-2) — `main` takes its streams; `bin.ts` stays logic-free.
- [**T6.5**](./DECISIONS.md#t6-5) — `lines` and `warnings` are helpers of the cli layer.
- [**T6.11**](./DECISIONS.md#t6-11) — Quoted input is escaped and bounded.
- [**T6.12**](./DECISIONS.md#t6-12) — The reader names its own failures; a bug still crashes.

## 4. Questions and assumptions (document all in README)

### Open

None. Every question raised while building is settled; each one's full text
is in [DECISIONS](./DECISIONS.md), listed below. The cross-linking rule
([T2.2](./DECISIONS.md#t2-2)) stands for any question a later task opens.

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
- [**Q1**](./DECISIONS.md#q1) (T5.3) — Ties go to the alphabetically first partner.
- [**Q14**](./DECISIONS.md#q14) (T5.4) — "Sorted alphabetically" is code-unit order.
- [**Q15**](./DECISIONS.md#q15) (T6.3) — One optional file argument; a bad invocation exits 1.
- [**Q16**](./DECISIONS.md#q16) (T6.6) — A byte-order mark is stripped in the reader, silently.
- [**Q17**](./DECISIONS.md#q17) (T6.9) — A closed stdout ends quietly; other I/O fails loudly.

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
- [x] T4 — `network`: apply commands, hold pending partners, employees, and
      contacts, resolve at end of input (Q5, Q8, Q12); unit tests.
  - [x] T4a — Apply `Company` at once; a repeated company is discarded with
        the duplicate-declaration warning (Q13).
  - [x] T4b — Hold each `Partner` and `Employee` as pending with its line
        number (Q5, Q12).
  - [x] T4c — Hold each `Contact` as pending with its line number (Q8);
        every line is kept, repeats included (Q13).
  - [x] T4d — End-of-input resolution: partners and employees together in
        input order, the first valid declaration of a name standing and any
        later one warned (Q12, Q13), unknown companies warned (Q5); then
        contacts (each failed slot warned as undeclared or wrong role, Q8,
        Q12). Returns the resolved network and warnings in input order.
- [x] T5 — `report`: network → sorted lines; add the brief's
      `input.txt` fixture; unit tests incl. the brief's example.
  - [x] T5a — Tally relationship strength per (company, partner) from resolved
        contacts; every contact counts 1 regardless of type (§1).
  - [x] T5b — Pick each company's strongest partner. Settles Q1.
  - [x] T5c — Sort all declared companies and format each line exactly as
        FR4 (Q2, Q3). Settles Q14.
  - [x] T5d — Add the brief's example as `input.txt` (its demo comment line
        removed, its trailing blank line kept) and a test asserting the exact
        output in §7.
- [x] T6 — `cli`: `async main(argv, stdin, stdout, stderr)` → exit code; file
      arg, STDIN, interactive entry (T1.10); warnings on stderr; end-to-end
      tests.
  - [x] T6a — Replace the placeholder with `main(argv, stdin, stdout, stderr)`
        returning an exit code; `bin.ts` passes the process streams and sets
        `process.exitCode`. No catch at the boundary (T6.1). Replace the
        scaffold smoke test.
  - [x] T6b — Choose the input source: file argument, else STDIN (T1.10).
        Settles Q15.
  - [x] T6c — Stream lines through the parser, printing Q7 warnings as each
        line is read; at end of input print Q5/Q8 warnings, then the report on
        stdout; exit 0. Choose the line reader and how line numbers are
        counted: `readline` already strips `\r\n`, and treats a lone `\r` as a
        line break, which shifts every later line number (Q10). Settles Q16
        and Q17.
  - [x] T6d — Dropped in the T6 review: no hint and no terminal check, so
        typed input gets no greeting
        ([T6.13](./DECISIONS.md#t6-13), [U6](./UPGRADES.md#u6)).
  - [x] T6e — Process-level test through `bin.ts`: file argument and a pipe
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
        was interpreted (brief 7.3, 7.3.1). Note three things that follow
        from decided questions rather than from any one of them: that a
        keyword may be used as a name (`Company Contact`), which follows
        from Q9; that a tie leaves no trace in the output, since
        `Globex: Abdi (2)` reads the same whether Abdi won outright or on
        the alphabetical rule (Q1, [U4](./UPGRADES.md#u4)); and that
        letters-only names keep control characters and terminal escapes out
        of the report, which is an unstated dividend of Q9. Also cover the
        T6 review's additions: escaped and truncated quoting and its U+FFFD
        limit ([T6.11](./DECISIONS.md#t6-11)), no output when no company is
        declared ([T6.14](./DECISIONS.md#t6-14)), and a silent stderr
        failure ([T6.15](./DECISIONS.md#t6-15)).
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
- Runs via file arg, STDIN, and interactive entry (typed input is STDIN with
  no argument; the base prints no hint, [T6.13](./DECISIONS.md#t6-13)).
- Malformed and unresolved lines produce stderr warnings, the report still
  prints, and the exit code is 0 (Q5, Q7, Q8).
- `npm run check` passes (typecheck, lint, format, tests).
- Tests cover parser, network, report, and `cli` end-to-end.
- README covers every entry in §3–§4.
