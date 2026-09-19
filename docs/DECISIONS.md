# Herbie Lite — Decision Log

Chronological record of decisions made while building this submission — the
"what, when, and why" behind the code. Newest entries at the bottom of each
stage. This is the **source of truth for resolved decisions**; the
[plan](./PLAN.md) holds forward-looking design notes and still-open questions
(PLAN §4), which graduate to entries here once resolved.

Each entry: **Decision** · **Context** · **Why** (incl. alternatives rejected)
· **Origin** · **Supersedes** (if it revises an earlier entry).

**Origin** records who first proposed the option that was chosen. Ownership is
always mine; this records where the idea came from.

- `Mine` — I proposed it, or chose an option the LLM didn't recommend (note what
  it recommended).
- `LLM-suggested, accepted` — optionally note if asking for its reasoning changed
  the suggestion.
- `LLM-suggested, modified` — note what I changed.
- `LLM-suggested, rejected`

When a decision changes, add a new entry with **Supersedes:** <old ID>, and add
**Superseded by** <new ID> to the old entry. Entries without that line are
active. When only part of an entry changes, the new entry names that part
(**Supersedes:** Q5, first bullet) and the old entry gets **Superseded in
part by** <new ID>, naming the same part; the rest of the old entry stays
active. What an old entry says is never edited; its heading and the IDs
it cites may be updated when IDs are restructured (T3.1).

## Key

Every entry has one ID, and its heading starts with it.

- `S<n>`: setup, decided before any task.
- `T<n>.<m>`: a decision recorded in task T<n> of PLAN §6, numbered in the
  order made. Decisions from reviewing a task go in that task's section,
  with **Context:** "T<n> review". There is no separate review section.
- `Q<n>`: a question from PLAN §4. It keeps the number it was opened with,
  which code comments and the README cite. When a task settles it, it gets
  a T ID in that task's section and the heading shows both:
  `T3.2 — Q10: Whitespace within a line`.
- Subtasks (`T3a`) name PLAN work, not decisions (T2.1). `U<n>` names an idea
  deferred to [UPGRADES](./UPGRADES.md).
- Each heading has an anchor for its T ID (`#t3-2`) and, if it has one, its
  Q (`#q10`).

---

## Setup — language & framing

### <a id="s1"></a>S1 — Language: TypeScript on Node.js

- **Decision:** Implement in TypeScript, run on Node.js.
- **Context:** Brief says pick your strongest language, explicitly _not_ one from
  Drive's stack for its own sake.
- **Why:** Strong typing supports the domain modelling (discriminated unions,
  exhaustiveness) that this problem rewards; fast, familiar dev loop. Mainstream,
  easy for a reviewer to run.
- **Origin:** Mine.

---

## T0 — Tooling

### <a id="t0-1"></a>T0.1 — Toolchain: `tsx` + `vitest` + `tsc`, npm

- **Decision:** `tsx` to run `.ts` directly, `tsc` to build `dist/` and to
  type-check (`--noEmit`), `vitest` for tests, `npm` as package manager.
- **Context:** Need a fast dev loop _and_ a real build artifact for a submission.
- **Why:** `tsx` runs without a compile step but skips type-checking, so `tsc`
  is kept as a separate `typecheck` gate. `vitest` is TS-native, zero-config,
  Jest-style. Alternatives (ts-node, jest+ts-jest) are slower/heavier to config.
- **Origin:** LLM-suggested, accepted.

### <a id="t0-2"></a>T0.2 — Modules: ESM with `NodeNext`

- **Decision:** `"type": "module"`; tsconfig `module` + `moduleResolution` =
  `NodeNext`.
- **Context:** Greenfield project on modern Node.
- **Why:** Native fit with vitest/modern deps; future-proof. **Tax accepted:**
  relative imports need explicit `.js` extensions (`./parser.js`), which the
  `typecheck` gate enforces at compile time.
- **Origin:** LLM-suggested, accepted.

---

<a id="t1"></a>

## T1 — Scaffold

T1.10–T1.21 were decided while reviewing T1, before implementation
started.

### <a id="t1-1"></a>T1.1 — Test layout: colocated

- **Decision:** Tests sit next to the unit under test (`src/foo.test.ts` beside
  `src/foo.ts`).
- **Why:** Keeps a module and its tests together; makes per-module coverage gaps
  obvious; common vitest default. Alternative (a separate `tests/` tree) keeps
  `src/` tidier but adds indirection for a 4-module codebase.
