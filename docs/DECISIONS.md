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
active. Once the commit that adds an entry has landed, what it says is never
edited; its heading and the IDs it cites may be updated when IDs are
restructured (T3.1). Until that commit the entry is a draft, and revising it
while reviewing the change it belongs to is ordinary editing (T5.6).

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

### <a id="t3-2"></a><a id="q10"></a>T3.2 — Q10: Whitespace within a line

- **Decision:** Words are separated by runs of spaces or tabs. Leading and
  trailing spaces and tabs are ignored, as is a trailing `\r` left by a CRLF
  file; the cli's reader may already remove it (T6c). A line with no words
  is blank (Q6). Any other whitespace, such as a non-breaking space, stays
  part of a word and so fails the letters-only check (Q9). The line's raw
  text is kept unchanged in `source`.
- **Context:** T3a. The brief says only "space-separated".
- **Why:** An extra space, a tab, or a file saved on Windows says nothing
  about the data, and under Q7 a discarded line lowers strengths; tolerating
  them costs one regular expression. Rejected: exactly one space between
  words, which matches the brief literally but discards lines over
  invisible formatting; and any Unicode whitespace (`\s`), which accepts
  characters the brief never mentions and is harder to state in the README.
  An unusual space still gets a warning rather than passing silently.
- **Origin:** LLM-suggested, accepted (the default recorded in PLAN §4,
  confirmed when T3 started).

### <a id="t3-3"></a><a id="q11"></a>T3.3 — Q11: Command keywords are case-sensitive

- **Decision:** A keyword must match exactly: `Partner`, `Company`,
  `Employee`, `Contact`. `partner Chris` is an unknown command, discarded
  with the warning that lists the valid commands (Q7).
- **Context:** T3b. Q4 covers names, not keywords.
- **Why:** Names (Q4) and contact types (T2.4, `Email` is rejected) are
  already exact, so one rule covers every word of a line. Rejected:
  case-insensitive keywords, which are friendlier but put keywords under a
  different rule from the other words and invite the question of why
  `Email` isn't accepted too. The unknown-command warning lists the correct
  spelling.
- **Origin:** LLM-suggested, accepted (the default recorded in PLAN §4,
  confirmed when T3 started).

### <a id="t3-4"></a>T3.4 — Parser checks: fixed order, first failure reported

- **Decision:** `parseLine(source)` takes a `SourceLine` and returns it
  unchanged in its result. Checks run in this order, and the first that
  fails is the one reported: keyword (`unknown-command`), word count against
  `COMMAND_SYNTAX` (`wrong-word-count`), letters-only names (`invalid-word`,
  Q9), then the contact type (`invalid-contact-type`). The contact-type
  word is checked only against `CONTACT_TYPES`, not the letters-only rule.
  Keywords are looked up among `COMMAND_SYNTAX`'s own keys. A malformed
  result names the reason, not the offending word.
- **Context:** T3c, T3d. A line can break several rules at once
  (`Contact L4urie Chris text`).
- **Why:** Words can't be matched to arguments until the count is right, so
  the count comes before any per-word check; names come before the contact
  type in the order they appear. One reason per line keeps the result type
  and the warning simple. Checking the contact type only against the closed
  set means `e-mail` gets the warning that lists `email|call|coffee`, which
  is more useful than "letters only". An own-key lookup stops words such as
  `constructor` or `__proto__`, which every object inherits, from being
  taken as commands. Naming the bad word was rejected: the warning quotes
  the whole line, which is at most four words, so it would change T2's types
  for little gain. **Known tradeoff:** a line broken by an invisible
  character (`Partner Chris\u00a0`) looks valid when quoted, so the
  warning alone doesn't show the cause; escaping such characters is
  [UPGRADES U3](./UPGRADES.md#u3).
- **Origin:** Check order, contact-type check, and own-key lookup:
  LLM-suggested, accepted. Reason only, without the word: LLM-suggested,
  accepted when asked.

## T4 — Network

### <a id="t4-1"></a>T4.1 — Project docs imported into every session's context

- **Decision:** `CLAUDE.md` pulls in [BRIEF](./BRIEF.md), [PLAN](./PLAN.md)
  and this log with `@` import lines, so every session starts with all three
  already loaded. [UPGRADES](./UPGRADES.md) is deliberately left out and
  stays a link. The bullet list of all four documents stays as it was, for a
  reader outside the tool.
- **Context:** Before starting T4. Until now `CLAUDE.md` only linked the
  documents, so which of them were actually read varied from session to
  session.
- **Why:** A link is an instruction that can be followed late or not at all,
  and an unread decision log is how a settled question gets re-opened or
  contradicted. An import is resolved before the first message, so it cannot
  be skipped. Importing UPGRADES would put deferred ideas in context during
  base work, against the scope rule in `CLAUDE.md`. The cost is roughly 14k
  tokens per session at today's sizes (BRIEF 6.7KB, PLAN 13KB, DECISIONS
  35KB); this log grows with every task, so its import is the first to drop
  if that becomes a problem. Rejected: a `SessionStart` hook in
  `.claude/settings.json`, which achieves the same thing with a shell script
  and a config file to maintain, and only earns that if the injection needs
  to be conditional; and trimming this log to keep it cheap to import, which
  would lose the record it exists to keep.
