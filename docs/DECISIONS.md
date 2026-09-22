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

### T0 — Tooling

#### <a id="t0-1"></a>T0.1 — Toolchain: `tsx` + `vitest` + `tsc`, npm

- **Decision:** `tsx` to run `.ts` directly, `tsc` to build `dist/` and to
  type-check (`--noEmit`), `vitest` for tests, `npm` as package manager.
- **Context:** Need a fast dev loop _and_ a real build artifact for a submission.
- **Why:** `tsx` runs without a compile step but skips type-checking, so `tsc`
  is kept as a separate `typecheck` gate. `vitest` is TS-native, zero-config,
  Jest-style. Alternatives (ts-node, jest+ts-jest) are slower/heavier to config.
- **Origin:** LLM-suggested, accepted.

#### <a id="t0-2"></a>T0.2 — Modules: ESM with `NodeNext`

- **Decision:** `"type": "module"`; tsconfig `module` + `moduleResolution` =
  `NodeNext`.
- **Context:** Greenfield project on modern Node.
- **Why:** Native fit with vitest/modern deps; future-proof. **Tax accepted:**
  relative imports need explicit `.js` extensions (`./parser.js`), which the
  `typecheck` gate enforces at compile time.
- **Origin:** LLM-suggested, accepted.

---

<a id="t1"></a>

### T1 — Scaffold

T1.10–T1.21 were decided while reviewing T1, before implementation
started.

#### <a id="t1-1"></a>T1.1 — Test layout: colocated

- **Decision:** Tests sit next to the unit under test (`src/foo.test.ts` beside
  `src/foo.ts`).
- **Why:** Keeps a module and its tests together; makes per-module coverage gaps
  obvious; common vitest default. Alternative (a separate `tests/` tree) keeps
  `src/` tidier but adds indirection for a 4-module codebase.
- **Origin:** LLM-suggested, accepted.

#### <a id="t1-2"></a>T1.2 — Lint + format: ESLint (type-checked) + Prettier

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

#### <a id="t1-3"></a>T1.3 — Build vs. type-check split

- **Decision:** Base `tsconfig.json` includes `*.test.ts` (so tests are
  type-checked); `tsconfig.build.json` excludes them so they don't reach `dist/`.
- **Why:** Want tests type-checked _and_ a clean build artifact — a single config
  can't do both. `build` → `tsc -p tsconfig.build.json`.
- **Note:** `npm run check` runs typecheck, lint, format check, and tests (fastest
  first, stopping at the first failure) and must pass before any commit. Build is
  left out, since typecheck already catches anything that would break it.
- **Origin:** LLM-suggested, accepted.

#### <a id="t1-4"></a>T1.4 — Dropped `package.json` `bin` field

- **Decision:** Removed the `bin: { herbie-lite → dist/cli.js }` entry.
- **Context:** Surfaced in the T1 review — the entry promised an executable but
  `cli.ts` had no `#!/usr/bin/env node` shebang, so `npm link` invocation would
  break.
- **Why:** The brief only requires `node dist/bin.js input.txt` and STDIN; a bin
  is out of scope. Removing it is leaner than adding a shebang for a path the
  brief doesn't use.
- **Origin:** LLM-suggested, accepted.

#### <a id="t1-5"></a>T1.5 — Compiler strictness

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

#### <a id="t1-6"></a>T1.6 — Separate executable entry (`bin.ts`) from `cli.ts`

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

#### <a id="t1-7"></a>T1.7 — Supported Node version: 22.13 and later

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

#### <a id="t1-8"></a>T1.8 — Package and build settings

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

#### <a id="t1-9"></a>T1.9 — Dependencies on current major versions

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

#### <a id="t1-10"></a>T1.10 — Input: file argument, STDIN, and interactive entry

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
- **Superseded in part by** [T6.13](#t6-13) (the terminal hint only; the file
  and STDIN run commands, and interactive entry itself, stand).
- **Superseded in part by** [T9.12](#t9-12) (interactive entry: typed input is
  refused; the file and STDIN run commands stand).

#### <a id="t1-11"></a>T1.11 — Layered architecture

- **Decision:** Four layers, pure logic separate from I/O:
  1. `parser` — line → typed `Command` (a discriminated union), or a
     malformed-line result (Q7).
  2. `network` — the domain model; applies commands, holds state, resolves
     pending employees and contacts at end of input (Q5, Q8).
  3. `report` — pure function: network → sorted output lines.
  4. `cli` — thin I/O shell: read source, wire the layers, print.
- **Why:** Every layer except `cli` is testable without files or processes.
- **Origin:** LLM-suggested, accepted.

#### <a id="t1-12"></a>T1.12 — Commands as a discriminated union

- **Decision:** `Command` is a TypeScript discriminated union on the command kind.
- **Why:** Exhaustiveness checking means adding a command type makes the compiler
  flag every place that must handle it.
- **Origin:** LLM-suggested, accepted.

#### <a id="t1-13"></a>T1.13 — Store raw facts; compute at report time

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

#### <a id="t1-14"></a><a id="q2"></a>T1.14 — Q2: Companies with no relationship

- **Decision:** A company whose employees have zero contacts, or that has no
  employees, prints `<CompanyName>: No current relationship`.
- **Why:** Strength 0 is not a relationship.
- **Origin:** LLM-suggested, accepted.

#### <a id="t1-15"></a><a id="q3"></a>T1.15 — Q3: Drive Capital never appears in the output

- **Decision:** Only `Company`-declared companies are listed, so Drive Capital
  never appears.
- **Why:** It is never declared via `Company`, and it can't be: names are single
  words, so `Company Drive Capital` is not expressible (`Company DriveCapital`
  would just be an ordinary company).
- **Origin:** LLM-suggested, accepted (the conclusion and, later, the
  single-word argument).

#### <a id="t1-16"></a><a id="q4"></a>T1.16 — Q4: Names are case-sensitive

- **Decision:** `Chris` and `chris` are different names.
- **Why:** The brief gives no reason to fold case; exact matching is the least
  surprising and simplest rule.
- **Origin:** LLM-suggested, accepted.

#### <a id="t1-17"></a><a id="q5"></a>T1.17 — Q5: Duplicate and conflicting declarations

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

#### <a id="t1-18"></a><a id="q6"></a>T1.18 — Q6: Error handling depth

- **Decision:** Every malformed line gets the Q7 handling. Blank lines are
  skipped without a warning.
- **Context:** The brief allows "as much or as little as appropriate".
- **Why:** One rule for every kind of bad line is simpler to explain, implement,
  and test than a rule per case.
- **Origin:** LLM-suggested, accepted.

#### <a id="t1-19"></a><a id="q7"></a>T1.19 — Q7: Malformed lines: discard, warn, continue

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

#### <a id="t1-20"></a><a id="q8"></a>T1.20 — Q8: Contacts resolved after all input

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

#### <a id="t1-21"></a><a id="q9"></a>T1.21 — Q9: A word is letters only

- **Decision:** Words match `[A-Za-z]+`. The README notes this interpretation.
- **Context:** The brief says "the upper- and lowercase characters A thru z".
- **Why:** Read literally as an ASCII range, `A`–`z` would also include
  `[ \ ] ^ _` and a backtick (codes 91–96); "upper- and lowercase characters"
  makes letters the clear intent.
- **Origin:** LLM-suggested, accepted (README note included).

---

### T2 — Types

#### <a id="t2-1"></a>T2.1 — Break T2–T8 into lettered subtasks

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

#### <a id="t2-2"></a>T2.2 — Open questions live in PLAN §4, cross-linked to subtasks

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

#### <a id="t2-3"></a>T2.3 — Types live in the layer that owns them

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

#### <a id="t2-4"></a>T2.4 — Command and contact-type shapes

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

#### <a id="t2-5"></a>T2.5 — Parser and network return data; cli writes text

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

#### <a id="t2-6"></a><a id="q13"></a>T2.6 — Q13: Repeated commands: contacts count, declarations warn

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

#### <a id="t2-7"></a><a id="q12"></a>T2.7 — Q12: One name, one person

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

### T3 — Parser

#### <a id="t3-1"></a>T3.1 — Decision IDs: one T ID per entry, Q kept as a tag

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

#### <a id="t3-2"></a><a id="q10"></a>T3.2 — Q10: Whitespace within a line

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

#### <a id="t3-3"></a><a id="q11"></a>T3.3 — Q11: Command keywords are case-sensitive

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

#### <a id="t3-4"></a>T3.4 — Parser checks: fixed order, first failure reported

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

### T4 — Network

#### <a id="t4-1"></a>T4.1 — Project docs imported into every session's context

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

#### <a id="t4-2"></a>T4.2 — Log a decision when it is made, on a named threshold

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

#### <a id="t4-3"></a>T4.3 — `buildNetwork`: apply in one pass, resolve in two

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

#### <a id="t4-4"></a>T4.4 — Resolution checks: fixed order, first failure reported

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

### T5 — Report

#### <a id="t5-1"></a>T5.1 — One exported function; the tally stays private

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
- **Superseded in part by** [T10.7](#t10-7) (`reportLines` returning
  lines only; a single entry point and a private tally stand).

#### <a id="t5-2"></a>T5.2 — A network that breaks its own invariants throws

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

#### <a id="t5-3"></a><a id="q1"></a>T5.3 — Q1: Ties go to the alphabetically first partner

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

#### <a id="t5-4"></a><a id="q14"></a>T5.4 — Q14: "Sorted alphabetically" is code-unit order

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

#### <a id="t5-5"></a>T5.5 — The example test reads the shipped `input.txt`

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

#### <a id="t5-6"></a>T5.6 — An entry is fixed once its commit lands, not once it is written

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

#### <a id="t5-7"></a>T5.7 — PLAN §3 is a curated reading list

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

### T6 — CLI

#### <a id="t6-1"></a>T6.1 — Bad data warns; a broken invariant crashes

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

#### <a id="t6-2"></a>T6.2 — `main` takes its streams; `bin.ts` stays logic-free