- **Origin:** LLM-suggested, accepted.

### <a id="t1-2"></a>T1.2 — Lint + format: ESLint (type-checked) + Prettier

- **Decision:** ESLint for correctness (type-checked rules via `projectService`),
  Prettier for formatting, reconciled with `eslint-config-prettier`.
- **Context:** PLAN §5 marked these optional.
- **Why:** Prettier gives a visible, un-bikeshedded formatting payoff at near-zero
  cost. ESLint adds a rigor signal and catches things like floating promises
  around async I/O. Cost noted: type-checked lint runs the type-checker (slower)
  and adds config surface — judged acceptable for the quality signal.
- **Note:** Prettier formats all Markdown except the **frozen `BRIEF.md`**,
  which `.prettierignore` excludes (CLAUDE.md constraint). Prettier keeps line
  breaks as written, so its Markdown changes are cosmetic: table alignment,
  `_italic_`, blank lines after headings.
- **Origin:** LLM-suggested, accepted.

### <a id="t1-3"></a>T1.3 — Build vs. type-check split

- **Decision:** Base `tsconfig.json` includes `*.test.ts` (so tests are
  type-checked); `tsconfig.build.json` excludes them so they don't reach `dist/`.
- **Why:** Want tests type-checked _and_ a clean build artifact — a single config
  can't do both. `build` → `tsc -p tsconfig.build.json`.
- **Note:** `npm run check` runs typecheck, lint, format check, and tests (fastest
  first, stopping at the first failure) and must pass before any commit. Build is
  left out, since typecheck already catches anything that would break it.
- **Origin:** LLM-suggested, accepted.

### <a id="t1-4"></a>T1.4 — Dropped `package.json` `bin` field

- **Decision:** Removed the `bin: { herbie-lite → dist/cli.js }` entry.
- **Context:** Surfaced in the T1 review — the entry promised an executable but
  `cli.ts` had no `#!/usr/bin/env node` shebang, so `npm link` invocation would
  break.
- **Why:** The brief only requires `node dist/bin.js input.txt` and STDIN; a bin
  is out of scope. Removing it is leaner than adding a shebang for a path the
  brief doesn't use.
- **Origin:** LLM-suggested, accepted.

### <a id="t1-5"></a>T1.5 — Compiler strictness