- **Origin:** LLM-suggested, accepted. I asked for a way to be sure the
  documents are read at the start of every session; the `@` import, leaving
  UPGRADES out, and the note about dropping the DECISIONS import if it grows
  too large were its suggestions.

### <a id="t4-2"></a>T4.2 — Log a decision when it is made, on a named threshold

- **Decision:** `CLAUDE.md` gains a **Decisions** section: an entry is written
  when the decision is made, including one made in conversation that changes
  no code yet. A decision is a choice where a reasonable alternative existed
  and the choice constrains later code or docs; the test is whether the
  rejected alternative can be named. The section routes each case to this log,
  [PLAN](./PLAN.md) §4, or [UPGRADES](./UPGRADES.md), and points reversals at
  **Supersedes**.
- **Context:** Before starting T4, with T4.1. `CLAUDE.md` asked for DECISIONS
  entries only in the Commits section, which tied logging to a commit and said
  nothing about what was worth logging.
- **Why:** A decision recorded at commit time is reconstructed rather than
  recorded, and one settled in conversation had no home at all until it
  reached code — this log's value to a reviewer is the reasoning at the moment
  of choosing. The threshold matches how this file is already written: every
  entry names a rejected alternative, so that test adds no new standard. The
  routing lines put the existing rules (T2.2 for open questions, `U<n>` for
  deferrals, **Supersedes** for reversals) where they are read at the start of
  every session (T4.1), instead of only inside the files they govern.
  Rejected: "record every decision" with no threshold, which either gets
  ignored or fills the log with entries that have no alternative to reject;
  and a `PostToolUse` or `Stop` hook that checks whether DECISIONS changed,
  which cannot tell a decision from an edit and would nag on every commit.
- **Origin:** Recording decisions as they are made, rather than at commit time:
  Mine. The named-alternative threshold, the exclusions, and the routing list:
  LLM-suggested, accepted.

### <a id="t4-3"></a>T4.3 — `buildNetwork`: apply in one pass, resolve in two

- **Decision:** The layer's entry point is
  `buildNetwork(commands: Iterable<SourcedCommand>): NetworkResult`, a
  function over the whole command stream rather than an object the cli feeds
  line by line. It applies each `Company` as it arrives, holds partners,
  employees, and contacts, then resolves people and contacts in that order
  (Q5, Q12), and returns `{ network, warnings }` with the warnings sorted
  back into input order by line number. One map of name → standing
  declaration holds the people namespace; `partners` and `employers` are
  derived from it once resolution ends. The tests build their input by
  running text through `parseLine`.
- **Context:** T4a–T4d. The subtasks are written as "apply" and "hold" steps,
  which reads like a stateful accumulator.
- **Why:** Nothing about a person or a contact can be decided until input
  ends (Q5, Q8, Q12), so a builder object would answer every query wrongly
  until `resolve` had been called; a function cannot be used in that order.
  The cli already holds every contact in memory (T1.13), so taking the
  commands as one iterable costs nothing extra: it collects them as it
  streams, warning on each malformed line as that line is read (Q7), and
  calls `buildNetwork` once input ends. `Iterable`, not `AsyncIterable`,
  keeps the domain layer synchronous and testable without I/O (T1.11); the
  cli's own reader is the only asynchronous part (T6c). A single namespace map
  matches Q12: two containers would need a third index to answer "is this
  name taken" and could drift apart, while deriving both views at the end
  makes `Network`'s stated invariant — a name is never both a partner and an
  employee — true by construction. Warnings are sorted because the passes run
  by kind, so concatenating them would print a duplicate company from line 40
  before an unknown company from line 4; a reader follows their file top to
  bottom. The order is total: a line yields at most one command and a command
  at most one warning, so no two warnings share a line. Driving the tests
  through the parser lets each case be written as the input file a user would
  type, with assertable line numbers, at the cost of a parser bug being able
  to fail a network test. Rejected: a stateful builder with `apply` and
  `resolve`; separate partner and employee maps; each pass's warnings
  concatenated in pass order; and hand-built `SourcedCommand` literals in the
  tests, which are three lines each and hide the line numbers the warnings
  are asserted on.
