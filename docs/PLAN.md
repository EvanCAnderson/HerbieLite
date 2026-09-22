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
  (see T1.10). After the base, interactive entry was removed: commands come
  from a file, named or piped, and typing them is refused
  ([T9.12](./DECISIONS.md#t9-12)).
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
- [**T5.5**](./DECISIONS.md#t5-5) — The example test reads the shipped `examples/input.txt`.
- [**T6.1**](./DECISIONS.md#t6-1) — Bad data warns; a broken invariant crashes.
- [**T6.2**](./DECISIONS.md#t6-2) — `main` takes its streams; `bin.ts` stays logic-free.
- [**T6.5**](./DECISIONS.md#t6-5) — `lines` and `warnings` are helpers of the cli layer.
- [**T6.11**](./DECISIONS.md#t6-11) — Quoted input is escaped and bounded.
- [**T6.12**](./DECISIONS.md#t6-12) — The reader names its own failures; a bug still crashes.
- [**T10.23**](./DECISIONS.md#t10-23) — The CLI's work is one function, `run`, shared by `main` and the web console.

## 4. Questions and assumptions (document all in README)

### Open

Every question is settled (listed below): those the base raised, and those
opened by planning the upgrades. A new one gets its current default and the
subtask that settles it ([T2.2](./DECISIONS.md#t2-2)).

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
- [**Q18**](./DECISIONS.md#q18) (T9.9) — The help text is built from the grammar table.
- [**Q19**](./DECISIONS.md#q19) (T9.10) — `--help` and `-h` are the only options, and win wherever they appear.
- [**Q20**](./DECISIONS.md#q20) (T9.12) — Commands come from a file; a bare run explains how.
- [**Q21**](./DECISIONS.md#q21) (T10.6) — A tie is one note on stderr, after the report.
- [**Q31**](./DECISIONS.md#q31) (T10.8) — A query is an option taking the next argument, and replaces the report.
- [**Q32**](./DECISIONS.md#q32) (T10.9) — `--partners` ranks partners strongest first; `--employees` lists employees alphabetically.
- [**Q33**](./DECISIONS.md#q33) (T10.10) — A company never declared is an error, after the input is read.
- [**Q22**](./DECISIONS.md#q22) (T10.12) — The server in `src/ui/`, the page in `web/`, bundled into `dist/web/`.
- [**Q23**](./DECISIONS.md#q23) (T10.13) — A real server in the tests; the page's DOM code untested.
- **Q24** (T10.16) — Withdrawn: the UI has no server, so there is nothing to keep local.
- [**Q25**](./DECISIONS.md#q25) (T10.17) — Workspace names are letters, digits, `_` and `-`, then `.txt`.
- [**Q26**](./DECISIONS.md#q26) (T10.18) — Every save raises a version; a save from an older copy is refused.
- [**Q30**](./DECISIONS.md#q30) (T10.19) — Files saved in `localStorage`, one key each; a refused save keeps the old file.
- [**Q28**](./DECISIONS.md#q28) (T10.23) — The CLI's work is one function over its arguments and its input.
- [**Q27**](./DECISIONS.md#q27) (T10.24) — The console is an xterm.js pane showing each run as a terminal would.
- [**Q29**](./DECISIONS.md#q29) (T10.25) — The editor marks what the CLI would warn about, discarded or pending; a file saves either way.
- [**Q34**](./DECISIONS.md#q34) (T10.27) — Playwright's test runner drives Chromium, from outside the page.
- [**Q35**](./DECISIONS.md#q35) (T10.28) — `npm run test:e2e` builds the page and tests it; `check` is unchanged.
- [**Q36**](./DECISIONS.md#q36) (T10.29) — One browser test per thing a person does with the page.

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
- [x] T7 — README (build/run/test, approach, LLM usage, every §3 decision
      and Q) and the shipped examples.
  - [x] T7a — Build, run, and test: Node 22.13+, `npm install`,
        `npm run check`, `npm run build`, and every run form in T1.10, including
        interactive entry (brief 3, 7.1).
  - [x] T7b — Approach and design: the four layers and T1.10–T1.13 with
        their tradeoffs, linking to DECISIONS (brief 7.2).
  - [x] T7c — How LLMs were used: workflow, what was accepted, modified, or
        rejected, citing DECISIONS Origin lines (brief 7.2.1).
  - [x] T7d — Assumptions and edge cases: every Q, flagging where the brief
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
  - [x] T7e — Example inputs: one home in `examples/`, the brief's file moved
        there ([T7.4](./DECISIONS.md#t7-4)), and four more showing what its
        output cannot — late declarations, ties and sort order, namespaces and
        repeats, and every warning. Each asserted for exact stdout and stderr,
        and listed in the README ([T7.5](./DECISIONS.md#t7-5)).
- [x] T8 — Final pass: naming, comments, tradeoff notes.
  - [x] T8a — Code read-through: naming, comments that cite DECISIONS IDs,
        no placeholder text or dead code.
  - [x] T8b — Docs consistency: PLAN §3–§4 index matches DECISIONS, no
        questions left open, README covers every §3 decision and Q,
        deferred ideas are in UPGRADES.
  - [x] T8c — Walk BRIEF requirements 1–7 and §7, recording the test or
        command that shows each is met.
  - [x] T8d — Clean-clone check: `npm ci`, `npm run check`, `npm run build`,
        then run `node dist/bin.js examples/input.txt` and the piped form.
  - [x] T8e — Audit follow-up: literal byte-order marks kept in the reader
        tests ([T8.3](./DECISIONS.md#t8-3)); file paths and I/O errors
        escaped ([T8.4](./DECISIONS.md#t8-4)); a slow stderr's memory cost
        recorded ([T8.5](./DECISIONS.md#t8-5)); the ESLint version in
        `eslint.config.js`'s comment corrected; coverage deferred to
        [U8](./UPGRADES.md#u8).
- [x] T9 — Upgrades: work beyond the brief, one or more subtasks per
      [UPGRADES](./UPGRADES.md) entry, in the order built
      ([T9.1](./DECISIONS.md#t9-1)). The base submission is tagged
      `base-submission`, and nothing below changes what it answers. The
      upgrades still to build are T10 ([T10.5](./DECISIONS.md#t10-5)).
  - [x] T9a — [U7](./UPGRADES.md#u7): tag the base submission, and name the
        tag in the README ([T9.2](./DECISIONS.md#t9-2)). Pushing the tag is
        left to me.
  - [x] T9b — [U8](./UPGRADES.md#u8): `npm run coverage` reports lines and
        branches; not a gate in `npm run check`
        ([T9.3](./DECISIONS.md#t9-3)).
  - [x] T9c — [U5](./UPGRADES.md#u5): `--help`, `-h`, and a usage line after
        a bad invocation, with the shared help text. Settles Q18 and Q19.
  - [x] T9d — [U6](./UPGRADES.md#u6), reshaped: commands come from a file,
        named or piped, and are never typed; a run at a terminal with no file
        prints U6's explanation to stdout and exits 1
        ([T9.12](./DECISIONS.md#t9-12)). Settles Q20.
  - [x] T9e — Warnings in line order: every warning prints once, after
        input ends, sorted by line number, now that typed input no longer
        needs a bad line answered as it is read
        ([T9.13](./DECISIONS.md#t9-13)).
- [ ] T10 — The remaining upgrades: a tie note, queries about one company,
      and [U9](./UPGRADES.md#u9)'s page, running in the browser alone, with
      [U1](./UPGRADES.md#u1)'s builder as its editor, then
      [U11](./UPGRADES.md#u11)'s browser tests of that page
      ([T10.1](./DECISIONS.md#t10-1), [T10.5](./DECISIONS.md#t10-5),
      [T10.16](./DECISIONS.md#t10-16), [T10.22](./DECISIONS.md#t10-22)). The
      tie note and the queries come first, so the console is built against
      the program's final outputs. [U12](./UPGRADES.md#u12), writing back to
      a file opened from disk, is not part of T10.
  - [x] T10a — [U4](./UPGRADES.md#u4): note a tie without changing the
        report line or ranking tied partners
        ([T10.3](./DECISIONS.md#t10-3)). Settles Q21.
  - [x] T10b — [U10](./UPGRADES.md#u10): `--partners` and `--employees`
        queries about one company, with the help text and README run forms
        updated ([T10.4](./DECISIONS.md#t10-4)). Settles Q31, Q32 and Q33.
  - [x] T10c — U9, scaffold: layout, a second tsconfig for the browser, the
        Vite build, `npm run ui`, and the test setup, with an empty page
        served and `npm run check` covering the new code. Settles Q22 and
        Q23.
  - [x] T10d — U9, workspace: the examples bundled into the page,
        read-only; workspace files kept in browser storage, created, read,
        saved and deleted; names for files from disk or copied examples
        ([T10.16](./DECISIONS.md#t10-16)). In modules with no DOM, tested in
        vitest ([T10.13](./DECISIONS.md#t10-13)). Settles Q25, Q26 and Q30.
  - [x] T10e — U9, files panel: the examples and workspace files listed, a
        read-only viewer, open from disk, download, deletion with
        confirmation, and "copy to workspace" on an example, with the DOM
        code for opening and downloading ([T10.19](./DECISIONS.md#t10-19)).
  - [x] T10f — U9, console: an xterm.js pane running herbie-lite only
        ([T9.5](./DECISIONS.md#t9-5)) on a listed file, in the page, showing
        its report and warnings, before the editor so a file can be run as
        soon as it is listed ([T10.20](./DECISIONS.md#t10-20)); it takes no
        typed commands
        ([T9.12](./DECISIONS.md#t9-12)). Settles Q27 and Q28.
  - [x] T10g — U1, the in-browser file editor ([T10.2](./DECISIONS.md#t10-2)):
        create and edit workspace files as text, with the command reference
        from `help.ts` beside it ([T9.12](./DECISIONS.md#t9-12)), each line
        checked as it is edited, pending references across the file, and
        saving into the workspace. Settles Q29.
  - [x] T10h — [U11](./UPGRADES.md#u11): end-to-end tests that load the
        built page in a browser and use it as a person does, once the editor
        exists ([T10.22](./DECISIONS.md#t10-22)). Settles Q34, Q35 and Q36.
  - [ ] T10i — README: how to start the UI, what it can and cannot do
        (browser only, files saved as downloads, examples read-only), how to
        run the browser tests, and the "Beyond the brief" section brought up
        to date ([T10.11](./DECISIONS.md#t10-11)), with
        [U12](./UPGRADES.md#u12) named as not built
        ([T10.22](./DECISIONS.md#t10-22)).

## 7. Definition of done

- `examples/input.txt` from the brief produces exactly:
  ```
  ACME: No current relationship
  Globex: Chris (2)
  Hooli: Molly (1)
  ```
- Runs via file arg, STDIN, and interactive entry (typed input is STDIN with
  no argument; the base prints no hint, [T6.13](./DECISIONS.md#t6-13)). This
  is the base's definition; after it, typed input is refused
  ([T9.12](./DECISIONS.md#t9-12)).
- Malformed and unresolved lines produce stderr warnings, the report still
  prints, and the exit code is 0 (Q5, Q7, Q8).
- `npm run check` passes (typecheck, lint, format, tests).
- Tests cover parser, network, report, and `cli` end-to-end, and every file in
  `examples/` is asserted for exact stdout and stderr ([T7.5](./DECISIONS.md#t7-5)).
- README covers every entry in §3–§4.

---

## 8. Requirements → evidence (T8c)

Every requirement in the [brief](./BRIEF.md), with the test or command that
shows it is met. Test names are as `npm test -- --reporter=verbose` prints
them. Recorded here rather than in the README ([T8.2](./DECISIONS.md#t8-2)).

| Brief | Requirement                                                           | Evidence                                                                                                                                                                      |
| ----- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | One command per line, space-separated words                           | `parser.test.ts` › "parseLine › each command"; whitespace (Q10) and letters-only (Q9) groups                                                                                  |
| 1.1   | `Partner <Name>`                                                      | `parser.test.ts` › `parses "Partner Chris"`                                                                                                                                   |
| 1.2   | `Company <Name>`                                                      | `parser.test.ts` › `parses "Company Globex"`                                                                                                                                  |
| 1.3   | `Employee <Name> <CompanyName>`                                       | `parser.test.ts` › `parses "Employee Laurie Globex"`                                                                                                                          |
| 1.3.2 | Company declared before its employees (assumable)                     | Accepted in either order: `network.test.ts` › "resolves an employee declared before their company (Q5)"; `examples/late-declarations.txt`                                     |
| 1.3.3 | Employee names are globally unique                                    | `network.test.ts` › "keeps the first of two declarations of one name (Q12, Q13)"; `warnings.test.ts` › "treats the same employee at another company as a claim, not a repeat" |
| 1.4   | `Contact <EmployeeName> <PartnerName> <ContactType>`                  | `parser.test.ts` › `parses "Contact Laurie Chris email"`, and one per contact type                                                                                            |
| 1.4.3 | Only `email`, `call`, `coffee` are accepted                           | `parser.test.ts` › "contact types (FR1)" (5 rejections); `warnings.test.ts` › "lists the contact types for a bad one (FR1)"                                                   |
| 2     | Error handling as appropriate                                         | `cli.test.ts` › "warns on stderr, prints the report, and exits 0"; `examples/warnings.txt`, whose every warning is asserted                                                   |
| 3     | Executable from the command line, file and/or STDIN                   | `cli.test.ts` › "the program as a process (brief 3, PLAN §7)", both tests; run forms in the README, checked on a clean clone (T8d)                                            |
| 4     | Output printed to the console                                         | The same two process tests capture stdout; `cli.test.ts` › "ends the report with exactly one newline"                                                                         |
| 5     | All companies, sorted alphabetically                                  | `report.test.ts` › "company order (Q14)", both tests                                                                                                                          |
| 5     | Each company lists its strongest partner and the strength             | `report.test.ts` › "names the strongest partner, not the first or the last"; equal strengths in `examples/ties.txt`                                                           |
| 5.1   | Strength = all contacts between a partner and the company's employees | `report.test.ts` › "sums a partner's contacts across all employees of the company"; "counts every contact as 1, whatever its type"                                            |
| 6.1   | `<CompanyName>: <PartnerName> (<RelationshipStrength>)`               | `report.test.ts` › "produces the expected output from the shipped examples/input.txt"                                                                                         |
| 6.2   | `<CompanyName>: No current relationship`                              | `report.test.ts` › "companies with no relationship (Q2)", 3 tests; `examples/names-and-repeats.txt`                                                                           |
| 7.1   | README: build, run, and test instructions                             | [README](../README.md) § "Build, run, and test"; verified on a clean clone (T8d)                                                                                              |
| 7.2   | README: approach and design decisions                                 | [README](../README.md) § "How it works", with [DECISIONS](./DECISIONS.md) behind it                                                                                           |
| 7.2.1 | README: how LLM tools were used                                       | [README](../README.md) § "How I used LLM tools", and the **Origin** line on every entry in [DECISIONS](./DECISIONS.md)                                                        |
| 7.3   | README: assumptions and edge cases                                    | [README](../README.md) § "Assumptions and edge cases", covering Q1–Q17                                                                                                        |
| 7.3.1 | README: interpretations where the brief was unclear                   | The five rows marked † in that section: Q1, Q9, Q12, Q13, Q14                                                                                                                 |
| §7    | The brief's example produces the expected three lines                 | `report.test.ts` › "the brief's example (PLAN §7)"; `cli.test.ts` › both process tests; `node dist/bin.js examples/input.txt`                                                 |