- **Decision:** `strict`, plus `noUncheckedIndexedAccess`,
  `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, and `noImplicitOverride`.
  `exactOptionalPropertyTypes` removed.
- **Context:** Surfaced in the T1 review. The design looks names up constantly
  (Q5, Q8) and switches over command kinds (T1.12).
- **Why:** The compiler is the first line of defense. `noUncheckedIndexedAccess`
  types every lookup as `T | undefined`, so a missing employee or partner can't
  be forgotten; cost is more narrowing code at lookups.
  `noFallthroughCasesInSwitch` guards the per-command switch.
  `verbatimModuleSyntax` keeps ESM output predictable (T0.2).
  `noImplicitOverride` never fires without class inheritance, so it's free, and
  it guards against a mistake if inheritance appears. **Rejected:**
  `exactOptionalPropertyTypes`. It separates "property missing" from "property
  set to `undefined`", which nothing here relies on, and it forces workarounds
  such as `file === undefined ? {} : { file }` for the CLI's optional file
  argument.
- **Origin:** LLM-suggested, accepted. The LLM first proposed also removing
  `noImplicitOverride`; asking for its reasoning led it to revise that and keep
  it.

### <a id="t1-6"></a>T1.6 — Separate executable entry (`bin.ts`) from `cli.ts`

- **Decision:** `src/cli.ts` exports `main` and runs nothing on import.
  `src/bin.ts` is the executable entry and only calls `main`. `start` runs
  `tsx src/bin.ts`; the built program is `node dist/bin.js`.
- **Context:** Surfaced in the T1 review. `cli.ts` was both the entry point and
  the module tests import, and decided whether to run by comparing
  `process.argv[1]` to its own path. Run through a symlinked path, that
  comparison failed: the program exited 0 and printed nothing.
- **Why:** With a logic-free entry file, nothing has to detect how the module was
  loaded, which removes the bug class instead of patching it. Rejected:
  comparing real paths (`realpathSync`) in one file; smaller, but keeps a
  subtle check that every reader has to reason about.
- **Origin:** LLM-suggested, accepted.

### <a id="t1-7"></a>T1.7 — Supported Node version: 22.13 and later

- **Decision:** `engines.node` is `>=22.13` (was `>=20`). The `.13` comes from
  the T1.9 upgrade: eslint 10 needs 22.13 and vitest 5 needs 22.12.
- **Context:** Surfaced in the T1 review. `eslint.config.js` uses
  `import.meta.dirname`, which Node 20 only added in 20.11, so `>=20` was wrong.
- **Why:** Node 20 reached end of life in April 2026; Node 22 is maintained. 22
  is the version everything is tested on, and `@types/node` is already on 22, so
  the compiler checks against the APIs the floor guarantees. Rejected: `>=20.11`,
  the tooling minimum, which claims support for an unmaintained, untested
  runtime. Risk accepted: npm only warns on `engines`, so a Node 20 user gets a
  warning, not a blocked install.
- **Origin:** LLM-suggested, accepted. The LLM first recommended `>=20.11`
  (listing `>=22` as an alternative); asking about the risk of `>=22` led it to
  recommend 22.

### <a id="t1-8"></a>T1.8 — Package and build settings

- **Decision:** `package.json` gets `"private": true` and loses
  `"license": "MIT"`. `tsconfig.json` drops `"declaration": true`; `sourceMap`
  stays.
- **Context:** Surfaced in the T1 review.
- **Why:** `private` makes npm refuse to publish, so the submission can't be
  pushed to the public registry by accident. The MIT license was a template
  leftover that would grant anyone reuse rights to interview code, and npm
  doesn't require a license on private packages. `.d.ts` files only serve
  packages that import this code as a library, and nothing imports a CLI; source
  maps stay because they point stack traces at the TypeScript source.
- **Origin:** LLM-suggested, accepted.

### <a id="t1-9"></a>T1.9 — Dependencies on current major versions

- **Decision:** vitest 5 (with `vite` 8 as an explicit dev dependency), eslint
  and `@eslint/js` 10, `eslint-config-prettier` 10, `typescript-eslint` 8.70,
  TypeScript `~6.0.3`. `tsconfig.json` adds `"types": ["node"]`. `@types/node`
  stays on 22 to match the Node floor (T1.7).
- **Context:** Surfaced in the T1 review: the scaffold was two to three major
  versions behind on vitest, eslint and TypeScript. Trialled on a scratch copy
  first; `npm run check`, build, and the built program all passed.
- **Why:** No application code exists yet, so this is the cheapest point to
  upgrade. Three adjustments were needed: vitest 5 takes `vite` as a peer
  dependency instead of bundling it; TypeScript is capped at 6.0 because
  `typescript-eslint` supports `<6.1` (TypeScript 7 rejected until it does); and
  TypeScript 6 no longer loads `@types/*` automatically, hence `types: ["node"]`.
  Rejected: staying on the scaffold's versions, which would start the project
  behind and force a migration later.
- **Origin:** LLM-suggested, accepted.

### <a id="t1-10"></a>T1.10 — Input: file argument, STDIN, and interactive entry

- **Decision:** Accept a file path argument, or read STDIN when none is given.
  When STDIN is a terminal (no file, nothing piped), print a one-line hint to
  stderr ("Enter commands, one per line; press Ctrl+D to finish."), warn on each
  bad line as it is typed (Q7), and print the report when input ends.
  ```
  npm start -- input.txt          # dev: runs src/ via tsx
  cat input.txt | npm start       # dev: STDIN
  node dist/bin.js input.txt      # after npm run build
  cat input.txt | node dist/bin.js
  ```
- **Context:** The brief allows file, STDIN, or both, and its examples are a file
  and a pipe.
- **Why:** File and STDIN are cheap and match the brief's examples. Interactive
  entry goes beyond the brief but costs almost nothing: typing into a terminal
  is still STDIN, so the only extra code is the startup hint, which keeps the
  program from looking frozen. Q7 means a mistyped line is warned about and
  skipped rather than ending the session. Rejected: printing usage and exiting
  when STDIN is a terminal. A fuller guided file builder is logged as
  [UPGRADES U1](./UPGRADES.md#u1).
- **Origin:** Interactive entry: Mine (LLM recommended files and pipes only,
  with interactive entry moved to UPGRADES). File/STDIN run commands:
  LLM-suggested, accepted.

### <a id="t1-11"></a>T1.11 — Layered architecture

- **Decision:** Four layers, pure logic separate from I/O:
  1. `parser` — line → typed `Command` (a discriminated union), or a
     malformed-line result (Q7).
  2. `network` — the domain model; applies commands, holds state, resolves
     pending employees and contacts at end of input (Q5, Q8).
  3. `report` — pure function: network → sorted output lines.
  4. `cli` — thin I/O shell: read source, wire the layers, print.
- **Why:** Every layer except `cli` is testable without files or processes.
- **Origin:** LLM-suggested, accepted.

### <a id="t1-12"></a>T1.12 — Commands as a discriminated union

- **Decision:** `Command` is a TypeScript discriminated union on the command kind.
- **Why:** Exhaustiveness checking means adding a command type makes the compiler
  flag every place that must handle it.
- **Origin:** LLM-suggested, accepted.

### <a id="t1-13"></a>T1.13 — Store raw facts; compute at report time

- **Decision:** `network` holds partners, companies, employee → company, and the
  list of contacts. After input ends, pending employees and contacts are
  resolved (Q5, Q8); `report` then computes each company's strongest partner
  from the contacts.
- **Why:** Pre-summed per-company/per-partner tallies (rejected) can't be built
  while reading, since contacts aren't resolvable until input ends, and they
  discard the raw contacts that the brief's other product questions ("who do we
  know at ACME?") would need. Cost: one read of the input plus one resolution
  pass; O(lines) with map lookups.
- **Origin:** LLM-suggested, accepted.

### <a id="t1-14"></a><a id="q2"></a>T1.14 — Q2: Companies with no relationship

- **Decision:** A company whose employees have zero contacts, or that has no
  employees, prints `<CompanyName>: No current relationship`.
- **Why:** Strength 0 is not a relationship.
- **Origin:** LLM-suggested, accepted.

### <a id="t1-15"></a><a id="q3"></a>T1.15 — Q3: Drive Capital never appears in the output

- **Decision:** Only `Company`-declared companies are listed, so Drive Capital
  never appears.
- **Why:** It is never declared via `Company`, and it can't be: names are single
  words, so `Company Drive Capital` is not expressible (`Company DriveCapital`
  would just be an ordinary company).
- **Origin:** LLM-suggested, accepted (the conclusion and, later, the
  single-word argument).

### <a id="t1-16"></a><a id="q4"></a>T1.16 — Q4: Names are case-sensitive

- **Decision:** `Chris` and `chris` are different names.
- **Why:** The brief gives no reason to fold case; exact matching is the least
  surprising and simplest rule.
- **Origin:** LLM-suggested, accepted.

### <a id="t1-17"></a><a id="q5"></a>T1.17 — Q5: Duplicate and conflicting declarations

- **Decision:**
  - An exact repeat (same command, same words) is ignored without a warning.
  - An `Employee` declared again at a _different_ company breaks the brief's
    global-uniqueness rule: the first valid declaration wins, and the later line
    is discarded with a Q7-style warning.
  - An `Employee` whose company hasn't been declared yet is held until all input
    is read, like contacts in Q8. If the company is declared later, the employee
    is accepted; if not, the employee is discarded with a warning (line number,
    the line, the unknown company), printed before the report.
  - Resolution at end of input runs in input order: employees first, then
    contacts. A contact naming a discarded employee gets the Q8 warning. "First
    valid declaration" is judged after resolution, so an unresolvable earlier
    line doesn't block a later valid one.
  - Blank lines are skipped (Q6).
- **Why:** Exact repeats are harmless. Holding employees is more lenient than the
  brief's company-first guarantee requires, but it tolerates any declaration
  order at no extra cost, since contacts are already held (Q8).
- **Origin:** LLM-suggested, modified. LLM proposed warning immediately on an
  employee with an undeclared company; I chose to hold it until end of input.
  End-of-input ordering detail: LLM-suggested, accepted.
- **Superseded in part by** [Q13](#q13) (first bullet: exact repeats) and
  [Q12](#q12) (second and fourth bullets: name conflicts now span partners
  and employees, so partners are resolved with employees).

### <a id="t1-18"></a><a id="q6"></a>T1.18 — Q6: Error handling depth

- **Decision:** Every malformed line gets the Q7 handling. Blank lines are
  skipped without a warning.
- **Context:** The brief allows "as much or as little as appropriate".
- **Why:** One rule for every kind of bad line is simpler to explain, implement,
  and test than a rule per case.
- **Origin:** LLM-suggested, accepted.

### <a id="t1-19"></a><a id="q7"></a>T1.19 — Q7: Malformed lines: discard, warn, continue

- **Decision:** A malformed line (unknown command, wrong number of words, a word
  that isn't letters-only per Q9, or a contact type other than
  `email|call|coffee`) is discarded as soon as it is read, with a stderr warning
  giving the line number, the line itself, and the expected format for that
  command (or the list of valid commands if the command is unknown). Processing
  continues, the report is always printed, and the exit code stays 0.
- **Context:** The brief says the program "should only accept" the three contact
  types.
- **Why:** A bad line should never discard the report or stop the user early.
  Rejected: failing on the first error, and reporting all errors then failing;
  both withhold the report. **Known tradeoff:** a discarded contact lowers that
  partner's strength, and a close result or tie can then name a different
  partner. The warning is the user's signal that the report may be affected.
- **Origin:** Mine. The LLM first proposed skip-and-warn, then (after walking
  through how a skipped contact can change the named partner) recommended
  failing fast, then reporting every error before failing. I chose to discard
  each bad line immediately, warn with the expected format, and never withhold
  the report. Exit code 0: LLM-suggested, accepted.

### <a id="t1-20"></a><a id="q8"></a>T1.20 — Q8: Contacts resolved after all input

- **Decision:** Contacts are resolved after all input is read, so declaration
  order doesn't matter. A contact still unresolved at the end is discarded with
  a stderr warning (line number, the line, which name is unknown), printed
  before the report. Exit 0, as Q7. In interactive mode this warning appears at
  Ctrl+D, not as the line is typed.
- **Context:** The brief only guarantees company-before-employee, and its own
  example declares a Partner after Contacts.
- **Why:** A valid-per-brief file must never lose contacts because of line
  order. Rejected: requiring names to be declared first, which gives instant
  feedback but can misread valid input.
- **Origin:** LLM-suggested, accepted.

### <a id="t1-21"></a><a id="q9"></a>T1.21 — Q9: A word is letters only

- **Decision:** Words match `[A-Za-z]+`. The README notes this interpretation.
- **Context:** The brief says "the upper- and lowercase characters A thru z".
- **Why:** Read literally as an ASCII range, `A`–`z` would also include
  `[ \ ] ^ _` and a backtick (codes 91–96); "upper- and lowercase characters"
  makes letters the clear intent.
- **Origin:** LLM-suggested, accepted (README note included).

---

## T2 — Types

### <a id="t2-1"></a>T2.1 — Break T2–T8 into lettered subtasks

- **Decision:** Each of T2–T8 in PLAN §6 gets 2–5 subtasks, ordered by when they
  are built and grouped by subject. Subtasks are lettered (`T2a`, `T2b`, …),
  are more specific than their parent, and name the D/Q entries they
  implement.
- **Context:** Before starting T2. The one-line tasks were too coarse to show
  progress or to decide where a commit should end.
- **Why:** Small, ordered subtasks make natural commit boundaries within one
  task (CLAUDE.md), and put each unsettled question next to the code that
  depends on it. Letters, not `T2.1`-style numbers, because dotted IDs already
  name decision entries (T1.1–T1.9), and numbered subtasks would collide with
  them. Rejected: a separate "write tests" subtask per task, since CLAUDE.md
  puts a change's tests in the same commit as the change.
- **Origin:** Breakdown and its 2–5 subtask shape: Mine. Subtask contents and
  lettered IDs: LLM-suggested, accepted.

### <a id="t2-2"></a>T2.2 — Open questions live in PLAN §4, cross-linked to subtasks

- **Decision:** Every open question is a numbered Q in PLAN §4 with a default
  and the subtask that settles it ("Settle in T3a"); that subtask in §6 names
  it back ("Settles Q10"). Once settled, the question gets a DECISIONS entry
  and moves to §4's Decided list. Q10–Q15 were added this way from the
  questions T2.1's breakdown surfaced, and Q1 now points at T5b.
- **Context:** The first draft of T2.1 wrote these questions inline in the
  subtasks, which kept them next to their task but outside the Q numbering
  that the README (T7d) and the definition of done rely on.
- **Why:** The question and its default are written once, so they can't drift
  apart, and both directions stay one lookup away: from a task to what it must
  decide, and from a question to where it is decided. Q1 already worked this
  way ("Confirm in T5"). Rejected: questions only inside subtasks (no stable
  ID to cite from README or code comments), and questions only in §4 with no
  back-link (a task could be finished with its question still open).
- **Origin:** Adding them to §4: Mine. Cross-link format: LLM-suggested,
  accepted.

### <a id="t2-3"></a>T2.3 — Types live in the layer that owns them

- **Decision:** `Command`, `ContactType`, and the per-line parse result are
  exported from `parser.ts`; `Network` and the resolution warnings from
  `network.ts`. `assertNever` has its own module, `assert-never.ts`, because
  every layer may use it.
- **Context:** T2a. The types come before the code that uses them (T3–T6).
- **Why:** Each type sits beside the code that produces it, so imports follow
  the layer order in T1.11 (`network` imports from `parser`, never the
  reverse).
  Rejected: one shared `types.ts`, which every module would import, and which
  tends to collect unrelated types over time.
- **Origin:** LLM-suggested, accepted.

### <a id="t2-4"></a>T2.4 — Command and contact-type shapes

- **Decision:** `CONTACT_TYPES` is a `const` list; `ContactType` is derived from
  it, and `isContactType` checks against it. `Command` is discriminated on
  `kind`, whose values are the input keywords (`"Partner"`, …), with named,
  read-only fields; the contact's field is `contactType`.
- **Context:** T2b, T2c.
- **Why:** One list feeds the type, the parser's check (T3d), and the warning
  text, so adding a contact type is a one-line change. Keywords as `kind`
  values mean the parser and warnings use the same strings as the input.
  Named fields (`employee`, `partner`) instead of positional words make the
  network code read like the brief. Read-only fields because a command is a
  record of an input line and is never changed. `contactType`, not `type`,
  so it doesn't read like TypeScript's `type`.
- **Origin:** LLM-suggested, accepted.

### <a id="t2-5"></a>T2.5 — Parser and network return data; cli writes text

- **Decision:** A parsed line is `command`, `malformed`, or `blank`
  (discriminated on `outcome`), and carries its `SourceLine` (1-based line
  number and raw text). `malformed` holds a reason code and, unless the
  keyword is unknown, the command's `kind`; the type allows no other
  combination. The parser exports its grammar as data, `COMMAND_SYNTAX`
  (each command's argument names); the parser's word count (T3c) and the
  warning's expected format and list of valid commands are all derived from
  it. `NetworkWarning` likewise holds a problem code and the data involved.
  An unresolved contact (Q8) lists one failure per slot, never none, each
  with its role (`employee` or `partner`), the name, and a cause:
  `undeclared`, or `wrong-role` when the name is the other kind of person
  (Q12). Turning these into warning messages is left to `cli` (T6). `Network` is a
  read-only view of resolved facts; pending partners, employees, and
  contacts stay private to the network layer and reuse `SourcedCommand`.
- **Context:** T2d, T2e. Q5, Q7, and Q8 all need the line number and line in
  their warnings. Q7 also needs each command's expected format.
- **Why:** Codes can be asserted in parser and network tests without matching
  exact wording, and the wording changes in one place. `outcome` is used
  instead of a second `kind` so `line.outcome` and `line.command.kind` can't
  be confused. The grammar table keeps the command syntax in one place, as
  `CONTACT_TYPES` does for contact types (T2.4). Rejected: returning finished
  message strings from each layer, which spreads output wording across three
  modules; a finished expected-format string from the parser (the first
  draft), for the same reason; and format strings written in `cli`, which
  describe the grammar a second time, where they can drift from the parser.
  Per-slot contact failures let a swapped line (`Contact Chris Laurie email`)
  say which person is in the wrong role, instead of calling two known names
  unknown. Rejected: a plain list of unknown names (the first draft), which
  lost the role and allowed an empty list.
- **Origin:** LLM-suggested, accepted. The grammar table and the per-slot
  contact failures came from reviewing the first draft, which had the parser
  return the expected format as text and the network list unknown names
  without their role.

### <a id="t2-6"></a><a id="q13"></a>T2.6 — Q13: Repeated commands: contacts count, declarations warn

- **Decision:** Every `Contact` line is one interaction and counts toward
  strength, even when it repeats an earlier line word for word. A
  `Partner`, `Company`, or `Employee` line that declares a name already
  declared is discarded with a warning naming the declaration that stands
  (the first valid one, Q5). This covers exact repeats too.
- **Context:** T2 review. Q5 ignored every exact repeat silently, which
  would have dropped repeated contacts, while the plan's T4 subtasks
  already assumed contacts count.
- **Why:** A declaration says that a person or company exists, and each one
  exists once, so a second declaration is a data error the user may want to
  fix; a warning surfaces the overlap instead of hiding it. A contact is an
  event, and the same kind of interaction can happen many times; the brief
  defines strength as the "total amount of Contacts". **Known tradeoff:** a
  contact recorded twice by mistake counts twice, because the input has no
  field that tells a real repeat from a duplicate record. The README notes
  this (T7d). Rejected: ignoring repeated declarations silently (Q5's
  original rule), and ignoring repeated contacts.
- **Supersedes:** [Q5](#q5), first bullet.
- **Origin:** Contacts count and declarations don't: Mine. Warning on
  repeated declarations: Mine, chosen over ignoring them silently. One
  `duplicate-declaration` warning that carries both the discarded and the
  standing declaration, replacing `employee-conflict`: LLM-suggested,
  accepted.

### <a id="t2-7"></a><a id="q12"></a>T2.7 — Q12: One name, one person

- **Decision:** Partners and employees share one namespace: a name belongs
  to at most one person. Companies have their own namespace: each company
  name is distinct (a repeat gets the Q13 warning), but it may match a
  person's name. Name claims are judged at end of input:
  partners and employees are resolved together in input order, the first
  valid declaration of a name stands, and any later `Partner` or `Employee`
  with that name is discarded with the Q13 warning. Partners are therefore
  held until end of input, like employees.
- **Context:** T2 review. The brief says employee names are "globally
  unique" and gives only an employee example; the earlier default read that
  as unique among employees, with a separate namespace per kind.
- **Why:** A name is the only identity in the input, so one name for one
  person keeps every reference unambiguous; `Contact` lines never have to
  rely on word position to tell a partner from an employee of the same name.
  Partners are held because Q5 judges "first valid declaration" after
  resolution: `Employee Sam Hooli` on line 2 must beat `Partner Sam` on
  line 9, which can't be known until the employee resolves. Rejected: a
  separate namespace per kind (the earlier default).
- **Supersedes:** [Q5](#q5), second and fourth bullets (conflicts were
  employee-only, and resolution ran employees before contacts without
  partners).
- **Origin:** One namespace for people: Mine. Companies kept separate:
  LLM-suggested, accepted. Holding partners until end of input:
  LLM-suggested, accepted.

---

## T3 — Parser

### <a id="t3-1"></a>T3.1 — Decision IDs: one T ID per entry, Q kept as a tag

- **Decision:** Every entry's ID is `T<n>.<m>`, in the section of the task
  that decided it (Key). D1–D4 become T1.10–T1.13 and the D prefix is
  retired. A decided question keeps its Q number as a tag beside its T ID.
  The T1 review section merges into T1 as T1.10–T1.21; later reviews add
  entries to their own task's section. Headings, and the IDs an entry
  cites, may be updated when IDs are restructured; what an entry says is
  never edited.
- **Context:** Before starting T3. Headings mixed three schemes (T, D, Q),
  and a D or Q heading didn't say which stage decided it. The T1 review had
  its own section, but the T2 review's decisions (Q12, Q13) sit in T2.
- **Why:** The heading alone shows which task made a decision, and one
  numbering covers every entry. A D ID had no lifecycle, so it was a second
  name for an ordinary entry. A Q does: it is cited by number while open
  (PLAN §4, code comments, the README), so it stays as a tag and no
  citation changes when it is settled. Reviews recorded in their task's
  section match how T2's review was already written. Rejected: keeping D
  as a tag (two IDs per entry for no gain); retiring a Q once decided,
  which renames a question when it is settled and changes about 30 code
  comments; a review section for every task.
- **Origin:** A T ID for every entry, merging the T1 review into T1, and
  showing the section in Q headings: Mine. Retiring D, keeping Q as a tag,
  and the Key: LLM-suggested, accepted. Recording it as a decision made
  before T3 started: Mine.

---

## Open questions

Open questions live in [PLAN §4](./PLAN.md#4-questions-and-assumptions-document-all-in-readme)
and move here once resolved.