- **Origin:** LLM-suggested, accepted.

### <a id="t4-4"></a>T4.4 — Resolution checks: fixed order, first failure reported

- **Decision:** In the people pass an `Employee` is checked against its
  company before its name is checked against the people namespace, and the
  first failure is the one reported. An `Employee` line with both an
  undeclared company and a name already taken warns `unknown-company` only.
  A contact's person slots report `wrong-role` when the name belongs to the
  other kind of person (Q12); a company slot has no equivalent cause, so an
  undeclared company is reported as undeclared even when a person of that
  name is declared.
- **Context:** T4 review. A line can break two rules at once, and names are
  letters only (Q9), so a company is often named after a person:

  ```
  Partner Dell
  Employee Laurie Dell    # meant the company Dell, never declared
  ```

- **Why:** A line naming no declared company describes no employee at all,
  so its name claim never arises — the discard and the warning are the same
  fact. Reporting a duplicate first would imply the line would otherwise
  have stood, which is false. One failure per line also keeps the warning
  ordering total (T4.3) and the result type simple, and it matches the
  parser, which already reports the first failure in a fixed order (T3.4).
  The asymmetry between the two slot kinds follows from Q12: partners and
  employees share one namespace, so a name found there is the same person
  in the wrong position and `wrong-role` says so; companies are their own
  namespace, so a partner named Dell is not evidence about a company named
  Dell, and the warning names the missing company and stops. **Rejected:**
  checking the name claim first; reporting both problems, which puts two
  warnings on one line and breaks T4.3's total order; and an `is-a-person`
  cause on `unknown-company`, which treats the two namespaces as related,
  against Q12.
- **Origin:** LLM-suggested, accepted. The order was already in the T4
  implementation; the T4 review surfaced it as an unrecorded choice with a
  nameable alternative, and that T3.4 sets the same pattern for the parser.

---

## T5 — Report

### <a id="t5-1"></a>T5.1 — One exported function; the tally stays private

- **Decision:** `report.ts` exports `reportLines(network: Network): string[]`
  and nothing else. The per-company, per-partner tally and the strongest-partner
  pick are private functions, and the returned lines carry no trailing newline
  — the cli decides how to join and terminate them (T6c).
- **Context:** T5a. T1.13 leaves every tally to this layer, so the layer could
  just as well expose the tallies it computes.
- **Why:** The brief asks for one report, and one function is the whole
  contract: give it a resolved network, get the lines. A public tally would be
  a second contract to keep working and to test, with no caller — the other
  product questions T1.13 mentions ("who do we know at ACME?") are not in the
  brief, and the raw contacts they would need are already on `Network`.
  Returning lines rather than one joined string keeps the layer free of the
  choice between `\n` and `\r\n` and of whether output ends in a newline,
  which belongs with the stream that writes it, and it lets tests assert an
  array instead of matching text. Rejected: exporting the tally (`Strengths`)
  as part of the API, and returning a single pre-joined string.
- **Origin:** LLM-suggested, accepted.

### <a id="t5-2"></a>T5.2 — A network that breaks its own invariants throws

- **Decision:** While tallying, a contact whose employee is not a key of
  `employers` throws an `Error` naming the employee. The other two `Network`
  invariants are not checked: a contact whose company was never declared simply
  never reaches a line, because the company list drives the output.
- **Context:** T5a. `noUncheckedIndexedAccess` (T1.5) types
  `employers.get(employee)` as `string | undefined`, so the lookup has to be
  narrowed even though `Network` documents that it cannot fail.