- **Decision:** `main(args, stdin, stdout, stderr): Promise<number>`, over
  Node's own stream types, returning the exit code rather than setting one.
  `bin.ts` passes `process.argv.slice(2)` and the three process streams, and
  assigns the result to `process.exitCode`. Nothing in `main` asks whether a
  stream is a terminal: the base prints nothing extra for typed input
  ([T6.13](#t6-13)), so the program's only input question is whether an
  argument was given.
- **Context:** T6a. PLAN named the signature; what the parameters are typed
  as, and where the terminal check lives, were open.
- **Why:** Every test drives the real entry point with `Readable.from` and a
  collecting `Writable`, so nothing is stubbed and no module-level state is
  touched; a test that wants the interactive path opts in with
  `Object.assign(stream, { isTTY: true })`, and every other test gets the
  piped path by construction. Returning the code keeps `main` a function of
  its arguments, so `process` is named in exactly one file (T1.6). Node's
  stream types also carry the `EventEmitter` surface that Q17's write-failure
  handling needs. **Rejected:** narrow interfaces of our own
  (`{ write(text: string): void }`), the purest boundary, but it invents an
  abstraction for two callers that already satisfy the Node types, and it has
  nowhere to attach the `error` listener Q17 needs.
- **Origin:** LLM-suggested, accepted.
- **Superseded in part by** [T9.12](#t9-12) (a terminal check returns, to
  refuse typed input; the stream parameters and exit code stand).

#### <a id="t6-3"></a><a id="q15"></a>T6.3 — Q15: One optional file argument

- **Decision:** Zero arguments reads STDIN; one names a file; two or more is
  an error. An argument that cannot be read is an error. Both print one line
  to stderr, print no report, and exit 1 (T6.1). There is no `--help`, no
  usage line, and no `-` for STDIN; a `--help` flag is
  [UPGRADES U5](./UPGRADES.md#u5).
- **Context:** T6b. Q7 covers a bad line, not a bad command line.
- **Why:** The two run forms in the brief are a file argument and a pipe, and
  this is the smallest rule that serves both: the argument list is either
  empty or one path. Exiting 1 with no report matches T6.1's contract that
  exit 1 means no report was produced, which a bad line never causes.
  **Rejected:** printing a usage line after the error, which is friendlier
  but adds a second description of the run forms that can drift from the
  README (T7a); and `--help`, which is a feature the brief does not ask for
  and which puts a non-path argument into the argument handling — deferred
  to U5 rather than dropped.
- **Origin:** The rule: LLM-suggested, accepted (the default recorded in PLAN
  §4, confirmed when T6 started). Deferring `--help` to UPGRADES rather than
  leaving it unrecorded: Mine.
- **Superseded in part by** [T9.10](#t9-10) (no `--help` and no usage line;
  the one optional path and the exit code stand).

#### <a id="t6-4"></a>T6.4 — Reading lines: our own `\n` splitter

- **Decision:** `readLines(stream)` is an async generator that decodes the
  stream as UTF-8, buffers partial lines across chunks, splits on `\n` alone,
  numbers lines from 1, and yields a final line that has no trailing newline.
  A trailing `\r` is left in the text for the parser to strip, as it already
  does (T3.2).
- **Context:** T6c. PLAN left the reader open, noting that `readline` treats a
  lone `\r` as a line break.
- **Why:** A line number is quoted in every warning, so it has to mean what a
  reader's editor shows. `readline` splits on `\r` as well as `\n`, so one
  stray `\r` anywhere in a file silently renumbers every line after it and
  every later warning points at the wrong line — a failure with no symptom
  except wrong advice. Splitting on `\n` alone costs about fifteen lines and
  makes the number exact; a lone `\r` then stays inside its line and fails
  the letters-only check (Q9), which is a warning rather than a silent shift.
  Decoding with `setEncoding` rather than concatenating buffers also
  reassembles a multi-byte character split across two chunks. Streaming, not
  reading the whole input first, is what lets a mistyped line be answered as
  it is typed (Q7, T1.10). Leaving `\r` to the parser keeps one meaning for
  `source.text` — the bytes between two newlines — rather than two modules
  negotiating what belongs to a line, keeps T3.2's strip reachable in
  production rather than only from its own tests, and costs only a trailing
  `\r` inside the text a warning quotes, which is invisible because the
  quoted line comes last (T6.7). **Rejected:** `node:readline` with
  `crlfDelay: Infinity`, for the renumbering above; reading all input and
  then splitting, which is exact but prints nothing until end of input and so
  would gut T1.10's interactive entry; and stripping `\r` in the reader,
  either alongside T3.2's strip (two modules knowing about CRLF, and the
  parser's strip dead in production) or instead of it (supersedes part of
  T3.2, and `parseLine` then mis-parses any CRLF line not routed through the
  reader, including in the network and report tests, which build lines from
  text themselves).
- **Origin:** LLM-suggested, accepted. Leaving `\r` to the parser: raised as
  a question by me, recommended and reasoned by the LLM, accepted.
- **Superseded in part by** [T10.23](#t10-23) (`readLines` decoding the
  stream; it takes decoded text, and the cli decodes).

#### <a id="t6-5"></a>T6.5 — `lines.ts` and `warnings.ts` are helpers of the cli layer

- **Decision:** The reader (T6.4) lives in `lines.ts` and every line of
  stderr text in `warnings.ts`. Neither is a fifth layer: T1.11's four layers
  stand, and these two are helpers _of_ `cli`, which is still the only module
  that touches a stream or decides what to print. Both are added to PLAN §3's
  reading list along with T6.2, since a reviewer opening `src/` sees six
  modules where T1.11 promised four.
- **Context:** T6c. T2.5 put the wording in `cli`, and the reader could as
  easily have been a private generator there.
- **Why:** Both are the parts of the cli worth testing without a stream. The
  reader's hard cases are about where a chunk boundary falls — a line split
  across two chunks, a final line with no newline, a BOM alone in a chunk —
  and at this boundary each is a two-line test, while through `main` the same
  case has to be asserted via a warning's line number, several layers from
  the bug. The wording is about seven message shapes; as private functions
  they are reachable only by running text through streams, and `cli.ts` would
  be mostly prose. What is left in `cli.ts` is the shape the layer is
  supposed to have: choose a source, loop, collect, print. **Rejected:**
  both inline in `cli.ts` (T2.5's literal reading, and no new files, but the
  tests above move several layers away from what they test); `readLines` in
  `parser.ts`, where `SourceLine` and Q10 already live, which puts stream I/O
  into the layer T1.11 keeps pure and answers U2's reader-or-parser question
  the other way from T6.6; and each layer formatting its own warnings, which
  supersedes T2.5 rather than following it.
- **Origin:** `warnings.ts`: LLM-suggested, accepted. `lines.ts`:
  LLM-suggested, accepted after I asked what it would contain and why it beat
  inlining.

#### <a id="t6-6"></a><a id="q16"></a>T6.6 — Q16: Strip a byte-order mark, silently

- **Decision:** `readLines` removes one U+FEFF at the very start of the
  stream, and says nothing about it. A BOM anywhere else — including at the
  start of a later line, as concatenating two files produces — is left alone
  and reaches the parser as part of a word. This settles two of
  [UPGRADES U2](./UPGRADES.md#u2)'s three questions as _reader_ and _line 1
  only_, and the third as _silently_, so U2 is built here rather than
  deferred.
- **Context:** T6c. PLAN's default was to leave this out of the base, and the
  README would have named the cause.
- **Why:** A file saved by Windows Notepad or as Excel's UTF-8 CSV begins
  with an invisible character that makes line 1 an unknown command (Q11).
  The damage does not stop there: if line 1 is `Partner Chris`, then Chris is
  never declared, every `Contact` naming Chris fails to resolve (Q8), and the
  report names a different partner — one invisible byte, three warnings, and
  a changed answer. The warning cannot even show the cause, because U+FEFF
  prints as nothing, so the quoted line looks valid (U3). One line in the
  reader removes a whole class of wrong-but-warned output on files a reviewer
  might plausibly produce. Silent, because a BOM is a file-encoding artifact
  and not a fact about the network — there is nothing for a user to fix once
  it is handled, and a note would be a stderr line that is not a discarded
  line, which fits neither the warning shape (T2.5) nor the exit contract.
  Line 1 only, because that is where an encoder writes it; a U+FEFF elsewhere
  is data, and Q9 already rejects it loudly. **Known limit:** a BOM alone on
  line 1 still leaves an empty line 1, which is blank under Q6 and so passes
  silently — the line numbering is unaffected either way. **Rejected:**
  leaving it out of the base, which keeps the scope rule clean but ships a
  program that gives a wrong report for an invisible reason; and stripping it
  with a note on stderr, for the warning-shape reason above.
- **Origin:** Mine. The LLM recommended keeping it out of the base, with the
  cascade above set out as the cost, and deferring it to U2; I chose to build
  it, which is a deliberate inclusion beyond the brief in the sense T1.10
  set.

#### <a id="t6-7"></a>T6.7 — Warning text: one prefixed line, the input quoted last

- **Decision:** Every stderr line is
  `herbie-lite: line <n>: <problem>; discarded: <the line as written>`, with
  the program name on every line and the input quoted last. The expected
  format in a parser warning is built from `COMMAND_SYNTAX`
  (`expected "Employee <Name> <CompanyName>"`), never written out again.
  Invocation and I/O failures use the same prefix without the line part.
  Malformed lines are printed as they are read and resolution warnings after
  all input is in, so stderr is in two passes rather than one run of input
  order.
- **Context:** T6c. T2.5 left the wording to this layer and nothing had
  fixed its shape.
- **Why:** One line per problem stays greppable and keeps the one-warning-
  per-line ordering T4.3 established visible. The prefix keeps stderr
  attributable once it is merged into a log or another program's output.
  Quoting the input last keeps a long or odd line away from the part of the
  message that names the problem. Ordering alone turned out not to be enough
  — [T6.8](#t6-8) adds a second quote in the middle of the line, where a
  carriage return does overwrite the message — so the quoted text is escaped
  and bounded instead ([T6.11](#t6-11)), and quoting last is now the second
  line of defence rather than the guarantee. **Known tradeoff:** the two passes mean
  a warning for line 12 can print before one for line 2, which is the price
  of answering a typed line immediately (Q7, T1.10); within each pass the
  order is the file's. **Rejected:** dropping the program prefix (shorter,
  but anonymous in a merged log); a multi-line warning with the quoted line
  indented below, which reads best on a terminal but triples stderr on a
  messy file and is harder to grep; and holding parser warnings back so all
  of stderr is in input order, which would make interactive entry silent
  until Ctrl+D.
- **Origin:** LLM-suggested, accepted.
- **Superseded in part by** [T9.13](#t9-13) (two passes: every warning now
  prints after input ends, in line order; the warning's shape stands).

#### <a id="t6-8"></a>T6.8 — Q13's warning: a repeat reads differently from a claim

- **Decision:** A repeated declaration warns in one of two wordings. When the
  two commands say the same thing, `repeats the declaration on line 1`. When
  the name is claimed by a different declaration,
  `Laurie is already declared on line 2 as "Employee Laurie Globex"`, quoting
  the standing line as the user wrote it (escaped and bounded like any other
  quoted input, [T6.11](#t6-11)). `cli` tells them apart by comparing
  the commands, not their text, so spacing never makes a repeat look like a
  conflict (Q10).
- **Context:** T6c. Q13 gives both cases one warning, and T2.5 anticipated
  the cli distinguishing them.
- **Why:** They are different events to the person reading stderr. An exact
  repeat is noise in the file and needs no action beyond deleting a line; a
  name claimed twice is a data error where the program has chosen which
  declaration stands, and quoting the standing line is what lets the user see
  the choice. Comparing commands rather than text is what makes
  `Employee Sam Hooli` and `Employee  Sam  Hooli` a repeat, as Q10 implies
  they should be. **Rejected:** one wording for both, which is one code path
  and still quotes the standing line, but describes an identical line as a
  conflict; and staying silent on exact repeats, which reverses Q13's
  deliberate choice to surface them and would need a superseding entry
  rather than a T6 one.
- **Origin:** LLM-suggested, accepted.

#### <a id="t6-9"></a><a id="q17"></a>T6.9 — Q17: A closed stdout ends quietly; other I/O fails loudly

- **Decision:** A write to stdout that fails with `EPIPE` ends the run with no
  message and exit 0. Any other write failure, and any failure while reading,
  prints one line to stderr and exits 1 (T6.1) — a file that could not be
  opened (Q15) and a read that failed partway reach the same handler and read
  the same way. Only the read loop and the final write are wrapped;
  `buildNetwork` and `reportLines` are not, so a broken invariant still
  propagates as T6.1 requires. Both output streams also get a no-op `error`
  listener, because a failing stream emits `error` as well as reporting to
  the write callback, and an unhandled one would end the process before the
  callback could decide anything.
- **Context:** T6c. Q7, Q15 and T6.1 covered bad data, a bad invocation and a
  bug; a reader closing the pipe is none of the three.
- **Why:** `node dist/bin.js input.txt | head -1` is an ordinary shell idiom,
  and `head` closing the pipe is the reader saying it has enough — not a
  failure of this program. A stack trace there is noise, and a non-zero exit
  would break pipelines that are working correctly. Everything else that goes
  wrong with the file or the terminal genuinely means no report was produced,
  which is exactly what exit 1 signals. The read and the write are caught
  because I/O is expected to fail; the domain calls between them are not,
  because a throw from either is a contradiction in the program (T5.2).
  **Rejected:** letting everything propagate, which is the least code and
  keeps T6.1's no-catch stance whole, but prints a stack trace for `| head`;
  and treating a closed pipe like any other failure (one rule, no exit-code
  subtlety), which makes a correct pipeline a failing command.
- **Origin:** LLM-suggested, accepted (the default recorded in PLAN §4,
  confirmed when T6 started).

#### <a id="t6-10"></a>T6.10 — The process-level test runs the source through `tsx`

- **Decision:** T6e spawns `node_modules/.bin/tsx src/bin.ts`, not
  `node dist/bin.js`, and asserts the brief's output with empty stderr for
  both a file argument and a pipe.
- **Context:** T6e. T1.3 keeps `build` out of `npm run check`, on the grounds
  that `typecheck` already catches what would break it.
- **Why:** `npm test` then passes on a clean clone with no build step, so
  `check` covers the end-to-end path without contradicting T1.3. What the
  test loses is the exact artifact a reviewer runs — the built `dist/`,
  including the ESM `.js` extensions T0.2 taxes us for — and T8d's
  clean-clone check covers that by running the built program directly.
  **Rejected:** spawning `node dist/bin.js`, which tests the real artifact
  but makes `npm test` fail on a clean clone unless a build ran first, so
  either `check` grows a build step or the suite becomes order-dependent; and
  running both, with the built program tested only when `dist/` exists, which
  is a test that can be green because it quietly skipped.
- **Origin:** LLM-suggested, accepted.

#### <a id="t6-11"></a>T6.11 — Quoted input is escaped and bounded

- **Decision:** Wherever a warning quotes input, the text is escaped and
  capped at 200 characters of output. Escaped: every control, format and
  separator character (`\p{C}`, `\p{Z}`) other than a plain space, plus `\`
  itself. Tab and carriage return use the familiar `\t` and `\r`; everything
  else is `\u` and its code point (` `, `\u{e0041}`). Visible non-ASCII
  such as `Zoë` is left as typed. Past the cap the quote ends
  `... (5008 characters)`. This is [UPGRADES U3](./UPGRADES.md#u3), built in
  the base rather than deferred, and it settles U3's three open questions as
  _escape tabs_, _keep visible non-ASCII_, and _short forms for `\t` and
  `\r`_.
- **Context:** T6 review. [T6.7](#t6-7), which fixes the shape of a warning,
  made the message safe by quoting the input last; [T6.8](#t6-8), which gives
  a repeated declaration its wording, then added a second quote — the standing
  declaration — in the middle of the line. On a CRLF file that quote carries a
  `\r`, and the warning overwrites its own opening. What a terminal shows is
  `"; discarded: Partner Laurieis already declared on line 2 as "Employee
Laurie Globex`: the program name, the line number and the name are gone.
- **Why:** T6.7's guarantee is that a control character in quoted input cannot
  cost the reader the part of the message that names the problem; quoting last
  was only the mechanism, and the mechanism broke inside the same task, which
  is the evidence that it cannot carry the guarantee alone. Escaping also
  removes two costs recorded elsewhere: [T3.4](#t3-4)'s known tradeoff, that a
  line broken by an invisible character looks valid in the warning, and the
  terminal escape sequences a hostile or merely wrong file can otherwise send
  to stderr — `node dist/bin.js /bin/ls` wrote 212KB of raw bytes before this
  change. The cap bounds the same case from the other side, since escaping a
  five-megabyte line would produce twenty; the loop stops at the limit instead
  of escaping the whole line first, so a long line costs nothing to quote and
  no escape is ever cut in half. Short forms for `\t` and `\r` because a
  Windows file is the common case and `\r` is what every reader already knows.
  **Rejected:** sanitizing only T6.8's standing quote, which leaves the next
  mid-message quote exposed the same way; reordering the message so the
  standing line comes last, which only moves which of the two quotes is
  exposed; stripping `\r` in the reader, which supersedes part of
  [T6.4](#t6-4), the reader's own `\n`-only splitting rule, and covers one
  character out of the class; a uniform `\u` with no short forms, one sentence
  shorter to state but `
` on every line of a Windows file; escaping all
  non-ASCII, which shows `Zoë` as `Zoë`; and capping the number of
  warnings rather than their length, which makes the program withhold discards
  it has decided to announce ([T5.2](#t5-2), where a lost contact is judged
  the one thing the program must never do quietly) and adds a stderr line that
  is not a discarded line. **Known limit:** invalid UTF-8 reaches the program
  as U+FFFD, which is printable and so is not escaped — the warning shows the
  replacement character and cannot show the original bytes. The README notes
  it (T7d).
- **Origin:** LLM-suggested (the CRLF failure came out of the T6 review, and
  U3 already proposed this escaping rule); building it in the base, in the
  sense [T6.6](#t6-6) set when it pulled the byte-order mark in, and the
  truncation: Mine, chosen after the LLM set out escaping alone, escaping with
  a cap, and documenting the behaviour as it stood. Capping the warning count
  was offered and rejected.

#### <a id="t6-12"></a>T6.12 — The reader names its own failures

- **Decision:** `readLines` wraps a failure of the stream in a `ReadError`
  carrying it as `cause`. `cli`'s read loop catches only `ReadError` and
  rethrows anything else, so a throw from the loop's own body — the parser, or
  writing a warning — reaches the top and crashes with its stack trace, as
  [T6.1](#t6-1) requires of a bug.
- **Context:** T6 review. `parseLine` runs inside the `try` that reports
  "cannot read `<file>`" ([Q17](#q17)), so a bug in the parser layer exited 1
  with a confident, wrong diagnosis pointing at the user's file, and no stack
  trace. [T6.9](#t6-9), which settles Q17, says only the read and the final
  write are caught "so a broken invariant still propagates" — which the loop
  body quietly broke.
- **Why:** T6.1's contract is that bad data warns and a bug crashes loudly; a
  bug that blames the input file does neither. Naming the failure in the
  module that owns the stream matches [T6.5](#t6-5), which keeps `lines.ts` as
  the cli's I/O helper rather than a layer of its own, and it covers
  `createReadStream`'s `ENOENT` and `EISDIR` ([Q15](#q15), one optional file
  argument) without a second code path, because those surface through the same
  iteration. A `for await` that abandons its loop resumes the generator with a
  `return` completion rather than a `throw`, so the wrap cannot catch a
  consumer's own failure — a test in `lines.test.ts` holds that, because the
  argument is not obvious from reading the code. **Rejected:** narrowing the
  `try` in `cli.ts` to a manual `asyncIterator` with a `try` around `next()`
  alone, which is correct and needs no new type but leaves a loop shape every
  reader has to decode, the kind of subtlety [T1.6](#t1-6) removed rather than
  patched when it split `bin.ts` from `cli.ts`; and accepting the behaviour
  with T6.9 reworded, which is free and leaves a bug class that misdiagnoses
  itself.
- **Origin:** LLM-suggested, accepted (raised in the T6 review, with the
  manual-iterator form and a reworded T6.9 as the alternatives).

#### <a id="t6-13"></a>T6.13 — No interactive hint, and no terminal check

- **Decision:** The program prints nothing extra when input is typed at a
  terminal. `INTERACTIVE_HINT` and the `isTerminal` check are removed, PLAN's
  T6d is dropped, and nothing in the program asks whether a stream is a TTY.
  Typing commands still works — it is STDIN with no file argument — it simply
  gets no greeting. An opening explanation is
  [UPGRADES U6](./UPGRADES.md#u6).
- **Context:** T6 review. The shipped hint also read
  `herbie-lite: enter commands, ...` rather than the
  `Enter commands, ...` that [T1.10](#t1-10) quotes, because [T6.7](#t6-7)
  puts the program name on every stderr line.
- **Why:** One line of greeting is the smallest and least useful version of
  what interactive entry actually wants, which is an explanation of the four
  commands and the contact types; shipping the stub invites reading it as the
  finished thing. It is also the only place in the program that branches on
  what kind of stream it was handed, so removing it leaves `cli.ts` with
  nothing but input, output and exit code, and leaves no function without a
  caller for T8a's read-through to find. **Accepted cost:** T1.10's reason for
  the hint was that a bare `node dist/bin.js` otherwise looks frozen, and it
  does again until U6 lands. The brief's two run forms are unaffected, since
  each names a file or a pipe. **Rejected:** keeping the hint and recording
  its reworded text, which keeps the stub; keeping `isTerminal` for U6 to use
  later, which ships a function nothing calls and a test asserting a branch
  that does nothing; and writing the full explanation now, which is scope
  beyond the brief with no forcing argument of the kind [T6.6](#t6-6) had for
  the byte-order mark.
- **Supersedes:** [T1.10](#t1-10), the terminal hint only. Its file and STDIN
  run commands, and interactive entry itself, stand.
- **Origin:** Mine. The LLM recommended keeping the hint and extending T6.7 to
  cover its wording; I chose to remove it and defer the fuller version.
- **Superseded in part by** [T9.12](#t9-12) (typing commands is refused, and a
  bare run at a terminal prints an explanation of the commands).

#### <a id="t6-14"></a>T6.14 — No declared companies prints nothing

- **Decision:** When no `Company` was declared, the program writes nothing at
  all to stdout and exits 0, rather than the single newline that joining an
  empty list and terminating it would produce.
- **Context:** T6 review. The behaviour was already in the code with a test
  and a comment, but no entry, and the alternative is what the code does with
  the branch removed.
- **Why:** FR4 makes the output a list of companies, and a list of none is
  nothing; a lone newline is a line that says nothing, and anything counting
  lines or diffing output would see one report where there is none. It also
  keeps this case consistent with empty input, which already prints nothing.
  **Rejected:** the bare newline that falls out of joining an empty list and
  terminating it, with no branch; and a note on stderr, which is not a
  discarded line and so fits neither [T6.7](#t6-7)'s warning shape nor the
  exit contract — the same reasoning [T6.6](#t6-6) used to strip the
  byte-order mark silently.
- **Origin:** LLM-suggested, accepted. Recording it as a decision rather than
  leaving the code comment as the only record: Mine (T6 review).

#### <a id="t6-15"></a>T6.15 — A stderr that cannot be written to is silent

- **Decision:** Warnings are written to stderr without waiting for the write
  to be acknowledged, and the no-op `error` listener on stderr is the whole
  policy: if stderr cannot be written to, every warning is lost silently and
  the exit code still reflects only what stdout did. [Q17](#q17)'s exit-1 rule
  for a failed write covers stdout alone.
- **Context:** T6 review. Q17 settled what a failing stdout means and said
  nothing about stderr.
- **Why:** A failure to write stderr cannot be reported on stderr, so the only
  real question is whether to fail the run over it — and failing would discard
  a report that stdout accepted, against [Q7](#q7)'s rule that bad data never
  costs the report, for a stream the brief does not use at all. Not waiting
  for each warning is also what lets a mistyped line be answered as it is
  typed ([T1.10](#t1-10)). **Rejected:** treating stderr like stdout under
  Q17, which needs every warning write awaited, slows the interactive path,
  and throws away a report the user did receive; and reporting the failure on
  stdout, which corrupts the report in order to complain about the warnings.
- **Origin:** LLM-suggested, accepted (raised in the T6 review as an
  exit-code edge case Q17 had not covered).

#### <a id="t6-16"></a>T6.16 — A cited decision is explained where it is cited

- **Decision:** `CLAUDE.md` gains a rule: whenever a decision or task ID is
  cited outside this log — in conversation, in a commit message, in a review —
  the citation carries enough of the decision to be read on its own, either a
  clause summarising it or a note of which part of it is being relied on.
  `T4.2` alone is not a citation; "T4.2, which asks for a decision to be
  logged when it is made" is. Code comments are exempt.
- **Context:** T6 review, raised by me. This log is now long enough that a
  review naming `T6.7`, `Q13` and `T4.3` in one paragraph cannot be read
  without three lookups, and those lookups happen in a different window from
  the conversation.
- **Why:** The IDs exist so a claim can be traced, not so it can be
  compressed; a citation that cannot be read without the file open moves work
  from the writer to the reader on every reading, and the writer has the entry
  in hand at the moment of citing. Code comments are exempt because they sit
  beside the code the entry governs, a reader there already has the repository
  open, and glossing every ID inline would bury short comments — T8a asks for
  comments that cite IDs, not comments that reproduce them. **Rejected:**
  requiring the gloss everywhere, code comments included, which turns a
  two-line comment into five; and relying on the markdown links alone, which
  is what happens today and is what prompted the rule.
- **Origin:** Mine (the LLM was citing IDs bare and I asked for the rule).

### T7 — README

#### <a id="t7-1"></a>T7.1 — The README answers the brief; this log holds the reasoning

- **Decision:** The README is short and each of brief requirement 7's
  questions is answered in full on the page — a reviewer never has to open
  another file to learn how to run the program, how it is built, or what it
  assumes — while the reasoning behind each answer, and the alternatives
  rejected, stay here. Links point at specific entries (`docs/DECISIONS.md#q9`)
  rather than at the file. The assumptions section is themed prose followed by
  a one-row-per-question table, so it reads top to bottom and can also be
  checked for coverage at a glance.
- **Context:** T7a–T7d. This log is now about 85KB and ships with the
  submission, so the README could lean on it as heavily or as lightly as it
  liked.
- **Why:** The brief asks for a README, not for a documentation set, and the
  reviewer's first read is the one that has to work — an answer that is only a
  link is not an answer. Length is the cost of the reasoning, not of the
  answers, and the reasoning already has a home: restating a decision's
  rejected alternatives in the README would duplicate the entry that exists to
  hold them, and the two copies would drift. The table exists because T7d asks
  for every question to be covered and prose alone makes that claim
  unverifiable; the prose exists because the questions reinforce each other —
  letters-only names (Q9) are what make one-name-one-person (Q12) sound, and a
  table of seventeen rows cannot say so. **Rejected:** a standalone README that
  carries the reasoning inline, which is the most complete single document and
  duplicates most of this log; a concise README that answers a brief question
  with a link, which makes the reviewer assemble the answer; and a table with
  no prose, which is complete and says nothing about how the decisions fit
  together.
- **Origin:** Mine (the LLM offered standalone, concise-with-links, and full
  write-up; I took the concise shape and required that each brief question be
  answered in place, which is neither of the first two as offered). Themed
  prose followed by a coverage table: LLM-suggested, accepted.

#### <a id="t7-2"></a>T7.2 — The LLM account describes the workflow, not every decision

- **Decision:** The README's LLM section explains the working method — the
  frozen brief, the plan, this log with an **Origin** line on every entry, and
  all three imported into every session (T4.1) — and characterises the pattern
  of what was accepted, modified, and rejected, without walking through
  individual decisions. It points at the Origin lines as the evidence.
- **Context:** T7c. Brief 7.2.1 asks how LLM tools were used, and the Origin
  lines are an unusually specific record to be able to offer.
- **Why:** The reviewer can read the pattern in one page or audit it in the
  log, and the log is the better auditor: it is complete, dated by task, and
  names what the LLM recommended in the cases where I chose otherwise. A
  README walkthrough of those cases would be a hand-picked selection of the
  same material, which reads as advocacy where the log reads as a record.
  **Rejected:** a full account naming each case — where the LLM recommended
  failing fast on a bad line (Q7), keeping the byte-order mark out of the base
  (T6.6), and keeping the interactive hint (T6.13) — which is the strongest
  single-page evidence and is also the longest section in a README whose shape
  is concise (T7.1); and a two-sentence disclaimer, which leaves the method
  unexplained and wastes the record.
- **Origin:** Mine (the LLM recommended the full account with named examples).

#### <a id="t7-3"></a>T7.3 — The README says what was deliberately left out

- **Decision:** A short section names what is deferred to
  [UPGRADES](./UPGRADES.md) and why the line fell there, including the two
  ideas pulled into the base instead — stripping a byte-order mark
  ([T6.6](#t6-6)) and escaping quoted input ([T6.11](#t6-11)) — and what each
  had to show to earn it.
- **Context:** T7d. The brief grades how quality software is built, not scope,
  and `CLAUDE.md` makes deferral the default for anything the brief does not
  ask for.
- **Why:** Scope discipline is invisible in a diff: an absent feature and an
  unconsidered one look identical, and the two exceptions are only defensible
  if the rule they are exceptions to is stated. Naming the boundary also
  answers the question a reviewer would otherwise ask in the interview.
  **Rejected:** leaving it out, which keeps the README strictly about what was
  built and lets a deliberate omission read as an oversight; and mentioning
  each deferral where it is relevant, which scatters the boundary across the
  document so that no one place shows it was drawn on purpose.
- **Origin:** LLM-suggested, accepted.
- **Superseded in part by** [T10.11](#t10-11) (the section framed as what
  was deliberately left out; naming the base's boundary stands).

#### <a id="t7-4"></a>T7.4 — Example inputs live in `examples/`, the brief's among them

- **Decision:** Every input file the submission ships sits in `examples/`,
  including the brief's own, which moves from the repository root to
  `examples/input.txt` and keeps its name. `report.test.ts` and `cli.test.ts`
  follow it there; [T5.5](#t5-5)'s rule — that the test reads the shipped file
  rather than a copy — is unchanged, only the path.
- **Context:** T7e. The brief's example had been the only input file, so the
  root was a defensible home for it; adding four more made the root the wrong
  place for any of them.
- **Why:** One kind of thing belongs in one place, and a directory named for
  what it holds tells a reviewer that the extra files are part of the
  submission rather than scratch left behind. The brief's file keeps the name
  `input.txt` because that is the name the brief itself uses, so the run
  command in the prompt still reads across to this repository. **Accepted
  cost:** every run command grows by nine characters, and the shortest
  invocation in the brief (`analyze_network.rb input.txt`) no longer matches a
  path here. **Rejected:** keeping `input.txt` at the root and putting only the
  new files in `examples/`, which preserves the shortest command and leaves two
  homes for one kind of file, so the split reads as an oversight unless the
  README explains it; `fixtures/`, which names them for the test suite when
  their first audience is a reviewer at a command line; and renaming the
  brief's file to `brief.txt`, which is more descriptive beside its siblings
  and drops the one name the prompt already taught the reader.
- **Origin:** A single directory: Mine. Keeping the name `input.txt`: Mine (the
  LLM recommended `brief.txt`, with `examples/input.txt` offered as the
  alternative).

#### <a id="t7-5"></a>T7.5 — Five examples, each asserted exactly

- **Decision:** `examples/` holds the brief's example and four more, each
  chosen to show behaviour a reader cannot see in the output of the brief's
  file alone:
  - `late-declarations.txt` — every name used before it is declared (Q5, Q8,
    Q12), which the brief's guarantee does not require any implementation to
    accept.
  - `ties.txt` — an alphabetical tie-break (Q1) and code-unit ordering, where
    `Zebra` precedes `acme` (Q14).
  - `names-and-repeats.txt` — a keyword used as a name (Q9), a person and a
    company sharing one (Q12), a repeated contact counting twice (Q13), and a
    company with no employees (Q2).
  - `warnings.txt` — every warning the program can produce, including both
    wordings of a repeated declaration ([T6.8](#t6-8)) and a line broken by a
    literal non-breaking space, so the escaping in
    [T6.11](#t6-11) is shown rather than described.

  Each file is asserted through `main` for both its exact stdout and its exact
  stderr, and the README says what each one shows.

- **Context:** T7e. The brief asks for a README, not for examples, so this is
  scope beyond it, in the sense `CLAUDE.md` allows when an entry records the
  choice.
- **Why:** Most of the decisions in this log are invisible in the brief's
  example: it declares everything in order, has no tie, produces no warning,
  and never exercises a namespace. A reader can take the README's word for that
  behaviour, read the tests for it, or run it — and running it is the only one
  that costs them nothing and cannot be out of date. Asserting stderr as well
  as stdout is what makes `warnings.txt` worth shipping: its subject _is_ the
  wording, so a test that checked only the report would let every message drift
  while the example claimed to demonstrate them. Four files rather than two
  because each mixes a theme's decisions without mixing themes: putting the
  tie-break into the namespace file would leave a reader unsure which rule
  produced which line. **Rejected:** examples as documentation only, with no
  test, which is how an example quietly stops matching the program; asserting
  stdout alone, which leaves the warning wording — the point of one of the
  files — uncovered; and one combined file per theme pair, which halves the
  file count and makes each output harder to attribute.
- **Origin:** Examples, and the two the set had to include — a late
  declaration and every warning: Mine. The other two, and asserting stdout and
  stderr for each: LLM-suggested, accepted.

### T8 — Final pass

#### <a id="t8-1"></a>T8.1 — The read-through removes what nothing reads, and one invisible character

- **Decision:** Four changes from T8a's read-through. `EmployeeCommand` is
  deleted: it was exported and referenced nowhere, in production or in tests.
  `MalformedReason` loses its `export`, since only `parser.ts` uses it.
  `lines.ts` writes the byte-order mark as `"\uFEFF"` instead of the
  character itself. And `sameDeclaration` in `warnings.ts` narrows both
  declarations instead of asserting one from the other
  (`(b as typeof a).company`). `ParsedLine` and `NetworkResult` keep their
  exports although nothing outside their modules imports them: each is the
  return type of its layer's entry point, and a caller narrowing a result
  needs to be able to name it. `ContactCommand` stays, and is moved up beside
  the union it derives from: `network` names it three times, once to define
  the other three kinds as `Declaration`.
- **Context:** T8a, which asks for no dead code and no placeholder text.
- **Why:** An exported name is a promise that something depends on it, so one
  that nothing reads misleads the next person to change the module — while the
  two return types are read by anyone calling the function, whether or not this
  repository happens to import them today. The byte-order mark is the sharper
  find: the constant held a real U+FEFF, so the line read as `= "";` and the
  value could only be confirmed by running the file through a hex dump. That is
  the same failure the program itself refuses to ship — [T6.11](#t6-11) escapes
  invisible characters precisely so a reader is never asked to trust one — and
  a codebase that quotes input safely should not hide a character in its own
  source. The type assertion went because TypeScript can narrow both operands
  once asked; an assertion is a claim the compiler cannot check, kept here only
  to save one line. The remaining asymmetry between `ContactCommand` and the
  three kinds with no alias is the domain's own: a contact is an event and
  every line counts, while a declaration may not repeat (Q13), and no rule
  treats Partner, Company or Employee alone. Where a finer cut is needed,
  `network` makes it privately (`CompanyDeclaration`, `PersonDeclaration`, per
  Q12). **Rejected:** keeping `EmployeeCommand` against a future caller, which
  is dead code with an alibi; restoring all four aliases for symmetry, which
  names three subsets nothing refers to; un-exporting `ParsedLine` and
  `NetworkResult` for symmetry, which would leave `parseLine`'s own result
  unnameable outside the parser; and leaving the literal mark with a comment
  explaining it, which documents the hazard rather than removing it.
- **Origin:** LLM-suggested, accepted (all four surfaced by the read-through;
  the byte-order mark was found by scanning the source for non-ASCII
  characters, which is how it should have been found).

#### <a id="t8-2"></a>T8.2 — The requirement walk is a table in PLAN §8

- **Decision:** T8c's walk of brief requirements 1–7 and PLAN §7 is recorded as
  a table in [PLAN](./PLAN.md) §8: one row per requirement, naming the test or
  the command that shows it is met. The README does not repeat it.
- **Context:** T8c. Nothing said where the walk should be written down, and an
  audit that lives only in a conversation is not a record.
- **Why:** PLAN already owns the requirements — §2 restates them as FR1–FR6 and
  §7 is the definition of done — so the evidence belongs beside them, where
  anyone changing a requirement sees what proves it. Keeping it out of the
  README follows [T7.1](#t7-1), which settled that the README answers the
  brief's questions and does not carry the working record: thirty rows of test
  names would bury the answers a reviewer came for. **Rejected:** a separate
  `VERIFICATION.md`, which is a fifth document holding one table that PLAN has
  the context for; a README section, for the reason above; and reporting the
  walk in conversation only, which leaves the strongest evidence of coverage
  nowhere a reviewer can find it.
- **Origin:** Mine (the LLM offered PLAN, a new document, the README, and no
  file at all; the reasoning for PLAN over a new document was its own).

#### <a id="t8-3"></a>T8.3 — The reader tests keep their literal byte-order marks

- **Decision:** The five U+FEFF characters in `lines.test.ts` (the byte-order
  mark tests for Q16, at lines 87, 93, 99, 106 and 108) stay as literal
  characters rather than `﻿` escapes.
- **Context:** T8e, from an audit of the codebase. [T8.1](#t8-1) replaced the
  literal mark in `lines.ts` with an escape, on the grounds that a codebase
  which escapes invisible characters in its output should not hide one in its
  own source; the audit found the same characters in the tests.
- **Why:** T8.1 was a change to production source, where a reader needs the
  constant's value to follow the code; in the tests the character is the input
  under test, the bytes a real file would hold, and each test's name already
  says a byte-order mark is present. **Accepted cost:** read on screen, the
  inputs of these tests look the same as ordinary lines, so what they assert
  can only be confirmed with a hex dump or an editor that shows the character.
  **Rejected:** escaping them, which the audit recommended, to match T8.1.
- **Origin:** Mine (the LLM recommended replacing them with `﻿`).

#### <a id="t8-4"></a>T8.4 — File paths and I/O errors are escaped too

- **Decision:** An error about reading or writing names the file in quotes, and
  the path and the cause are both escaped by the same rule as quoted input
  ([T6.11](#t6-11)): `cannot read "": ENOENT: ...`,
  `cannot read "bad[31m": ...`. Standard input is still named in words,
  unquoted. These messages are escaped but not capped at 200 characters.
  `warnings.ts` gains `readFailure` and `writeFailure` for them, so every line
  of stderr is still worded there ([T6.5](#t6-5)).
- **Context:** T8e, from an audit of the codebase. `cli.ts` put the file
  argument into the message as given, so an empty argument read
  `cannot read : ENOENT`, and a path holding a terminal escape sequence sent
  the raw ESC byte to stderr twice: once from our message and once inside
  Node's, which repeats the path.
- **Why:** T6.11's point is that nothing a user or a file supplies reaches the
  terminal unescaped, and a path is supplied by the user just as a line is —
  often by a script that did not choose it (`find ... -exec`). Escaping the
  cause as well is what closes it, since Node's message carries the path a
  second time. Quoting makes an empty path visible as `""`, so one change
  fixes both problems. No cap, because an error message cut short loses its
  cause, and a path is bounded by the operating system anyway. **Rejected:**
  treating an empty argument as a bad invocation, which adds a rule to Q15 and
  leaves escape sequences in paths untouched; fixing the empty path alone, for
  the same reason; and reusing the capped quote from T6.11, which could cut a
  long path's error before its cause.
- **Origin:** LLM-suggested, accepted (the escape sequence found while
  reviewing the empty-path fix from an audit).

#### <a id="t8-5"></a>T8.5 — Warnings held in memory by a slow stderr: accepted

- **Decision:** No change to how warnings are written. When stderr drains
  slower than warnings are produced, every pending warning is held in memory
  until it is written; this is recorded as a known cost of
  [T6.15](#t6-15), which writes warnings without waiting so that typed input
  is answered at once, and which did not state it.
- **Context:** T8e, from an audit of the codebase. Measured on macOS with
  500,000 malformed lines: about 95 MB with stderr sent to a file, and about
  500 MB when the reader of a stderr pipe stalled. Per Node's documentation,
  writes to a pipe on stdout or stderr are synchronous on Linux and Windows,
  so there a slow reader makes the program wait instead.
- **Why:** The cost needs input that is almost all bad lines and a reader that
  stops reading, on a platform where pipe writes are asynchronous. The fix
  would wait for `drain` when a write reports a full buffer, and it has to
  stop waiting on `close` and `error` too, or a stderr that dies mid-run hangs
  the program — a hang is worse than memory use, and T6.15 already accepts
  losing warnings silently when stderr fails. **Rejected:** waiting for
  `drain` when the buffer is full, for the hang risk above and the edge-case
  test it would need; and leaving the cost unrecorded, which leaves T6.15
  claiming a policy without its price.
- **Origin:** LLM-suggested, accepted (found and measured in an audit of the
  codebase).

### T9 — Upgrades

#### <a id="t9-1"></a>T9.1 — Upgrade work is one PLAN task, subtasks per upgrade

- **Decision:** Work on [UPGRADES](./UPGRADES.md) entries is PLAN task T9,
  with lettered subtasks in the order built: one per upgrade when it fits a
  single commit (T9a is U7, T9b is U8), several when it does not, each naming
  the upgrade it builds. Its decisions go in this section and its commits are
  prefixed `T9:`. A `U<n>` keeps naming the idea; the subtask names the work
  of building it, and the upgrade's entry in UPGRADES is marked built with a
  pointer here, as U2 and U3 already are.
- **Context:** Before starting U7 and U8, the first upgrades built after the
  base. `CLAUDE.md` ties every commit prefix and every DECISIONS section to a
  PLAN task, and T0–T8 are complete.
- **Why:** The rules already in place then apply unchanged: one task per
  commit, decisions in the section of the task in progress, subtasks as commit
  boundaries ([T2.1](#t2-1)). **Rejected:** a PLAN task per upgrade (T9, T10,
  …), which gives each its own commit prefix but grows the task list with
  every idea, most of them small; and keeping upgrades outside the task scheme
  with `chore:` commits and a section keyed by U ID, which leaves PLAN §6
  closed at the base but adds a second ID scheme for decisions to the Key.
- **Origin:** LLM-suggested, accepted.
- **Superseded in part by** [T10.1](#t10-1) (the web UI and the file editor
  are task T10; the other upgrades stay in T9).

#### <a id="t9-2"></a>T9.2 — The base is tagged `base-submission`, and the README says so

- **Decision:** An annotated tag, `base-submission`, marks `c8fc833`, the T8
  commit that completes the brief. Its message says what it marks. The README
  names the tag in one sentence near the top. The tag is created locally;
  pushing it (`git push origin base-submission`) is mine to do, as every push
  is.
- **Context:** T9a, building [U7](./UPGRADES.md#u7). The hand-in email
  promises that the submitted version stays on its own tagged commit, so the
  tag has to exist before the email is sent and before any upgrade lands.
- **Why:** A name that says what the commit is serves a reviewer better than a
  version number: `v1.0.0` implies a release line this repository does not
  have, while `base-submission` reads the same way the email and the README
  describe it. Annotated, because an annotated tag carries its own date,
  author and message, which is what makes it a record rather than a bookmark,
  and `git describe` ignores lightweight tags by default. The README names it
  because a reviewer who opens the repository after upgrades have landed would
  otherwise read a README describing features the brief never asked for, with
  no sign that an earlier, exact answer exists. **Rejected:** `v1.0.0`, for the
  reason above; a lightweight tag; and leaving the tag to the email alone,
  which the reviewer may not have open when they read the repository.
- **Origin:** Tag name and annotation: LLM-suggested, accepted. Naming it in
  the README: LLM-suggested, accepted.

#### <a id="t9-3"></a>T9.3 — Coverage is a report, not a gate

- **Decision:** `@vitest/coverage-v8` is a dev dependency, and
  `npm run coverage` runs the suite with coverage over every file in `src/`
  except tests, printing a text table and writing an HTML report to
  `coverage/` (already ignored by git, ESLint and Prettier). `npm run check`
  is unchanged and has no threshold. The options are flags in the script
  rather than a `vitest.config.ts`, since this is the only configuration the
  suite needs.
- **Context:** T9b, building [U8](./UPGRADES.md#u8). A one-off measurement
  with `npm install --no-save`, taken before deciding as U8 suggested, gave
  96.75% of lines and 93.66% of branches. Every one of the 15 uncovered spots
  is one of four kinds: five `assertNever` defaults, which the types make
  unreachable; `bin.ts`, which the process-level tests run in a child process
  that V8 does not count ([T6.10](#t6-10)); `compareNames` returning 0, which
  is only ever given two different names (company names are unique, and
  people's names are unique by Q12); and two fallbacks for a thrown value that
  is not an `Error`.
- **Why:** The measurement found no untested path, so a gate would guard a
  number rather than behaviour: the only way to raise it is tests aimed at
  code the compiler proves unreachable, or ignore comments that exist to
  satisfy the threshold. A report still does the job U8 set out, replacing
  "the tests cover the core logic" with a figure anyone can reproduce, and it
  shows a new untested branch the next time someone runs it. `include` is set
  to all of `src/` so a file no test imports shows up as 0% rather than being
  left out. Lines and branches, as U8 asked, because branch coverage is the
  one that shows an untested failure path. **Rejected:** a gate in `check`
  with a threshold at today's floor, for the reason above; and measuring once,
  recording the figures here, and not adding the dependency, which is the
  cheapest option and leaves nothing to re-measure with.
- **Origin:** Report only: LLM-suggested, accepted after the measurement
  above.
- **Superseded in part by** [T9.11](#t9-11) (flags in the script rather than
  a config file; coverage as a report, not a gate, stands).

#### <a id="t9-4"></a>T9.4 — The remaining upgrades are built U5, U6, U4, then the UI, then U1

- **Decision:** After U7 and U8, the upgrades are built in this order: `--help`
  and a usage line ([U5](./UPGRADES.md#u5)), the opening explanation for typed
  input ([U6](./UPGRADES.md#u6)), tie handling ([U4](./UPGRADES.md#u4)), the
  local web UI ([U9](./UPGRADES.md#u9)), and last the file builder
  ([U1](./UPGRADES.md#u1)) as a panel of that UI. PLAN §6 lists them as T9c
  onward.
- **Context:** Planning the rest of T9, when the web UI was added as an
  upgrade and placed ahead of the builder.
- **Why:** U5 and U6 come first because they write the one explanation of the
  commands (Q18) that the UI's console and the builder then show; built after
  the UI, that text would be written for the page and pulled back out. U4
  comes before the UI because surfacing a tie adds a kind of stderr line
  (Q21), and the console renders stderr, so the UI is built against the final
  set of line shapes rather than chasing a new one. U1 comes after the UI
  because it is now a panel of it ([T9.8](#t9-8)). **Rejected:** the UI
  first, which reaches the visible feature soonest but builds its console
  twice; and U4 last, which is independent of everything else but would add a
  stderr shape after the console that displays them.
- **Origin:** The UI before the builder: Mine. The order of U5, U6 and U4
  around it: LLM-suggested, accepted.
- **Superseded in part by** [T10.2](#t10-2) (U1 is built inside the UI, as
  its file editor, before the console; the rest of the order stands).
- **Superseded in part by** [T10.4](#t10-4) (U10, the company queries, is
  built between U4 and the UI).

#### <a id="t9-5"></a>T9.5 — A local web UI whose terminal runs Herbie, not a shell

- **Decision:** [U9](./UPGRADES.md#u9) is a web page served on this machine
  that lists input files, shows the report for one, and embeds a terminal
  pane. The terminal is a Herbie console: it runs herbie-lite and nothing
  else, taking typed commands the way the CLI's interactive entry does
  (warnings as each line is typed, the report at the end) or a listed file. It
  cannot start a shell or any other program. The limit is on the UI's
  embedded pane alone: herbie-lite run from a user's own terminal stays an
  ordinary command-line program, and nothing in the cli checks for, detects,
  or restricts the shell it is run from.
- **Context:** Planning U9. "Embed a terminal" could mean a real shell in the
  page or a terminal-styled view of this program.
- **Why:** Everything the UI is for — trying commands, running a file, seeing
  warnings as they appear — is herbie-lite's own input and output, which the
  cli already exposes as `main(args, stdin, stdout, stderr)` ([T6.2](#t6-2)).
  A shell adds nothing the page needs, and it turns a local server into one
  that runs arbitrary commands for any request that reaches it, so the whole
  design would be about locking that down. It would also need `node-pty`, a
  native module that has to compile on install. **Rejected:** a real shell
  (`node-pty` and xterm.js), which is the most flexible and the most
  dangerous thing a local server can offer.
- **Origin:** A local web UI with an embedded terminal, placed before the
  builder: Mine. Limiting the terminal to Herbie: LLM-suggested, accepted.
  Confining that limit to the UI's pane, and leaving the cli in a real
  terminal untouched: Mine.
- **Superseded in part by** [T9.12](#t9-12) (the console takes no typed
  commands; it runs files. Herbie-only, not a shell, stands).
- **Superseded in part by** [T11.5](#t11-5) ("not a shell": the console is
  a shell that runs herbie-lite only; nothing else runs).

#### <a id="t9-6"></a>T9.6 — The UI's files: examples read-only, a workspace for the rest

- **Decision:** The UI lists two folders. `examples/` is shown read-only: its
  files can be read and run but not edited or deleted. A new `inputs/` folder,
  ignored by git, is the workspace, where files can be created, read, edited,
  run and deleted. An example can be copied into `inputs/` to change it.
- **Context:** Planning U9. Every file in `examples/` is asserted for exact
  stdout and stderr ([T7.5](#t7-5)), and `examples/input.txt` is the file the
  definition of done is judged by ([T5.5](#t5-5)).
- **Why:** An edit or deletion in `examples/` would make `npm run check` fail,
  and a UI that can quietly break the test suite from a browser tab is a trap.
  Keeping the workspace out of git means experiments never show up as changes
  to the submission. **Rejected:** `examples/` fully editable, which is one
  folder and one rule but breaks the suite on the first save; and a folder
  chosen at startup, which is the most flexible but leaves the examples out
  unless the user names that folder, and makes path confinement depend on an
  argument.
- **Origin:** LLM-suggested, accepted.
- **Superseded in part by** [T10.16](#t10-16) (the `inputs/` folder; the
  workspace is in browser storage. Examples read-only stands).

#### <a id="t9-7"></a>T9.7 — The page is plain TypeScript bundled by Vite, served by `node:http`

- **Decision:** The browser code is TypeScript with no UI framework, bundled
  by Vite (already a dev dependency, T1.9). The server is Node's own
  `node:http`, with no Express or similar.
- **Context:** Planning U9. The page has a few panels: a file list, a viewer
  and editor, the console, and later the builder.
- **Why:** A few panels do not need a framework's component model, and every
  dependency added is one more thing for a reviewer to read past and to keep
  current. Vite is already installed and type-checks nothing itself, so
  `tsc` stays the gate for browser code as it is for the rest (T0.1). A small
  router over `node:http` serves a handful of routes. **Rejected:** React and
  Vite, which pays off if the builder grows complex and adds a framework to a
  submission that has none; and hand-written JavaScript with no build, which
  drops type checking from the one part of the project a browser runs.
- **Origin:** LLM-suggested, accepted.
- **Superseded in part by** [T10.16](#t10-16) (served by `node:http`; the
  page is static. Plain TypeScript bundled by Vite stands).

#### <a id="t9-8"></a>T9.8 — The file builder is a panel of the UI, not a CLI mode

- **Decision:** [U1](./UPGRADES.md#u1) is built as a panel of the web UI: lines
  are typed into the page, each is checked with the same `parseLine` the CLI
  uses, and the result is saved into `inputs/`. The CLI mode U1 first
  described is dropped. This answers U1's third open question, _a separate
  mode or command from the analyzer?_, as neither: a panel.
- **Context:** Planning U9 and U1 together, once the UI was placed before the
  builder.
- **Why:** A builder is a form with live validation, which is what a page is
  good at and a line-oriented terminal is not: a panel can mark one line as
  bad without scrolling it away, and show which names are still waiting to be
  declared (Q8) across the whole draft. Running the parser in both places
  keeps one definition of a valid line. **Rejected:** a CLI mode shown in the
  terminal pane, which also works without the UI but is limited to text
  prompts; and both, which puts the same feature behind two interfaces to
  test.
- **Origin:** LLM-suggested, accepted.
- **Superseded in part by** [T10.2](#t10-2) (the builder is the UI's file
  editor, not a panel of typed lines; a panel of the UI rather than a CLI
  mode stands).

#### <a id="t9-9"></a><a id="q18"></a>T9.9 — Q18: The help text is built from the grammar table

- **Decision:** A new cli helper, `help.ts`, holds the usage string, the
  `--help` text, and `commandSyntax`, which moves there from `warnings.ts`.
  Each command's shape in the help is built from `COMMAND_SYNTAX`, and the
  contact types from `CONTACT_TYPES`; only prose is written out, including a
  one-line description of each command in the brief's terms, held in a
  `Record` over every command kind so a new command cannot reach the help
  without one. `warnings.ts` imports `commandSyntax` and the usage string, so every
  line of stderr is still worded there ([T6.5](#t6-5)). The README's run forms
  stay hand-written, and a test asserts that the README contains the usage
  string verbatim. The help's full text is also asserted exactly.
- **Context:** T9c, building [U5](./UPGRADES.md#u5). U6's opening explanation
  and the UI's console will show the same commands, so the text needed one
  home before any of them was written.
- **Why:** The grammar already has one source ([T2.5](#t2-5)), and the parser
  and the warnings both read it; help written out by hand would be a third
  description free to disagree with the first two. `help.ts` rather than
  `warnings.ts` because `--help` goes to stdout and is not a warning; the
  dependency runs one way, from `warnings.ts` to `help.ts` to `parser.ts`.
  The README test catches the one drift the table cannot prevent: the usage
  string changing without the README following. **Rejected:** generating the
  README's run section from code, which removes the drift entirely but makes
  the README a build output; help text written by hand beside a test that
  checks it against `COMMAND_SYNTAX`, which catches drift after the fact
  rather than making it impossible; and putting the help in `warnings.ts`,
  which would make that module about more than stderr.
- **Origin:** LLM-suggested, accepted (the default recorded in PLAN §4,
  confirmed when T9c started).

#### <a id="t9-10"></a><a id="q19"></a>T9.10 — Q19: `--help` and `-h` are the only options

- **Decision:** `--help` or `-h` anywhere in the arguments prints the help to
  stdout and exits 0, whatever else is there. Any other argument starting with
  `-`, including `-` alone, is an unknown option: one line on stderr,
  `herbie-lite: unknown option "--verbose"; usage: node dist/bin.js [--help | file]`,
  and exit 1. `-` does not mean STDIN, and a file whose name starts with `-`
  is reached as `./-name`. The existing too-many-arguments error gains the
  same usage ending. The usage names `node dist/bin.js`, the command a user
  types, not the `herbie-lite` prefix, and the option is escaped like any
  other text the user supplied ([T8.4](#t8-4)). Writing the help follows the
  same closed-pipe rule as the report (Q17), so `--help | head -1` ends
  quietly.
- **Context:** T9c, building [U5](./UPGRADES.md#u5). [Q15](#q15) allowed one
  optional path and nothing else, and deferred `--help` to U5.
- **Why:** `--help` winning wherever it appears matches most command-line
  tools, so someone who appends it to a failing command gets help rather than
  a second error. Treating every other dash argument as unknown keeps the
  argument rule as small as Q15's: a path or `--help`, nothing else. `-` for
  STDIN is the conventional partner of a file argument, but STDIN is already
  what no argument means, so it would be a second way to say the same thing.
  The usage goes on the error's own line, because [T6.7](#t6-7) makes every
  stderr line one prefixed line per problem, and a second, unprefixed usage
  line would be the first exception. `herbie-lite` is not a command anyone
  can run, since there is no `bin` entry ([T1.4](#t1-4)), so a usage line
  naming it would be wrong the first time it was followed. **Rejected:**
  `--help` accepted only as the sole argument, which is stricter and turns
  `node dist/bin.js input.txt --help` into an error; `-` as STDIN; an unknown
  option read as a file name, which turns `--verbose` into
  `cannot read "--verbose"` and hides the mistake; and a separate usage line
  after the error.
- **Supersedes:** [Q15](#q15), in part: its "no `--help`, no usage line".
  One optional path, and exit 1 with no report for a bad invocation, stand.
- **Origin:** The rule itself: LLM-suggested, accepted (the default recorded
  in PLAN §4, confirmed when T9c started). `--help` winning anywhere, and the
  usage naming `node dist/bin.js`: LLM-suggested, accepted. The usage on the
  error's line rather than below it: LLM-suggested, accepted (raised while
  building T9c, chosen over a separate line with or without the prefix).
- **Superseded in part by** [T10.4](#t10-4) (`--help` and `-h` as the only
  options; the rest stands).

#### <a id="t9-11"></a>T9.11 — Coverage settings live in `vitest.config.js`, and the table lists every file

- **Decision:** The coverage options move from flags in the `coverage` script
  into a new `vitest.config.js`, which also sets the text reporter's
  `skipFull: false`, so the table lists every file in `src/`, including those
  at 100%. The script becomes `vitest run --coverage`. The file is plain
  JavaScript and ESLint lints it without type information, as it already
  does `eslint.config.js`.
- **Context:** T9 follow-up to T9b, found while checking T9c's coverage:
  `help.ts` was missing from the table. Vitest's text reporter leaves out
  fully covered files, so `help.ts` and `assert-never.ts` were missing from a
  report T9.3 describes as covering every file. The option is per reporter,
  and no command-line flag can set it (`--coverage.skipFull` changes
  nothing); only a config file can.
- **Why:** A coverage table that silently drops files answers "is this file
  tested?" with nothing, and the files it drops are the best-covered ones, so
  a reader looking for them finds only confusion. T9.3 chose flags over a
  config file because the suite needed no other configuration; that stopped
  being true once the one setting that fixes the table turned out to be
  unreachable by flags. Plain JavaScript because the TypeScript project's
  `rootDir` is `src/`, and a `.ts` config at the root would need the tsconfig
  reworked for one file of settings. **Rejected:** a README sentence
  pointing at the HTML report, which lists every file but leaves the table
  misleading; leaving the table as it was; and `vitest.config.ts`, typed but
  outside the TypeScript project as it stands.
- **Supersedes:** [T9.3](#t9-3), in part: its choice of flags in the script
  over a `vitest.config.ts`. Coverage as a report rather than a gate stands.
- **Origin:** LLM-suggested, accepted (the gap was found while verifying T9c).
  Plain JavaScript following `eslint.config.js`: LLM-suggested, as part of
  the change.

#### <a id="t9-12"></a><a id="q20"></a>T9.12 — Q20: Commands come from a file; a bare run explains how

- **Decision:** Commands are read from a file, named or piped in, and never
  typed. When no file is named and STDIN is a terminal, the program reads
  nothing: it prints an opening to stdout and exits 1 with no report. The
  opening is the greeting, how to give a file (`node dist/bin.js <file>`, or
  `npm start -- <file>` from source), and the same command section `--help`
  shows: each command's shape and description, the contact types, and the
  letters-only rule. It is `OPENING` in `help.ts`, assembled from sections it
  shares with `HELP` (Q18), and its write follows Q17 like the report's. A
  stream counts as a terminal only if it carries `isTTY: true`. `--help` no
  longer mentions typing or Ctrl+D. Commands are written by editing input
  files, in any editor or in the web UI's workspace editor ([T9.6](#t9-6)),
  which shows the command reference from `help.ts` beside the file; the UI's
  console runs a file and shows its output, and takes no typed commands.
- **Context:** T9d, building [U6](./UPGRADES.md#u6). U6 was to greet typed
  input with an explanation of the commands. With that built and seen, the
  question became whether typing commands into the program should be a way to
  write them at all; the explanation was kept, as the answer to a run with
  nothing to read.
- **Why:** A file is the one form of input that can be read again, fixed, and
  rerun: a typed session is lost at Ctrl+D, and a mistake on line 40 means
  typing all forty lines again. Warnings are most useful there too, since
  each names a line to go and fix. Pipes stay because a pipe is file contents,
  not typing, and it is one of the brief's two run forms. A bare run still
  explains the commands, because the person who runs the program with nothing
  is the one who most needs to know what to write. stdout, because the
  opening is help, and help goes where `--help`'s does; that also leaves every
  stderr line a prefixed problem line ([T6.7](#t6-7)). Exit 1, because no
  report was produced, which is what exit 1 means ([T6.1](#t6-1)), so a script
  that forgets its file argument still fails; this is what `git` does when run
  with no arguments. **Rejected:** keeping interactive entry with the opening
  on stderr (U6 as first built in this subtask), which helps a typed session
  and still loses it at Ctrl+D; a one-line error in place of the opening,
  which refuses without saying what to write; the opening on stderr, which
  keeps stdout for reports only but needs an exception to T6.7 for
  multi-line unprefixed text; the opening on stdout with exit 0, a friendly
  `--help`, which makes exit 0 stop meaning a report was produced; and
  accepting only a file argument, which drops the brief's pipe example for no
  gain.
- **Supersedes:** in part, [T1.10](#t1-10) (interactive entry; file and STDIN
  input stand), [T6.2](#t6-2) (nothing in `main` asks whether a stream is a
  terminal), [T6.13](#t6-13) (typing commands still works, and nothing extra
  is printed at a terminal), and [T9.5](#t9-5) (the UI console taking typed
  commands the way the CLI's interactive entry does; it runs files).
- **Origin:** Commands only from files, with editing as the way to write
  them: Mine, reversing my own T1.10 after U6's explanation was built and
  seen. Keeping the explanation, for a bare run and in `--help`: Mine. stdout
  with exit 1: LLM-suggested, accepted after the tradeoffs were set out.
  Keeping pipes: LLM-suggested, accepted.

#### <a id="t9-13"></a>T9.13 — Warnings print once, in line order

- **Decision:** Every warning waits until all input is in, then prints in one
  pass sorted by line number, whether the parser or resolution found it. A
  malformed line's warning is formatted when the line is read and held as
  text. If the read fails partway, the warnings for the lines already read
  print first, then the failure. The reader still streams, and warnings are
  still not awaited ([T6.15](#t6-15)).
- **Context:** T9e, from the reversal in [T9.12](#t9-12): commands now come
  only from a file, and typed input was the reason stderr was in two passes.
  [T6.7](#t6-7) printed a malformed line's warning as it was read, so a typed
  mistake was answered at once, and recorded the out-of-order stderr as the
  price.
- **Why:** With nothing typed, the only thing two passes still bought was an
  early warning on a slow pipe, which no use of this program involves, while
  its cost fell on everyone: a warning for line 12 printed before one for line
  2, and the README spent a paragraph explaining why. In line order, stderr
  reads like the file, so problems can be fixed top to bottom. The order is
  total, because a line yields at most one warning — a malformed line never
  reaches resolution — which is [T4.3](#t4-3)'s argument extended to the
  parser's warnings. Holding the formatted text rather than the line keeps
  each held warning within [T6.11](#t6-11)'s 200-character cap, however long
  the line was. Printing held warnings before a read failure keeps what the
  two passes already showed: the lines that were read were still discarded,
  and the user should hear about them. The streaming reader stays, because
  its reason to exist is exact line numbering ([T6.4](#t6-4)), which does not
  depend on when warnings print. **Rejected:** keeping two passes, which
  costs nothing to leave alone but keeps an ordering whose only reason is
  gone; and dropping the held warnings when a read fails, which is simpler
  and silently loses discards the program had already found.
- **Supersedes:** [T6.7](#t6-7), in part: malformed lines printed as they are
  read, and stderr in two passes. The warning's shape stands.
- **Origin:** Revisiting the order once typed input was gone: LLM-suggested,
  accepted. One pass in line order: LLM-suggested, accepted after the
  tradeoffs were set out. Printing held warnings before a read failure:
  LLM-suggested, accepted (raised while building T9e).

### T10 — Remaining upgrades

#### <a id="t10-1"></a>T10.1 — The web UI and the file editor are their own task

- **Decision:** The local web UI ([U9](./UPGRADES.md#u9)) and the file editor
  that is U1's builder ([T10.2](#t10-2)) are PLAN task T10, not part of T9,
  with subtasks T10c–T10i in the order already planned: scaffold, server,
  file API, files panel, editor, console, README. Their commits are prefixed
  `T10:` and their decisions go in this section. T9 ends with tie handling
  (T9f). Decisions already made about the UI in T9 (T9.5–T9.8) stay where
  they were made.
- **Context:** Before T9f. [T9.1](#t9-1) put all upgrade work under T9, and
  the UI's seven subtasks would have made T9 two tasks in one: small changes
  to the command-line program, and a second program with its own server,
  build and page.
- **Why:** The UI is one feature built across seven commits, and a task of its
  own lets its history read as one piece, from the scaffold to the README,
  rather than as the tail of a list of CLI changes; it also gives the UI's
  decisions one section to be read in. T9.1's rejection of a task per upgrade
  still holds for small upgrades; the UI is the one large enough to be a task.
  **Rejected:** keeping it in T9, which T9.1 chose and which buries the UI's
  commits among unrelated ones; and a task per upgrade, T9.1's rejected
  alternative, which would also split U4 and the tag into tasks of one commit
  each.
- **Supersedes:** [T9.1](#t9-1), in part: all upgrade work under T9. One task
  with lettered subtasks, for the other upgrades, stands.
- **Origin:** Mine.
- **Superseded in part by** [T10.5](#t10-5) (T10 holds every remaining upgrade, and T9 ends at T9e; the rest stands).

#### <a id="t10-2"></a>T10.2 — The file builder is the UI's file editor

- **Decision:** [U1](./UPGRADES.md#u1) is built as the web UI's in-browser
  file editor, not as a separate builder panel. It creates and edits
  workspace files as text, with the command reference from `help.ts` beside
  it ([T9.12](#t9-12)), checks each line as it is edited (Q29), and saves into
  `inputs/`. It is its own subtask, T10g, between the files panel (T10f:
  list, viewer, delete, copy an example) and the console (T10h). How a save
  behaves on a clash or a failure (Q30) moves to the file API (T10e), which
  is where saving is built.
- **Context:** Before T9f, reviewing what was left. [T9.8](#t9-8) planned the
  builder as a panel where lines are typed and checked one at a time; since
  then [T9.12](#t9-12) made editing files the way commands are written, and
  the files panel was already to have an editor.
- **Why:** With editing as the way to write commands, a builder panel beside
  an editor would be two ways to write one file, and the builder's only
  distinct feature — checking each line as it is written — is as useful in
  the editor, where it also covers files that already exist. One editor with
  the checks is less to build and to test, and nothing a user can do is lost.
  The editor gets its own subtask because it carries the checking and saving
  logic, which is most of U1, and would make the files panel's subtask too
  large for one commit. **Rejected:** the builder panel as planned in T9.8,
  which duplicates the editor; and dropping U1, leaving a plain editor with
  no line checks, which loses the convenience U1 was for.
- **Supersedes:** in part, [T9.8](#t9-8) (lines typed into a builder panel;
  a panel of the UI rather than a CLI mode stands) and [T9.4](#t9-4) (U1
  built last, after the whole UI; it is now built inside it, before the
  console).
- **Origin:** The builder as an in-browser file editor: Mine. Giving it its
  own subtask, and moving Q30 to the file API: LLM-suggested.
- **Superseded in part by** [T10.16](#t10-16) (saving into `inputs/`; it
  saves into the browser workspace).
- **Superseded in part by** [T10.20](#t10-20) (placed before the console; the
  console now comes first).

#### <a id="t10-3"></a>T10.3 — A tie is noted, not ranked

- **Decision:** [U4](./UPGRADES.md#u4) is built as a note that a tie
  happened and nothing more. The report line keeps the brief's format and
  the alphabetical winner (Q1); no signal ranks tied partners, now or as an
  option. Where the note goes and how it reads is left to Q21, settled in T10a.
- **Context:** Planning the tie note, now T10a ([T10.5](#t10-5)). U4 listed four directions: weighting contact
  types, recency, breadth of employees reached, and surfacing the tie.
- **Why:** The cost Q1 recorded is that the alphabetical winner is arbitrary
  and the output hides it; a note removes the hiding, which is the part that
  misleads a reader. Every ranking departs from something the program rests
  on: weighting from the brief's "total amount of Contacts", recency from an
  input with no dates, and breadth from the one definition of strength the
  report uses. The partners query planned beside this ([T10.4](#t10-4)) also
  shows tied partners in full, for anyone who wants more than the note.
  **Rejected:** weighting contact types behind an option, which puts a
  second definition of strength into the program; breadth as a tie-break,
  which is defensible but is a new rule to explain for a case the brief
  never shows; and marking the report line, which changes the brief's
  format.
- **Origin:** Mine. Surfacing the tie while keeping the line and the ranking
  was already Q21's default (LLM-suggested); ruling out the other directions
  entirely: Mine.

#### <a id="t10-4"></a>T10.4 — Queries about one company are command-line options

- **Decision:** Two queries are added as an upgrade,
  [U10](./UPGRADES.md#u10): which partners have contacted a given company,
  and which of its employees each partner has contacted. They are asked for
  with command-line options alongside the input file, such as
  `node dist/bin.js input.txt --partners Globex`, not with lines in the file
  and not only in the web UI. They are built as T10b, after the tie note and
  before the UI. The option names, what each prints, and how a query meets
  the report and a bad company name are PLAN §4's Q31–Q33.
- **Context:** Planning the rest of the upgrades. The brief's first example question is "Who do we
  know who works at ACME Co?", and [T1.13](#t1-13) kept raw contacts rather
  than tallies partly so questions like it could be answered later. Commands
  now come only from a file ([T9.12](#t9-12)), so there is no typed session
  to ask a question in.
- **Why:** An option keeps the input file as data alone and the question on
  the command line where the file is named, so one file answers any number
  of questions, and a script can ask them. The web console runs the program
  on a file (Q28), so the same options can be offered there later with no
  second implementation. Built before the UI for [T9.4](#t9-4)'s reason: the
  console is built against the program's final set of outputs rather than
  catching up with a new one. **Rejected:** query lines in the input file
  (`Show Globex`), which mixes questions with the facts they ask about, so
  every file becomes a query script and a new keyword enters the grammar;
  and queries in the UI only, which waits for T10 and leaves the command-line
  program unable to answer.
- **Supersedes:** [Q19](#q19), in part: `--help` and `-h` as the only
  options. `--help` winning wherever it appears, other dash arguments being
  unknown options, and `-` not meaning STDIN stand. Also [T9.4](#t9-4), in
  part: its order gains U10 between U4 and the UI.
- **Origin:** The two queries: Mine. Command-line options, over lines in the
  file or the UI alone: LLM-suggested, accepted. Building them before the
  UI: LLM-suggested, accepted.

#### <a id="t10-5"></a>T10.5 — Every remaining upgrade is part of T10

- **Decision:** T9 closes at T9e. The upgrades still to build are all T10,
  lettered in the order built: the tie note is T10a and the company queries
  T10b (planned a moment earlier as T9f and T9g), and the web UI and file
  editor move down two letters, to T10c–T10i. PLAN §4's questions and
  [UPGRADES](./UPGRADES.md) point at the new letters, and so do the subtask
  citations in [T10.1](#t10-1) and [T10.2](#t10-2), as the Key allows when
  IDs are restructured.
- **Context:** After planning the tie note ([T10.3](#t10-3)) and the queries
  ([T10.4](#t10-4)). T10.1 had made T10 the UI alone and left tie handling
  as the end of T9.
- **Why:** The remaining upgrades are one stretch of work still to do, and
  T9 is otherwise finished; one open task for them shows at a glance what is
  left and what is done, instead of an almost-complete T9 with two stray
  subtasks. The tie note and the queries keep their place before the UI for
  [T9.4](#t9-4)'s reason, which is why they take the first letters.
  **Rejected:** keeping them in T9, which T10.1 chose and which leaves two
  unfinished tasks open at once; and lettering them after the UI (T10h,
  T10i) so the UI keeps its letters, which breaks the rule that subtasks are
  lettered in the order built ([T2.1](#t2-1)).
- **Supersedes:** [T10.1](#t10-1), in part: T10 as the UI and file editor
  alone, and T9 ending with tie handling. One task for the UI's subtasks,
  and the decisions made about the UI in T9 staying where they were made,
  stand.
- **Origin:** Mine.

#### <a id="t10-6"></a><a id="q21"></a>T10.6 — Q21: A tie is one note on stderr, after the report

- **Decision:** For each company whose line names one of several equally
  strong partners, one line goes to stderr once the report is written:
  `herbie-lite: Zebra is a tie between Al and Bo (1 contact each); Al is shown because it comes first alphabetically`.
  Three or more partners read `Ada, Bo and Cy`, and `contacts` is plural
  above 1. The partners are listed in the order Q1 ranks them, so the first
  is the one the line shows. Warnings still print before the report; notes
  print after it, in the report's company order, and only if the report was
  written. A tie below the strongest partner is not noted, and the exit code
  is unchanged. `tieNote` in `warnings.ts` words it, so every stderr line is
  still worded there ([T6.5](#t6-5)).
- **Context:** T10a, building [U4](./UPGRADES.md#u4) as a note only
  ([T10.3](#t10-3)). [T6.6](#t6-6) and [T6.14](#t6-14) had avoided any
  stderr line that is not a discarded line. A first version printed
  `herbie-lite: tie at Zebra: Al and Bo are tied at 1; the report names Al, first alphabetically`
  before the report; seen in a terminal, it read as confusing.
- **Why:** stderr is the one place a note can go without changing the
  brief's report format, and it keeps `> report.txt` a clean file. After the
  report, because a note explains a line, and in a terminal an explanation
  printed first reads as a heading for lines not yet seen, while one printed
  after reads as a footnote. Warnings stay before the report because they
  are about the input, follow its line order ([T9.13](#t9-13)), and may
  explain why a number is lower than expected. Only when the report was
  written, because a failed write leaves no line to explain. The wording
  names the company as the sentence's subject, not in the slot where a
  warning has its line number, so the note cannot be read as another report
  line; it says why the shown partner was chosen in plain words rather than
  naming "the report". Only the top tie, because it is the only one that
  decides what a line says. Names are letters only (Q9), so the note needs
  no escaping ([T6.11](#t6-11)). T6.6 and T6.14 rejected a note because
  there was nothing for the user to act on; here the line hides a choice the
  program made, which is the cost [Q1](#q1) recorded. **Rejected:** the
  first version's wording, which said "tie" twice and put the company where
  a line number goes; notes before the report, with or before the warnings,
  for the heading effect above; marking the report line, ruled out by
  T10.3; the note without its reason ("Zebra is a tie between Al and Bo"),
  which leaves the reader to guess why Al is shown; and a note for every
  tied pair below the top, which is noise about lines that do not change.
- **Origin:** A note on stderr naming the partners and strength: Q21's
  default, LLM-suggested, accepted. The wording and printing after the
  report: LLM-suggested, accepted, after I found the first version confusing
  when I ran it. Top ties only: LLM-suggested, accepted.

#### <a id="t10-7"></a>T10.7 — `report` returns its lines and ties together

- **Decision:** `reportLines(network): string[]` becomes
  `buildReport(network): Report`, where a `Report` holds the `lines` as
  before and the `ties`, each a `Tie` of the company, its partners in Q1's
  order, and the strength. `buildReport`, `Report` and `Tie` are the layer's
  exports. The tally stays private, and the lines still carry no newline.
- **Context:** T10a. The cli needs to know which lines settled a tie, and
  only the report layer knows ([T1.13](#t1-13)).
- **Why:** The line and its tie come from one pick of the strongest
  partners, so the partner a line names is always the first of its tie; two
  functions computing the same pick could disagree after a change to one.
  Data rather than text, as [T2.5](#t2-5) set for the parser and the
  network: the wording lives in `warnings.ts`, and the report tests assert a
  structure, not a message. **Rejected:** a second export, `reportTies`,
  beside an unchanged `reportLines`, which leaves every existing caller and
  test alone but tallies twice and splits one decision across two functions;
  and exporting the tally for the cli to find ties in, which [T5.1](#t5-1)
  rejected and which would put the tie rule in the I/O layer.
- **Supersedes:** [T5.1](#t5-1), in part: `reportLines` returning lines only.
  One entry point, a private tally, and lines without newlines stand.
- **Origin:** LLM-suggested, accepted.

#### <a id="t10-8"></a><a id="q31"></a>T10.8 — Q31: A query is an option taking the next argument, and replaces the report

- **Decision:** `--partners <Company>` and `--employees <Company>` each take
  the next argument as the company, and may come before or after the file,
  which is named or piped as before. The answer prints instead of the report,
  with no tie notes. Warnings still print on stderr first. At most one query
  per run, the same one twice included; a second is a bad invocation, one
  line on stderr with the usage (Q19), exit 1. A query option with nothing
  after it, or with another option after it (`--partners --employees ACME`),
  is a bad invocation naming the option. `--help` still wins wherever it
  appears. The arguments are read in one pass, and the first problem in
  argument order is the one reported; the too-many-files error now counts
  file arguments rather than all arguments. The usage becomes
  `node dist/bin.js [--help | [--partners <Company> | --employees <Company>] file]`,
  and `--help` gains a section on the queries.
- **Context:** T10b, building [U10](./UPGRADES.md#u10) as command-line
  options ([T10.4](#t10-4)).
- **Why:** The next argument as the value is how most command-line tools
  read an option with a value, and needs no `=` syntax to explain. Replacing
  the report keeps stdout one kind of output, so a script reading a query's
  answer never has to find it among report lines. Warnings stay, because a
  discarded line can change an answer as it can the report (Q7). No tie
  notes, because `--partners` lists every tied partner, and the notes
  explain report lines, which a query does not print. One query per run
  keeps stdout one answer; two would need a separator the brief's format has
  no place for. An option is never taken as a company, because company names
  are letters only (Q9), so `--employees` can never be one and is far more
  likely to be a forgotten value. Counting only file arguments makes
  `a.txt --partners ACME b.txt` report two files, not four arguments.
  **Rejected:** `--partners=Globex`, one more form to parse and document for
  no gain; printing the report and the answer together, which mixes two
  shapes on stdout; several queries per run, printed in turn; and taking any
  next argument as the company, which turns a forgotten value into
  `no company named "--employees" was declared`.
- **Origin:** The option shape, replacing the report, keeping warnings, and
  one query per run: Q31's default, LLM-suggested, accepted. Refusing an
  option as a value, and counting only file arguments: LLM-suggested,
  accepted.

#### <a id="t10-9"></a><a id="q32"></a>T10.9 — Q32: What each query prints

- **Decision:** `--partners` prints one line in the report's shape,
  `Globex: Chris (2), Molly (1)`: every partner who has contacted the
  company, strongest first, equal strengths alphabetically (Q1, Q14); or
  `Globex: No current relationship`, as the report says it (Q2).
  `--employees` prints one line per employee, alphabetically,
  `Laurie: Chris (2), Molly (1)` in the same order, or `Jamie: No contacts`;
  a company with no employees prints nothing and exits 0. Contact types are
  not broken out. In `report.ts`, one private ranking (strongest first, then
  alphabetical) now serves the report, its ties and both queries, and one
  tally groups contacts by company or by employee; `partnersOf` and
  `employeesOf` are exported beside `buildReport` and return lines, as
  `buildReport` does ([T10.7](#t10-7)).
- **Context:** T10b. The report names one partner per company; a query is
  where the rest of the ranking can be seen.
- **Why:** The same shape as a report line means a reader who knows the
  report can read the answer, and `--partners`' first entry is always the
  partner the report names, which a test holds for every company in the
  brief's example. Strongest first, because the question is who knows the
  company best; alphabetical at equal strength, because that is the order
  the report and the tie note already use. Employees alphabetically, because
  they have no strength of their own to rank by. Nothing for a company with
  no employees, as [T6.14](#t6-14) prints nothing for no companies. Types
  not broken out, because every contact counts 1 (PLAN §1) and the report
  never shows them. One ranking because four orders computed separately
  could drift apart after a change to one. **Rejected:** partners in
  alphabetical order, which buries the answer to the question asked; one
  line per partner, which leaves the report's shape for no gain in
  readability at this size; `No employees` for an empty company, a line
  that says nothing, rejected by T6.14 for the report; and breaking out
  contact types, which introduces a detail the program otherwise never
  shows.
- **Origin:** Q32's default, LLM-suggested, accepted. One shared ranking:
  LLM-suggested, accepted.

#### <a id="t10-10"></a><a id="q33"></a>T10.10 — Q33: A company never declared is an error, after the input is read

- **Decision:** A query naming a company the input never declares prints
  `herbie-lite: no company named "Initech" was declared` on stderr, nothing
  on stdout, and exits 1. It is checked once all input is read and its
  warnings printed, so a company declared on the last line is found. The
  name is quoted and escaped like any other text the user supplied
  ([T8.4](#t8-4)). A company that is declared but has no contacts or no
  employees is not an error (Q2, [T10.9](#t10-9)).
- **Context:** T10b. The name comes from the command line, where nothing
  has checked it.
- **Why:** No answer was produced, and exit 1 means exactly that
  ([T6.1](#t6-1)), so a script asking about a misspelled company fails
  rather than printing an empty result it would read as "no one". After the
  input, because declarations may come in any order (Q8), so nothing can be
  said about a name before the end. Quoted and escaped, unlike a company in
  a warning, because a warning's names passed the letters-only check (Q9)
  and this one did not. **Rejected:** `Initech: No current relationship`,
  which reports a relationship about a company the input never mentions;
  checking before reading, which cannot see a company declared later; and a
  note without failing, exit 0, which makes a typo look like an answer.
- **Origin:** Q33's default, LLM-suggested, accepted.

#### <a id="t10-11"></a>T10.11 — UPGRADES is a list of next steps, and the README says so

- **Decision:** The README's "Deliberately left out" section becomes
  "Beyond the brief". It says the base builds what the brief asks and
  nothing more, that ideas outside it went into
  [UPGRADES](./UPGRADES.md) as potential next steps, and which of them are
  built and which are in progress. The two ideas built into the base
  ([T6.6](#t6-6), [T6.11](#t6-11)) are still named, with why each could not
  wait. UPGRADES' own opening, and the README's one-line description of it,
  say the same.
- **Context:** T10b, after the queries were built. The section still said
  that anything the brief does not ask for "was written down in UPGRADES
  instead of being built", which was true at the tag and has not been since:
  six of its entries are built and two are T10's work.
- **Why:** UPGRADES was always a list of what could come next, kept out of
  the base by the scope rule rather than ruled out; describing it as a
  record of omissions made every built entry read as an exception. The
  scope rule's point, that the base answers the brief and nothing more,
  survives in the first sentence and in the `base-submission` tag
  ([T9.2](#t9-2)). **Rejected:** keeping the old framing and appending each
  upgrade as it lands, which is what the section had become — a paragraph of
  exceptions to a rule it no longer described; and dropping the section,
  which loses where the base's boundary was drawn and why the two early
  exceptions crossed it.
- **Supersedes:** [T7.3](#t7-3), in part: the section framed as what was
  deliberately left out. Naming the base's boundary and the two ideas pulled
  into it stands.
- **Origin:** Mine (UPGRADES as next steps, most being built now). The new
  section's shape: LLM-suggested, accepted.

#### <a id="t10-12"></a><a id="q22"></a>T10.12 — Q22: The server in `src/ui/`, the page in `web/`, bundled into `dist/web/`

- **Decision:** The UI's server lives in `src/ui/`, under the existing
  tsconfig, with a logic-free `bin.ts` beside `server.ts`, as the CLI has
  ([T1.6](#t1-6)). The browser code lives in `web/`, with its own
  `web/tsconfig.json`: DOM types and no Node types, bundler resolution, no
  emit. Vite bundles it into `dist/web/` from flags in a `build:web`
  script, with no Vite config file. `npm run build` now builds the page as
  well as the CLI and server; `npm run ui` builds the page and starts the
  server from source. `typecheck` checks both projects, and ESLint, Prettier
  and the tests cover `web/` with no change to their config; coverage adds
  `web/`. No runtime dependency was needed, so the README's "no runtime
  dependencies" line stands until one is.
- **Context:** T10c, the UI's scaffold. The server and the page run in
  different places, with different globals.
- **Why:** Two TypeScript projects make each side's mistakes compile errors:
  a `document` in the server or an `fs` in the page fails `typecheck` rather
  than at run time. `web/` sits outside `src/` because the root project's
  `rootDir` is `src/` and its types are Node's; putting the page under it
  would need the root config split. Flags rather than a config file follow
  [T9.3](#t9-3), which kept a tool's settings in its script until one could
  not be set that way. `npm run build` covers the page so that "build" still
  means everything a reviewer can run. **Rejected:** one tsconfig with both
  DOM and Node types, which lets either side use the other's globals
  unchecked; the page under `src/web/`, which puts browser files in the
  Node project; a `vite.config.ts`, typed but a fourth TypeScript context for
  three settings; and leaving the page out of `npm run build`, which makes
  `node dist/ui/bin.js` fail after a build.
- **Origin:** Q22's default, LLM-suggested, accepted, with the Vite flags
  and the page in `npm run build` added in T10c: LLM-suggested, accepted.
- **Superseded in part by** [T10.16](#t10-16) (the server in `src/ui/`; there
  is no server).

#### <a id="t10-13"></a><a id="q23"></a>T10.13 — Q23: A real server in the tests; the page's DOM code untested

- **Decision:** The server is tested in vitest against a real server on an
  ephemeral port, over a small page the test writes to a temporary folder,
  not over Vite's build. Browser logic is to be kept in modules that do not
  touch the DOM and tested in vitest like the rest; the code that does touch
  the DOM is not tested. End-to-end tests in a browser are deferred to
  [UPGRADES U11](./UPGRADES.md#u11).
- **Context:** T10c. The scaffold has a server with real behaviour and a
  page whose only code puts a heading in the DOM.
- **Why:** A real server on port 0 tests what a browser will get, headers
  included, with no mocking and no port clash between parallel runs. A page
  written by the test keeps `npm test` free of a build step, as
  [T6.10](#t6-10) did for the CLI's process test. Keeping logic out of DOM
  code is what makes it testable without a browser, and it leaves the
  untested part as thin as `bin.ts`. **Known cost:** nothing checks that the
  page renders; the scaffold was checked by loading it in a browser by hand.
  **Rejected:** a DOM emulation such as jsdom, one more dependency that
  imitates a browser without being one; Playwright now, which needs browser
  binaries on install for a page that does almost nothing yet; and testing
  the server over Vite's real output, which would make `npm test` depend on
  `npm run build`.
- **Origin:** Q23's default, LLM-suggested, accepted.
- **Superseded in part by** [T10.16](#t10-16) (the server tested live; there
  is no server).
- **Superseded in part by** [T10.22](#t10-22) (end-to-end tests in a
  browser deferred to U11; they are now planned as T10h).

#### <a id="t10-14"></a>T10.14 — The scaffold's server serves only what it found at startup

- **Decision:** The scaffold includes a minimal server rather than waiting
  for T10d. It reads every file of the built page into memory at startup,
  keyed by URL path with `/` for `index.html`, and answers GET and HEAD
  from that map: 404 for anything else, 405 for other methods. A request is
  never turned into a file path. It listens on `127.0.0.1`, port 5170,
  fixed; a taken port or a missing build is one line on stderr and exit 1.
  T10d keeps the `Host` and `Origin` checks (Q24).
- **Context:** T10c promised an empty page served, and the server was
  planned for T10d.
- **Why:** An empty page no one can load does not show the scaffold works,
  and a static server over a handful of files is small enough to build here.
  Serving from a map removes path traversal as a class rather than guarding
  against it, which a test holds by sending `/../package.json` and its
  encoded forms unnormalised; the cost is a restart after a rebuild, which
  `npm run ui` does anyway. `127.0.0.1` from the start, because listening
  everywhere even for one subtask would be the unsafe default Q24 exists to
  avoid. A fixed port, so the address is the same every run. **Rejected:**
  `vite preview` for now, which serves the page but is not the server T10d
  hardens; resolving the request path under `dist/web/` with a containment
  check, the usual approach and one more thing to get right; and port 0,
  which needs the address read from the log every time.
- **Origin:** LLM-suggested, accepted.
- **Superseded by** [T10.16](#t10-16).

#### <a id="t10-16"></a>T10.16 — The UI runs in the browser alone, with no server

- **Decision:** The web UI is a static page with no server of its own. The
  parser, network and report layers run in the page, unchanged. The examples
  are bundled into the page at build time and stay read-only. The workspace
  is kept in the browser's storage, where files can be created, edited and
  deleted; any file on disk can be opened into it, and any file downloaded.
  There is no `inputs/` folder. `src/ui/` is removed, and `npm run ui` builds
  the page and serves it with Vite's preview server on `127.0.0.1:5170`,
  since a browser will not run a bundled module from a page opened off disk.
  The `Host` and `Origin` checks built for T10d are dropped before being
  committed, and Q24 is withdrawn: with no server there is nothing to keep
  local, and Vite's preview server checks `Host` itself. The rest of T10 is
  re-planned in PLAN §6 as T10d (the workspace), T10e (the files panel),
  T10f (the console), T10g (the editor) and T10i (the README), in the
  order [T10.20](#t10-20) set, and Q25–Q30
  are rewritten for the browser.
- **Context:** Reviewing T10d, whose checks existed only because the UI had
  a server. The server was there to list, read, save and delete files on
  disk and to run the CLI; the question was whether a UI for demonstrating
  the program needs any of that.
- **Why:** Everything the page does to a network (parse, resolve, report,
  warn) is already pure TypeScript with no I/O, by T1.11's design, so it
  runs in a browser as it is, and the page shows that layering at work. A
  server brought a file API, a security boundary, and four open questions
  (Q24, Q25, Q26, Q30 in their server form) that exist only to protect files
  on disk. Without it there is no attack surface to defend, fewer moving
  parts to explain in an interview, and the page could be hosted as a
  static site. **Accepted cost:** files made in the page live in that
  browser and reach disk only as downloads, and editing a file in place on
  disk is left to [UPGRADES U12](./UPGRADES.md#u12). **Rejected:** keeping
  the server as planned, which saves into the repository but spends two
  subtasks on protecting it; and a server only for writing files, which
  keeps the whole security question for one feature.
- **Supersedes:** in part, [T9.6](#t9-6) (the `inputs/` folder as the
  workspace; examples read-only, with a copy to edit, stands),
  [T9.7](#t9-7) (served by `node:http`; plain TypeScript bundled by Vite
  stands), [T10.2](#t10-2) (saving into `inputs/`; the editor as U1
  stands), [T10.12](#t10-12) (the server in `src/ui/`; the page in `web/`
  stands) and [T10.13](#t10-13) (the server tested live; DOM-free browser
  logic tested in vitest stands). Wholly, [T10.14](#t10-14).
- **Origin:** Mine (asking whether a local demo needs a server, then
  choosing browser-only). Setting out the browser-only option, and the file
  handling (bundled examples, browser storage, open and download, write-back
  deferred): LLM-suggested, accepted.

#### <a id="t10-17"></a><a id="q25"></a>T10.17 — Q25: Workspace names are letters, digits, `_` and `-`, then `.txt`

- **Decision:** A workspace file's name matches
  `[A-Za-z0-9_-]{1,100}\.txt`, and is compared exactly, so `a.txt` and
  `A.txt` are two files. Names are unique within the workspace; an example's
  name may be reused, since examples are listed apart. A file arriving from
  elsewhere, opened from disk or copied from an example, is given a name by
  `suggestName`: characters a name may not hold become `-`, `.txt` is added
  if missing, `untitled` stands in for a name with nothing left, and a taken
  name gets `-2`, `-3` and so on before `.txt`.
- **Context:** T10d. With no server, a name is no longer a path on disk
  ([T10.16](#t10-16)), but it is still the name a download is saved under.
- **Why:** The name travels to the user's disk as a download and back as an
  argument to the CLI, so it is kept to characters every file system and
  shell takes without quoting; `.txt` makes the download open in a text
  editor. Exact comparison matches how the program treats every other name
  (Q4), at the cost that two files differing only in case collide when
  downloaded to a case-insensitive disk, where the browser renames the
  second. A suggested name rather than a refusal, because a file from disk
  often has a space or another extension, and the user asked to open it, not
  to rename it first. **Rejected:** any name at all, which is safe in browser
  storage but produces downloads the CLI needs quoting to read; names
  compared without case, one more rule unlike the rest of the program; and
  refusing a file from disk whose name is not valid.
- **Origin:** Q25's default, LLM-suggested, accepted, with `suggestName`
  added in T10d: LLM-suggested, accepted.

#### <a id="t10-18"></a><a id="q26"></a>T10.18 — Q26: Every save raises a version; a save from an older copy is refused

- **Decision:** Each workspace file carries a version, 1 when created and
  raised by every save, including an overwrite. A save names the version
  its copy was opened at; if the stored file has moved on, the save is
  refused with the current file, and nothing is overwritten. A save of a
  file deleted since it was opened is refused as missing. Deletion is
  permanent, and the page confirms it first.
- **Context:** T10d. The workspace is shared by every tab of the page in the
  same browser, so one file can be open in two tabs at once.
- **Why:** Two tabs editing one file is the one way this page can lose work
  without the user doing anything wrong, and the later save silently winning
  is the loss. A version is the smallest thing that detects it: it needs no
  clock, and it survives a save made in the same millisecond. Returning the
  current file lets the page show what the other tab saved. **Rejected:**
  last save wins, which is simplest and loses the other tab's edit; a
  modification time, Q26's server-era default, which a browser offers no
  file for and two quick saves can share; and locking a file to the first
  tab that opens it, which leaves a closed tab's lock behind.
- **Origin:** Q26's default, LLM-suggested, accepted, with the version replacing the
  modification time when the UI became browser-only: LLM-suggested, accepted.

#### <a id="t10-19"></a><a id="q30"></a>T10.19 — Q30: Files saved in `localStorage`, one key each; a refused save keeps the old file

- **Decision:** The workspace is kept in `localStorage`, one key per file
  under the prefix `herbie-lite:file:`, holding its text and version as
  JSON; other keys are left alone, and a value under the prefix that does
  not parse is treated as absent. Creating a file under a name already in
  the workspace is refused as `exists` until the page, having asked the
  user, sends it again with `overwrite`. A text over a million characters is
  refused as `too-large`, and a write the storage throws on as
  `storage-full`; either way the previous version stays as it was, and the
  editor keeps its text, which can still be downloaded. The workspace is a
  class over any object with `localStorage`'s methods, with no DOM, so the
  tests pass an in-memory store. The examples are bundled from
  `examples/*.txt` by Vite's `import.meta.glob`. Opening a file from disk and
  starting a download are left to the files panel (T10e), the first code to
  call them.
- **Context:** T10d. Browser storage replaces `inputs/`
  ([T10.16](#t10-16)).
- **Why:** `localStorage` is synchronous and small, which suits a handful of
  text files and keeps the module a set of plain functions; its limit, about
  five megabytes, is why a file is capped and a full store is reported
  rather than assumed away. One key per file means a failed write can only
  fail that file, and `setItem` replaces a value whole or throws, which is
  what keeps the old version intact without the temporary file the server
  plan needed. A name clash asks rather than overwrites, because the
  overwritten file is gone for good. The open and download helpers wait for
  T10e because each is a few lines of DOM with no caller before the panel.
  **Rejected:** IndexedDB, which holds far more but is asynchronous and adds
  a transaction layer for files this small; all files under one key, which
  makes every save rewrite every file and lets one failure lose them all;
  and throwing on a damaged value, which would break the whole workspace
  over one key edited by hand.
- **Origin:** Q30's default, LLM-suggested, accepted, with the store, keys and limits
  set in T10d: LLM-suggested, accepted.

#### <a id="t10-20"></a>T10.20 — The console comes before the editor

- **Decision:** The console is built as T10f, straight after the files panel,
  and the editor as T10g. Q27 and Q28 settle in T10f, Q29 in T10g.
- **Context:** After T10d, asking how much was left before the UI could be
  seen working. In the planned order, running a file came last of the three
  panels.
- **Why:** The console needs only a listed file, which the files panel
  provides, so nothing it does waits for the editor; built first, the page
  runs the analyzer on any example or file from disk two subtasks sooner,
  and the editor then adds writing files to something that already works end
  to end. The planned order put the editor first for no stated reason.
  **Rejected:** keeping the editor first, which delays the one thing the UI
  is for.
- **Supersedes:** [T10.2](#t10-2), in part: the editor placed between the
  files panel and the console. The editor as U1's builder stands.
- **Origin:** Swapping them: LLM-suggested, accepted.

#### <a id="t10-21"></a>T10.21 — The files panel: nothing brought in overwrites, and storage may be refused

- **Decision:** The files panel lists the examples and the workspace, shows
  the chosen file read-only with line numbers, and offers copy to workspace
  on an example, download on any file, delete (confirmed) on a workspace
  file, and "Open a file…" for a file from disk. A file opened from disk or
  a copied example is always stored under a free name from `suggestName`
  (Q25), so bringing a file in never overwrites one and never asks; the
  overwrite confirmation (Q30) is left to the editor's save. If the browser
  refuses `localStorage`, the page keeps its workspace in a `MemoryStore`
  and says the files last until reload. A change made in another tab
  redraws the panel, and a file deleted there is let go of. Line numbers are
  drawn by CSS, so copying a file's text leaves them behind. What the panel
  does to the workspace is in `actions.ts`, tested; `files-panel.ts`,
  `dom.ts` and `main.ts` only draw and wire it and are not tested
  ([T10.13](#t10-13)). The web code imports `assertNever` from `src/`
  rather than keeping a copy. The page opens on the first example, so it is
  never blank.
- **Context:** T10e.
- **Why:** Opening a file or copying an example is asking for a copy, and a
  numbered name gives one without a dialog; asking would put a confirmation
  in front of the most common action to protect against a clash the page
  can avoid itself. Some private browsing modes throw on any use of
  `localStorage`, and a page that fails to start there shows nothing at
  all, while one in memory still does everything but remember. Line numbers
  are what a warning cites ([T6.4](#t6-4)), so they are shown; drawn by CSS
  so they are not in the text a user copies. One `assertNever` keeps one
  definition of exhaustiveness, and the module has no Node types, so the
  browser project can check it. **Rejected:** asking before a copy or an
  opened file replaces one of the same name; refusing to start without
  storage; line numbers written into the text; and a second `assertNever`
  in `web/`.
- **Origin:** LLM-suggested, accepted.

#### <a id="t10-22"></a>T10.22 — Browser tests are planned as T10h; write-back to disk stays deferred

- **Decision:** [U11](./UPGRADES.md#u11), end-to-end tests that load the
  built page in a browser, is planned as T10h, after the editor (T10g) and
  before the README, which moves to T10i. Its open questions become PLAN
  §4's Q34 (the tool), Q35 (whether the tests run in `npm run check`) and
  Q36 (what they cover), settled in T10h, and U11's own question of when to
  build it is answered here. [U12](./UPGRADES.md#u12), writing back to a
  file opened from disk in Chrome and Edge, stays in UPGRADES and is not
  part of T10; the README (T10i) names it as not built. [T10.16](#t10-16)'s
  citation of the README subtask is updated to T10i, as the Key allows when
  IDs are restructured.
- **Context:** Before T10f, reviewing what was left. [T10.13](#t10-13) left
  the page's DOM code untested and deferred browser tests to U11; U12 was
  deferred when the UI became browser-only.
- **Why:** After the editor, the page is three panels wired together in
  code no test runs: a panel that fails to draw, or a button wired to the
  wrong action, passes every vitest test. That is the point U11 itself
  named, "once the page does enough that a broken render would go
  unnoticed". Before the README, so the README can say how to run them.
  After the editor rather than after the console, so the tests are written
  once against the finished page rather than extended in the next subtask.
  U12 stays deferred because it works in two browsers of four, so the page
  would need both write-back and downloads, with a permission that can
  lapse between visits; downloads already cover getting a file to disk, and
  the UI is a demonstration of the analyzer rather than a place files live.
  **Rejected:** browser tests after the console (T10f), which U11 offered
  and which checks the console sooner but tests a page the editor then
  changes; leaving U11 deferred, which keeps [T10.13](#t10-13)'s known cost
  that nothing checks the page renders; and planning U12 into T10, which
  adds a second save path for part of the browsers.
- **Supersedes:** [T10.13](#t10-13), in part: end-to-end tests in a browser
  deferred to U11. Browser logic kept in DOM-free modules and tested in
  vitest stands.
- **Origin:** Planning U11 and deferring U12: Mine. Placing U11 after the
  editor, and the defaults for Q34–Q36: LLM-suggested.

#### <a id="t10-23"></a><a id="q28"></a>T10.23 — Q28: The CLI's work is one function over its arguments and its input

- **Decision:** A new cli helper, `run.ts`, holds everything `main` did
  apart from streams: reading the arguments, reading and parsing the lines,
  resolving, and choosing the answer. `run(args, open)` takes the arguments
  and an `open` function that returns the input's decoded text for a file
  (or standard input), or nothing when standard input is a terminal (Q20).
  It returns a `Run`: the `stderr` lines written first (a bad invocation,
  warnings in line order, a failure), the `stdout` text, the `notes`
  written after stdout (Q21), and the exit code. `main` supplies `open`
  over `createReadStream` and stdin, writes the three parts in order, and
  keeps only the final write's failure handling (Q17) and the stream error
  listeners (T6.15). The web console calls the same `run` with the listed
  file's text as one chunk. `readLines` now takes decoded chunks, sync or
  async, instead of a Node stream, and `main` sets the encoding; its test
  for a character split across two byte chunks moves to `cli.test.ts`. A
  throw is still a bug and still propagates (T6.1), to the process in the
  CLI and to the pane in the page, which shows its stack.
- **Context:** T10f. The console has to print what the CLI prints, and the
  CLI's logic was inside `main`, among its streams.
- **Why:** One function means the page cannot drift from the CLI: the same
  arguments, warnings, order and exit code, with no second copy to keep in
  step. `open` rather than the input text, which was Q28's default, so the
  CLI still streams its file instead of reading it whole first, and each
  held warning stays bounded ([T9.13](#t9-13)). Three parts rather than one
  stderr, because the notes are written only once stdout is, and only the
  caller knows whether that write succeeded. `readLines` over decoded text
  keeps `run.ts` and everything it imports free of Node's types, which the
  browser project checks; decoding stays where the stream is. **Rejected:**
  a function over the whole input text, which would read every file into
  memory before parsing; one `stderr` list with the notes in it, which
  loses the rule that a failed report gets no footnote; and a browser copy
  of the argument and warning logic, which is the drift this avoids.
- **Supersedes:** [T6.4](#t6-4), in part: `readLines` decoding the stream
  itself. Splitting on `\n` alone, numbering from 1, and leaving `\r` to the
  parser stand.
- **Origin:** Q28's default, LLM-suggested, accepted, with `open` in place
  of the input text and the three-part result: LLM-suggested, in T10f.

#### <a id="t10-24"></a><a id="q27"></a>T10.24 — Q27: The console is an xterm.js pane showing each run as a terminal would

- **Decision:** The console is an xterm.js pane below the files panel,
  mounted apart from it so its scrollback survives the panel's redraws. A
  **Run** button on the viewer runs herbie-lite on the file shown and
  appends the run: the command as a user would type it
  (`node dist/bin.js examples/input.txt`, or the workspace name as it
  downloads), then stderr, stdout and the notes in the order the CLI
  writes them, stderr in yellow, then `exit 0` or `exit 1`. Runs
  accumulate until **Clear**, and the pane scrolls into view on each run.
  It takes no input and has no query options. `@xterm/xterm` and
  `@xterm/addon-fit` are dev dependencies, bundled into the page; the fit
  addon rewraps lines when the pane changes width. What a run prints and
  how it is shown is `console.ts`, tested; `console-panel.ts` draws the
  pane and is not ([T10.13](#t10-13)).
- **Context:** T10f. U9 asked for an embedded terminal pane
  ([T9.5](#t9-5)).
- **Why:** A terminal pane shows the program as it is used, colours and
  exit code included, and the echoed command is one a reader can copy into
  their own terminal to get the same output. Showing it as a terminal is
  safe because xterm.js acts on escape sequences, and the only ones in the
  pane are its own: every text the program prints from its input is
  escaped ([T6.11](#t6-11)) or letters only (Q9). Runs accumulate, as a
  terminal's do, so two files' output can be compared. No query options
  yet, because T10f is the report on a listed file; [T10.4](#t10-4) left
  them to be offered here later with no second implementation, and
  `run` already takes arguments. **Accepted cost:** xterm.js is nearly all of the page's
  script, about 345KB of 352KB minified, and a terminal emulator is less
  plain to a screen reader than ordinary text, which `screenReaderMode`
  offsets. **Rejected:**
  a plain `<pre>`, with no dependency and ordinary text selection, which
  is lighter but is not the terminal U9 set out to embed; clearing the pane
  before each run; and query options in the pane now.
- **Origin:** Q27's default (xterm.js), LLM-suggested, accepted. The
  echoed command, accumulating runs, and the fit addon: LLM-suggested, in
  T10f.
- **Superseded in part by** [T11.5](#t11-5) (no input and no query
  options; the console now takes typed herbie-lite commands).

#### <a id="t10-25"></a><a id="q29"></a>T10.25 — Q29: The editor marks what the CLI would warn about, as discarded or pending

- **Decision:** As a workspace file is edited, `checkText` in `editor.ts`
  runs the whole text through the CLI's own reader, parser and
  `buildNetwork`, 150ms after typing pauses, and marks every line the CLI
  would warn about: in the gutter, and in a list below the text that moves
  the cursor to the line. A mark is **discarded** when the program would
  throw the line away as it stands: a malformed line, a repeated
  declaration, or a name used for the wrong kind of person (Q12). It is
  **pending** when the line names a company or person no line declares
  yet: an employee's unknown company, or a contact whose every failed name
  is undeclared. A mark's message is the warning's own wording without its
  line number and quote: `warnings.ts` now exports `malformedProblem` and
  `networkProblem`, which `malformedWarning` and `networkWarning` wrap. A
  file with marks of either kind can be saved. A test holds, for every
  example, that the marks are exactly the CLI's warnings, line for line and
  word for word.
- **Context:** T10g, building [U1](./UPGRADES.md#u1) as the UI's editor
  ([T10.2](#t10-2)).
- **Why:** Checking with the CLI's own code, not a copy, means a line is
  marked exactly when running the file would warn about it, which the
  example test holds. The whole file on every pause, rather than the edited
  line alone, because a declaration anywhere can settle a reference
  anywhere (Q8), and a file of the size this program reads checks in well
  under a frame. Pending apart from discarded because, in a file being
  written, an undeclared name is most often one not typed yet, and marking
  it as an error would flag half of every new file; a repeat or a wrong
  role stays wrong however much more is written. The wording comes from
  `warnings.ts` so every description of a problem stays in one place
  ([T6.5](#t6-5)), and without the quote because the line is beside it.
  Saving with marks, because the CLI runs such a file too, and a draft
  worth keeping is not always a clean one. **Rejected:** checking each line
  alone as it changes, which misses every cross-line problem; all marks as
  errors; refusing to save a file with discarded lines; and editor-only
  messages, a second wording of the same problems.
- **Origin:** Q29's default, LLM-suggested, accepted. The split into
  discarded and pending, and the problem wording exported from
  `warnings.ts`: LLM-suggested, accepted (set out before T10g was built).

#### <a id="t10-26"></a>T10.26 — The editor: a plain textarea, one open file, and saves that never lose an edit

- **Decision:** A workspace file opens in the editor in place of the
  read-only viewer; examples stay read-only, to be copied first. The editor
  is a `<textarea>` beside a gutter of line numbers and marks drawn by the
  page, with no editor library. **New file…** asks for a name, suggesting a
  free one (Q25), and asks before replacing a file of that name, which is
  the confirmation [Q30](#q30) left to the editor. **Save**, or Cmd/Ctrl+S,
  saves from the version the editor opened (Q26). If another tab saved
  first, the save is refused and offers **Keep mine**, which saves over
  theirs, or **Load theirs**; if another tab deleted the file, it offers
  **Save as new**. Leaving a file with unsaved changes, by choosing another
  or closing the page, asks first. A change in another tab reloads an
  editor with no unsaved changes and leaves one with them alone. **Run**
  runs the editor's text, saved or not, and the console notes when it is
  unsaved; **Download** downloads the editor's text. The command reference
  from `help.ts`, the section `--help` shows, now exported as
  `COMMAND_REFERENCE`, sits beside the text on screens 1280px wide or more
  and below it otherwise. One editor exists at a time and is kept across
  the files panel's redraws, which leave it in place. `editor-panel.ts` is
  DOM code and untested ([T10.13](#t10-13)).
- **Context:** T10g.
- **Why:** A textarea is the browser's own editor, with undo, selection,
  input methods and accessibility already right, and the gutter gives it
  the one thing this file needs beyond that, a mark per line; commands are
  a few words each, so highlighting and completion would add little.
  Keeping the editor in place across redraws is what stops a change in
  another tab from taking the cursor and scroll position away. A refused
  save that offers both versions is the point of Q26: neither copy is lost
  until the user picks one, and a deleted file can be kept from the
  editor's copy. Running the unsaved text is what someone checking an edit
  wants, and the note keeps the console's echoed command honest, since no
  file holds that text yet. The reference moves below the text on narrower
  screens because its lines are too long to share the width without
  wrapping, and wrapped it no longer shows the commands' shape.
  **Rejected:** CodeMirror, which draws per-line marks natively but adds
  a second large dependency to a page already carrying xterm.js
  ([T10.24](#t10-24)); editing examples in place, which [T9.6](#t9-6)
  ruled out; last save wins on a clash; and running only the saved file,
  which makes every check of an edit a save first.
- **Origin:** LLM-suggested, accepted (set out before T10g was built). The
  reference moving below the text on narrower screens: LLM-suggested, in
  T10g, after seeing it squeezed beside the text.

#### <a id="t10-27"></a><a id="q34"></a>T10.27 — Q34: Playwright's test runner drives Chromium, from outside the page

- **Decision:** The browser tests use `@playwright/test`, a dev
  dependency, with one project, Chromium. Its browser is installed by
  `npx playwright install chromium`, run once, not by `npm install`. The
  tests are `e2e/*.e2e.ts`, with their own `e2e/tsconfig.json` (Node's
  types, plus the DOM's for callbacks sent into the page), checked by
  `npm run typecheck` and linted like the rest; the `.e2e.ts` suffix keeps
  vitest and Playwright from picking up each other's files. Settings are in
  a plain-JS `playwright.config.js`, like `vitest.config.js`
  ([T9.11](#t9-11)). Playwright's output, `test-results/` and
  `playwright-report/`, is ignored by git, ESLint and Prettier.
- **Context:** T10h, building [U11](./UPGRADES.md#u11).
- **Why:** The point of these tests is the built page as a person meets
  it, so they should load the same bundle a user loads and act on it
  through clicks, typing and dialogs; Playwright does that from outside,
  waits for what it asserts without sleeps, and handles `confirm` and
  `prompt`, which the files panel and editor use. Chromium alone, because
  the page uses nothing a browser differs on, and each more browser is
  another download and another run. A separate install step keeps
  `npm install` and `npm run check` free of a 94MB browser for anyone who
  never runs these. **Rejected:** Vitest's browser mode, which keeps one
  runner but runs tests inside a page against modules rather than the
  built bundle; and all three of Playwright's browsers.
- **Origin:** Q34's default, LLM-suggested, accepted. The `.e2e.ts` suffix
  and a tsconfig of their own: LLM-suggested, in T10h.

#### <a id="t10-28"></a><a id="q35"></a>T10.28 — Q35: `npm run test:e2e` builds the page and tests it; `check` is unchanged

- **Decision:** `npm run test:e2e` builds the page, then runs Playwright,
  which serves the build with Vite's preview server on port 5171 and stops
  it afterwards. `npm run check` does not run the browser tests; it does
  type-check and lint them.
- **Context:** T10h. `check` is the gate before every commit (T1.3).
- **Why:** `check` then still runs on a clean clone with no browser
  installed and no build, as [T6.10](#t6-10) kept it, and stays under a
  second of tests; the browser tests take a build and a few seconds more,
  and belong to changes to the page. Type-checking and linting them in
  `check` means they cannot rot unnoticed between runs. Port 5171, never
  reused, because `npm run ui` holds 5170, and a preview started before a
  rebuild would serve the old page and the tests would pass on it.
  **Known cost:** a change to the page can be committed with `check` green
  and these red, until someone runs them. **Rejected:** the browser tests
  in `check`, which catches that but makes every commit need a browser and
  a build; and reusing a server already on 5170.
- **Origin:** Q35's default, LLM-suggested, accepted. The separate port:
  LLM-suggested, in T10h.

#### <a id="t10-29"></a><a id="q36"></a>T10.29 — Q36: One browser test per thing a person does with the page

- **Decision:** Five tests, each from a fresh page with an empty
  workspace: the page opens on the first example, read-only; **Run** on
  `examples/input.txt` shows the command, PLAN §7's three lines and
  `exit 0` in the console; an example copied to the workspace, edited and
  saved, is still edited after a reload, and runs with the edit; a new file
  whose line names an undeclared company is marked pending until the
  company is declared; and **Delete** asks, keeps the file when refused,
  and removes it when accepted. None re-asserts what vitest already does,
  such as warning wording or the report for every example.
- **Context:** T10h.
- **Why:** Everything these tests reach is either asserted in vitest or
  is wiring between panels, and the wiring is what [T10.13](#t10-13) left
  untested, so each test crosses at least one boundary: files panel to
  console, editor to storage and back, editor to its checks, panel to a
  dialog. Breaking the Run wiring on purpose fails two of the five.
  **Rejected:** a single test that the page renders, which is cheaper and
  would pass with every button disconnected; and a browser test per
  example, which repeats vitest's assertions at many times the cost.
- **Origin:** Q36's default, LLM-suggested, accepted, with the pending-mark
  test added in T10h: LLM-suggested.

#### <a id="t10-30"></a>T10.30 — The README documents the page as a way to run the program

- **Decision:** The web page is documented in "Build, run, and test", as a
  subsection "In a browser" after the command-line forms: how to start it,
  what each panel does, and a list of what it does not do. The browser
  tests' commands sit beside `check` and `coverage`. "How it works" gains a
  paragraph placing the page as a consumer of the four layers, not a fifth.
  The page's questions (Q22–Q30, Q34–Q36) get a table of their own after
  the input assumptions' table. "Beyond the brief" lists the page and its
  tests as built and U12 as not built.
- **Context:** T10i. Every other section of the README was about the
  command-line program.
- **Why:** The page is another way to run the same program, and a reader
  looking for how to run it looks under running it. The list of what it
  does not do is the part a reviewer most needs, since a browser-only page
  that keeps files in local storage behaves unlike what "a web UI" usually
  suggests. A second table, because the first answers brief requirement
  7.3's question about the input data, and page questions such as saving
  or testing mixed into it would dilute that answer; kept at all, because
  PLAN §7 asks for every question to be covered. **Rejected:** a top-level
  "Web UI" section, which separates the page from the run forms it
  parallels; the page's questions in the first table; and leaving them out
  of the README.
- **Origin:** LLM-suggested, in T10i.

### T11 — Follow-ups

#### <a id="t11-1"></a>T11.1 — Follow-ups to T10 are their own task

- **Decision:** Work after T10 is PLAN task T11, with lettered subtasks:
  T11a fixes New file, T11b shows each example's purpose in the page, and
  T11c gives the page a look of its own. Two smaller findings from T10,
  queries in the console and a status line that outlives its action, go to
  UPGRADES as [U13](./UPGRADES.md#u13) and [U14](./UPGRADES.md#u14) rather
  than into T11. Each subtask is committed before the next starts.
- **Context:** After T10 was complete, reviewing the page in use.
- **Why:** T10 is closed, and its commits read as the building of the UI;
  a bug found afterwards and two requests about the page are a separate
  stretch of work. One subtask per commit keeps the bug fix apart from the
  styling, which touches every panel. U13 and U14 are ideas with open
  questions rather than asked-for work, which is what UPGRADES holds.
  **Rejected:** reopening T10, which makes a finished task unfinished; and
  one commit for all three, which mixes a fix with a restyle.
- **Origin:** The three pieces of work: Mine. U13 and U14, and a commit
  per subtask: LLM-suggested, accepted. A task of their own: LLM-suggested.

#### <a id="t11-2"></a>T11.2 — Each example's purpose is shown in the page

- **Decision:** Each example gets a one-line purpose, shown in the page
  where the example is: in the viewer under its name, and as the tooltip
  of its button in the file list. The README's table of examples is left as
  it is.
- **Context:** T11b. The page lists six example files by name alone, and
  their purposes were written down only in the README.
- **Why:** Someone using the page choosing a file to run has only the names,
  and `names-and-repeats.txt` says little until you know what it holds. The
  README already explains each file at length for a reader of the
  repository, which is a different reader. **Accepted cost:** two
  descriptions of each example, the README's and the page's, which can
  drift; the page's are one line each and a test holds that every bundled
  example has one. **Rejected:** rewording the README table to match, which
  shortens it for the reader who wanted the detail; and the README alone,
  which leaves the page unexplained.
- **Origin:** Mine (the LLM offered the page alone, the page and the README
  together, and the README alone).

#### <a id="t11-3"></a>T11.3 — The page looks like a terminal

- **Decision:** The page is restyled terminal-forward: dark in every
  theme, monospace headings and file names, a green accent with amber for
  pending marks, and the console as the page's centrepiece, styled like
  the rest rather than as a dark box in a light page. No web fonts: the
  system's monospace fonts, so the page still loads nothing from anywhere
  ([T10.16](#t10-16)).
- **Context:** T11c. The page had a neutral light or dark look that could
  belong to any tool.
- **Why:** The program is a command-line tool and the page's centre is a
  terminal pane running it, so a look taken from the terminal says what the
  page is before any text is read, and removes the seam between a light
  page and a dark console. System fonts because the README says the page
  sends and fetches nothing, and a font from a CDN would make that false.
  **Accepted cost:** no light theme, so the page ignores a reader's light
  preference. **Rejected:** a warm light "network ledger" look, calmer and
  more editorial but further from the console; and polishing the existing
  look, which leaves the page generic.
- **Origin:** Mine (chosen from three directions the LLM set out, of which
  it recommended the ledger look).

#### <a id="t11-4"></a>T11.4 — A new file is named in a form in the page

- **Decision:** **New file…** replaces the workspace's buttons with a form:
  a name field holding a free suggested name (Q25), with the part before
  `.txt` selected, and **Create** and **Cancel**. Enter creates and Escape
  cancels. A name the workspace refuses leaves the form open with the
  reason on the status line; a taken name still asks before replacing the
  file (Q30). The form is made once and kept across redraws, so a redraw
  keeps a half-typed name and its focus. Enter is handled by the field
  itself as well as by the form's submission, and the default is
  prevented so one keypress creates one file. `prompt()` is no longer used
  anywhere in the page. The browser test for new files now fills the form,
  including a name that is refused.
- **Context:** T11a. New file did nothing in the Claude app's browser
  pane, which throws "prompt() is not supported"; the browser test had
  passed because Playwright answers a prompt dialog. In the same pane,
  a synthetic Enter reached the field without submitting the form.
- **Why:** A form in the page works wherever the page does, and it can
  show why a name was refused and let it be corrected, which a prompt
  cannot. Handling Enter directly costs three lines and makes the form work
  whether or not a browser submits it on Enter. `confirm()` stays for
  deleting, replacing and discarding: the pane supports it, and those are
  yes-or-no questions a dialog suits. **Rejected:** a modal `<dialog>`,
  which is closer to the prompt it replaces but takes the user away from the
  list the file will join; keeping `prompt()` with the form as a fallback
  when it throws, two ways to name a file; and relying on the form's own
  submission alone, which failed in the pane.
- **Origin:** LLM-suggested, in T11a (the bug was reported by me).

#### <a id="t11-5"></a>T11.5 — The console is a shell that runs herbie-lite and nothing else

- **Decision:** The console takes typed command lines. It runs a line
  that invokes herbie-lite as the README does: `node dist/bin.js [args]`,
  `npm start -- [args]`, or `cat <file> | node dist/bin.js [args]` with the
  file on standard input; plus `help` and `clear`. Anything else is refused
  with a one-line reason and nothing runs: another program, a second pipe,
  `npm start` arguments without `--`, and a command such as `Partner Chris`,
  which is pointed at a file instead. An accepted line goes through the
  CLI's own `run` (Q28): a file is `examples/<name>` or a workspace file by
  name, as last saved; a missing file gets the CLI's `cannot read` error;
  a bare `node dist/bin.js` prints the opening, as at a terminal (Q20). The
  prompt has Backspace, Up and Down history, Ctrl+C, Ctrl+L and paste, with
  the cursor always at the end of the line. **Run** and the new
  **--partners** and **--employees** buttons, beside a company field that
  suggests the file's companies and accepts any name, enter their command
  at the prompt and run it, so a button and typing do the same thing.
  Enter and Backspace are also read from `event.key` when a keypress has no
  `keyCode`, which xterm.js relies on and a synthetic keypress lacks. This
  builds [U13](./UPGRADES.md#u13). What a line asks for, the line editor
  and running a line are `shell.ts`, tested; the pane is not
  ([T10.13](#t10-13)).
- **Context:** T11c. Typing into the console did nothing, by design
  ([T10.24](#t10-24)), and I wanted it to work as a shell limited
  to herbie-lite's own invocations, never its input commands.
- **Why:** A console that looks like a terminal and ignores the keyboard
  reads as broken. Typing the same command lines the README gives makes
  the console a place to try them, and what works there works in a
  terminal. The limit is what [T9.5](#t9-5) protects: no program but this
  one, and with no server ([T10.16](#t10-16)) nothing typed can reach
  beyond the page. Typed input commands stay refused, as [T9.12](#t9-12)
  decided for the CLI: they are written in a file. Buttons that enter
  their command, rather than running beside the prompt, keep one path for
  a run and show the command a reader could copy. A company field that
  accepts any name keeps the CLI's behaviour, Q33's error included; the
  suggestions spare typing. The `keyCode` fallback costs a few lines and
  makes the console work in the Claude app's pane, where Enter otherwise
  did nothing, as [T11.4](#t11-4) found for the name form. **Rejected:** an
  argument field beside **Run** instead of a prompt, which looks less like
  a shell; a dropdown of declared companies only, which hides Q33; buttons
  that run without showing their command; and accepting any `node`
  script.
- **Supersedes:** [T10.24](#t10-24), in part: the console taking no input
  and having no query options. The xterm.js pane and how a run is shown
  stand. Also [T9.5](#t9-5), in part: "not a shell"; running herbie-lite
  and nothing else stands.
- **Origin:** A console that runs typed herbie-lite commands only, the
  forms it accepts, and keeping the buttons: Mine. The buttons entering
  their command at the prompt, the field with suggestions, and the
  `keyCode` fallback: LLM-suggested, accepted.

---

## Open questions

Open questions live in [PLAN §4](./PLAN.md#4-questions-and-assumptions-document-all-in-readme)
and move here once resolved.