- **Why:** Under Q7 and Q8 a lost contact lowers a strength and can change the
  partner a line names, so the one thing the report must not do is drop a
  contact quietly; every other discard in this program is announced. A throw
  states the contract that `buildNetwork` already guarantees, and it is
  reachable only by hand-building a `Network`, which the test does. The
  unchecked invariants need no guard: FR4 says list all companies, so the
  output is built from `companies`, and a tally under an undeclared company is
  simply never read. Rejected: a non-null assertion, which silences the
  compiler without saying why; and skipping the contact, which is the silent
  data loss this program avoids everywhere else. A throw is not a retreat from
  Q7's rule that the report is never withheld: Q7 and Q8 govern the data the
  program was handed, while reaching here means the program has contradicted
  itself, which is a bug. The two get different handling, and [T6.1](#t6-1)
  states the split.
- **Origin:** LLM-suggested, accepted.

### <a id="t5-3"></a><a id="q1"></a>T5.3 — Q1: Ties go to the alphabetically first partner

- **Decision:** When two or more partners have equal, highest strength to a
  company, the line names the alphabetically first of them, by the same order
  used for companies (Q14).
- **Context:** T5b. The brief's output format names exactly one partner per
  company and says nothing about ties.
- **Why:** Deterministic, independent of input order, and stated in one
  sentence in the README. Rejected: earliest contact wins, which reads as
  "longest-running relationship" but depends on input order — the brief never
  says the file is chronological, and its own example declares a partner after
  contacts (Q8), so line order is not time order. Also rejected: naming every
  tied partner, which contradicts brief requirement 6.1's
  `<CompanyName>: <PartnerName> (<RelationshipStrength>)`. **Known tradeoff:**
  the winner is arbitrary in business terms — `Abdi` beats `Zoe` for no
  relationship reason — and the output gives no sign a tie occurred. A tie
  policy that means something (weighting contact types, recency, breadth of
  employees contacted) is deferred to [UPGRADES U4](./UPGRADES.md#u4).
- **Origin:** LLM-suggested, accepted (the default recorded in PLAN §4,
  confirmed when T5 started, after the alternatives above were put side by
  side). Deferring a fuller tie policy to U4 rather than leaving the tradeoff
  only in this entry: Mine.

### <a id="t5-4"></a><a id="q14"></a>T5.4 — Q14: "Sorted alphabetically" is code-unit order

- **Decision:** Companies are sorted by plain `<` on the name — UTF-16 code
  unit order — so every uppercase letter sorts before every lowercase one
  (`Zebra` before `acme`). The same comparison breaks partner ties (Q1).
- **Context:** T5c. Names are case-sensitive (Q4), so `ACME` and `acme` can
  both be declared, and the brief's example has no such input to imitate.
- **Why:** The same input prints the same report on every machine. Names are
  letters only (Q9), so code-unit and code-point order coincide, and for input
  of one case — every example in the brief — this is ordinary alphabetical
  order. The comparison is written out rather than left to `Array.sort()`'s
  default so that a reader can see it is not locale-aware. Rejected:
  `localeCompare`, which groups `acme` with `ACME` as a human would but depends
  on the runtime's ICU data and default locale, so a submission graded by
  running it could print a different order than it did here; and comparing
  lowercased with a code-unit tie-break, which is machine-independent and
  human-friendly but is a third rule to explain in the README for input the
  brief never shows.
- **Origin:** LLM-suggested, accepted (the default recorded in PLAN §4,
  confirmed when T5 started).

### <a id="t5-5"></a>T5.5 — The example test reads the shipped `input.txt`

- **Decision:** `input.txt` holds the brief's example verbatim, with the
  demonstration comment line removed and the trailing blank line kept, and the
  report test reads that file from disk rather than a copy inside the test.
- **Context:** T5d. PLAN §7 makes this example the definition of done.
- **Why:** The file a reviewer runs and the file the test asserts on are then
  the same bytes, so the example cannot pass in the suite while the shipped
  file has drifted. Keeping the trailing blank line means the fixture also
  exercises Q6 on the input every reviewer will use. The comment line goes
  because the brief itself says it is not part of the input. The cost is one
  file read in a layer that is otherwise pure, which is the test's I/O, not the
  report's. Rejected: an inline copy of the example (no I/O, but two copies to
  keep in step); and leaving the example to T6e's process-level test alone,
  which would not catch a broken fixture until the cli exists. **Known limit:**
  the test drops malformed lines exactly as the cli will (Q7), so it asserts
  the report but not that the fixture parses cleanly — a stray comment line in
  `input.txt` would leave this test green while the program warned on stderr.
  T6e closes that by asserting stderr is empty, which is a stronger check than
  this layer could make; adding a second cleanliness assertion here was
  rejected as duplicate coverage.
- **Origin:** LLM-suggested, accepted.

### <a id="t5-6"></a>T5.6 — An entry is fixed once its commit lands, not once it is written

- **Decision:** The log's never-edit rule binds from the commit that adds an
  entry. Before that the entry is a draft and may be revised in place while
  reviewing the change it belongs to; after it, only a superseding entry can
  change what it says. The Key now states this.
- **Context:** T5 review. T5.5 needed a **Known limit** sentence while it was
  still staged, and the Key's "what an old entry says is never edited" read as
  forbidding that.
- **Why:** The rule exists so the record cannot be rewritten after the fact,
  and an entry written minutes earlier in the same working tree is not yet a
  record — reviewing a change and revising what it says is one act. Reading
  the rule as binding on write would mean a typo, or a clarification found in
  review, needs its own entry, filling the log with corrections that never
  described a change of mind and burying the entries that did. The commit is
  also the point where the entry becomes visible to anyone else, which is the
  line the rule is really drawing. **Rejected:** never-edit from the moment of
  writing (strictest, and it makes every review note a new entry); and leaving
  the rule unstated, which leaves the next reader to guess and invites the
  looser reading later, when it would matter.
- **Origin:** LLM-suggested, accepted (raised when amending T5.5 ran into the
  rule; recording the precedent rather than quietly editing: Mine).

### <a id="t5-7"></a>T5.7 — PLAN §3 is a curated reading list

- **Decision:** PLAN §3 lists the decisions a reviewer should read first,
  chosen by judgment rather than by a rule. [T4.3](#t4-3) is added to it. This
  log keeps the complete record, in task order.
- **Context:** T5 review. The T5 changes had rewritten §3's header from "All
  decided in T1" to "decisions that shape more than one layer" without
  recording the change, and that rule did not match its own list: T4.3 sets
  the cli↔network boundary exactly as T5.1 sets report↔cli and was missing,
  while T5.5 is a decision about tests and fixtures and is not a layer
  decision at all.
- **Why:** §3's job is to get a reviewer to the load-bearing choices quickly,
  and that is a judgment about what is worth reading, not a property of an
  entry — a criterion precise enough to check mechanically would either admit
  entries nobody needs first or exclude ones they do, as this one did in both
  directions at once. Completeness is already covered: every decision is in
  this log, in the section of the task that made it. **Rejected:** "shapes
  more than one layer" (checkable, but it excludes T5.5 and leaves
  cross-cutting non-layer decisions with nowhere to go); indexing every
  decision, which duplicates this log's structure and stops being a reading
  aid once it is thirty lines long; and reverting §3 to T1 only, which makes
  it a historical accident and sends the reviewer through the whole log to
  find what matters.
- **Origin:** Curated list and adding T4.3: LLM-suggested, accepted. Catching
  that the rewrite was an unrecorded decision, and that the rule contradicted
  its own list: LLM-suggested (T5 review). The rewrite itself was unlogged,
  which is the gap this entry closes.

---

## T6 — CLI

### <a id="t6-1"></a>T6.1 — Bad data warns; a broken invariant crashes

- **Decision:** `main` does not catch. Bad input data warns on stderr and the
  report still prints, exit 0 (Q7, Q8). A broken invariant ([T5.2](#t5-2))
  propagates: Node prints the stack trace and exits 1, the same code Q15 gives
  a bad invocation, so **exit 1 means no report was produced**. Failures that
  are neither — stdout closing early, a read failing after the file opened —
  are their own question (PLAN §4, Q17), settled in T6c.
- **Context:** T5 review, before T6 starts. T5.2 made `report` throw, but
  nothing said what `main` does with it, and T6a's one-line plan entry
  ("`main(argv, stdin, stdout, stderr)` → exit code") did not cover it.
- **Why:** An uncaught throw and a deliberate `process.exitCode = 1` both exit
  1, so the choice never affects the exit contract — it only decides what
  stderr shows. For a bug, the stack trace naming `tallyStrengths` and the
  employee is the most useful output available, and a one-line "Internal
  error" is prettier and strictly less informative at the moment someone most
  needs information. A catch at `main` also cannot be reached by any test that
  goes through `main`, since `main` builds its own network from input, so it
  would be an untested branch bought with a seam; the throw itself is already
  covered, because T5.2's test hand-builds a `Network`. **Rejected:** catching
  at `main` and printing one line — its real merit is netting EPIPE and
  mid-read I/O errors, which folds a reachable failure into an unreachable one
  and settles both without examining either, so Q17 takes them on their own
  terms; and catching in order to print the stack, which is the same
  observable behaviour as propagating, with more code.
- **Origin:** LLM-suggested, accepted. Asking for the tradeoffs before
  deciding changed the framing rather than the recommendation: it established
  that the exit code is identical either way, and surfaced EPIPE as a separate
  reachable case, which became Q17. Stating the data-versus-bug split in T5.2
  as well as here: Mine.

---

## Open questions

Open questions live in [PLAN §4](./PLAN.md#4-questions-and-assumptions-document-all-in-readme)
and move here once resolved.
