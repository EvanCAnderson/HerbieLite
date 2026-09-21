# Herbie Lite

A code sample for Drive Capital. It reads a file describing Drive's
interpersonal network — partners, companies, employees, and the contacts
between them — and reports, for every company, the partner with the strongest
relationship to it.

```
$ node dist/bin.js examples/input.txt
ACME: No current relationship
Globex: Chris (2)
Hooli: Molly (1)
```

`examples/input.txt` is that example, verbatim from the brief and the same
file the test suite asserts against; four more examples sit beside it.

The submission that answers the brief is tagged `base-submission`; any later
commit is an upgrade beyond it ([T9.2](docs/DECISIONS.md#t9-2)).

---

## Build, run, and test

**Requires Node.js 22.13 or later** (`node --version`). No other runtime
dependencies; everything else is a dev dependency.

```bash
npm install
```

```bash
npm run check
```

`check` is the gate: type-check, lint, format check, then the full test suite,
stopping at the first failure. It needs no build step.

```bash
npm run build
```

Compiles to `dist/`. Individual scripts are `npm run typecheck`, `npm run lint`,
`npm run format:check`, `npm test`, and `npm run test:watch`.

```bash
npm run coverage
```

Runs the tests with line and branch coverage over `src/`, printing a table and
writing an HTML report to `coverage/`. It is a report, not part of `check`
([T9.3](docs/DECISIONS.md#t9-3)).

### Running it

Four forms, all equivalent in what they print
([T1.10](docs/DECISIONS.md#t1-10)):

```bash
node dist/bin.js examples/input.txt        # a file argument, after npm run build
cat examples/input.txt | node dist/bin.js  # STDIN
npm start -- examples/input.txt            # the same, from source, no build
cat examples/input.txt | npm start
```

The general form is `node dist/bin.js [--help | file]`, and `--help` (or
`-h`) prints it with the four commands and the contact types
([Q19](docs/DECISIONS.md#q19)):

```bash
node dist/bin.js --help
npm start -- --help   # from source
```

From source, the `--` matters: `npm start --help` is read by npm, which prints
its own help instead.

Typing input directly is the STDIN form with nothing piped in:

```bash
node dist/bin.js
```

Type one command per line and press **Ctrl+D** to finish; the report prints
then. Note that the program says nothing on startup and prints nothing until
you finish — there is no prompt or banner, which is a deliberate omission
rather than an oversight ([T6.13](docs/DECISIONS.md#t6-13), and see
[Deliberately left out](#deliberately-left-out)).

### Exit codes

- **0** — a report was produced. Bad lines in the input never change this:
  they are reported on stderr and the report still prints.
- **1** — no report was produced: more than one argument, an unknown option, a
  file that could not
  be read, or an I/O failure.

Warnings go to stderr and the report to stdout, so `node dist/bin.js examples/input.txt >
report.txt` gives a clean file with the warnings still on screen.

---

## Examples

[`examples/`](examples) holds five inputs. Each one runs as it stands, and each
is asserted by the test suite for its exact report **and** its exact warnings,
so none of them can quietly stop matching the program
([T7.5](docs/DECISIONS.md#t7-5)).

| File                    | What it shows                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `input.txt`             | The brief's example, verbatim.                                                                                                               |
| `late-declarations.txt` | Every name used before it is declared, and resolved anyway (Q5, Q8, Q12).                                                                    |
| `ties.txt`              | The alphabetical tie-break (Q1), and code-unit sorting, where `Zebra` precedes `acme` (Q14).                                                 |
| `names-and-repeats.txt` | A keyword used as a name (Q9), a person and a company sharing one (Q12), a repeated contact counting twice (Q13), and an empty company (Q2). |
| `warnings.txt`          | Every warning the program can print, with the report still printing underneath (Q7).                                                         |

The input format has no comment syntax — the brief marks the comment in its own
example as illustration only — so none of these files is annotated; what each
one shows is described here instead.

### Declaration order does not matter

The brief guarantees only that a company precedes its employees, and its own
example declares a partner after the contacts naming them. Nothing about a
person or a contact is judged until input ends, so this file works despite
naming everything backwards:

```
$ cat examples/late-declarations.txt
Contact Laurie Chris coffee
Employee Laurie Globex
Partner Chris
Company Globex

Employee Rahim ACME
Contact Rahim Molly call
Contact Rahim Molly email
Partner Molly
Company ACME

$ node dist/bin.js examples/late-declarations.txt
ACME: Molly (2)
Globex: Chris (1)
```

No warnings: the contact on line 1 finds an employee declared on line 2, whose
company arrives on line 4, and a partner declared on line 3. An implementation
that resolved each name as it read it would reject most of this file, and the
brief's own example would not tell you which kind you had.

### Every warning, on one file

`warnings.txt` produces twelve warnings, which between them cover every message
the program can print: the four ways the parser rejects a line, both wordings of
a repeated declaration, an employee at an undeclared company, and a contact that
fails on an unknown employee, an unknown partner, or two names in swapped roles.

```
$ node dist/bin.js examples/warnings.txt
Globex: Chris (2)

$ node dist/bin.js examples/warnings.txt >/dev/null   # drop the report, keep the warnings
herbie-lite: line 6: unknown command; expected one of Partner, Company, Employee, Contact; discarded: # A comment is not a command
herbie-lite: line 7: unknown command; expected one of Partner, Company, Employee, Contact; discarded: partner Rezzan
herbie-lite: line 8: wrong number of words; expected "Company <Name>"; discarded: Company Drive Capital
herbie-lite: line 9: names must be letters only; expected "Partner <Name>"; discarded: Partner Jean-Luc
... and eight more, through line 18
```

Three things in that file are worth pointing at:

- **Line 8, `Company Drive Capital`,** is why Drive Capital can never appear in
  the output: a name is one word, so the declaration is not expressible (Q3).
- **Line 10 holds a literal non-breaking space** between `Chris` and `Smith`.
  It is invisible in the file, and the warning shows it as
  `Partner Chris\u00a0Smith` ([T6.11](docs/DECISIONS.md#t6-11)) — which is the
  whole reason quoted input is escaped.
- **The warnings are not in line order.** Lines 6 to 11 are reported as they are
  read, so typed input is answered immediately; lines 13 to 18 wait until the
  whole file is in, because a name cannot be judged before then
  ([T6.7](docs/DECISIONS.md#t6-7)).

---

## How it works

The program is four layers, each testable without the one above it
([T1.11](docs/DECISIONS.md#t1-11)):

| Module       | Role                                                                             |
| ------------ | -------------------------------------------------------------------------------- |
| `parser.ts`  | One line of text → a typed `Command`, or a malformed-line result.                |
| `network.ts` | Applies commands, holds what it cannot yet resolve, resolves at end of input.    |
| `report.ts`  | Pure function: a resolved network → the lines of the report.                     |
| `cli.ts`     | The only module that touches a stream: picks a source, wires the layers, prints. |

`cli.ts` has three helpers of its own: `lines.ts` reads a stream as numbered
lines, `warnings.ts` holds every word the program writes to stderr
([T6.5](docs/DECISIONS.md#t6-5)), and `help.ts` builds the usage line and
`--help` from the parser's grammar table ([Q18](docs/DECISIONS.md#q18)). `bin.ts` is the executable entry and contains
no logic, so nothing has to detect how it was loaded
([T1.6](docs/DECISIONS.md#t1-6)).

The design decisions behind that, each with what it costs:

- **Commands are a discriminated union** on the keyword, with an `assertNever`
  guard in every switch ([T1.12](docs/DECISIONS.md#t1-12)). Adding a fifth
  command makes the compiler name every place that must handle it.
- **The network stores raw facts, not tallies**
  ([T1.13](docs/DECISIONS.md#t1-13)). Strengths are computed at report time.
  Pre-summing while reading is impossible anyway — a contact cannot be resolved
  until all input is in — and keeping the contacts is what would let the other
  questions Herbie answers ("who do we know at ACME?") be added later. The cost
  is one extra pass over the contacts per run.
- **Nothing about a person or a contact is judged until input ends**
  ([T4.3](docs/DECISIONS.md#t4-3)). `buildNetwork` therefore takes the whole
  command stream as one argument rather than being an object fed line by line,
  because such an object would answer every question wrongly until it was told
  input had finished. The cost is that the commands are held in memory, which
  [T1.13](docs/DECISIONS.md#t1-13) already requires.
- **The report layer exports one function** and keeps its tallies private
  ([T5.1](docs/DECISIONS.md#t5-1)). It returns lines, not a joined string, so
  the choice of line ending and trailing newline stays with the stream that
  writes them.
- **Bad data warns; a broken invariant crashes**
  ([T6.1](docs/DECISIONS.md#t6-1)). A malformed line is data, and data never
  costs the user the report. A network that contradicts its own invariants is a
  bug, so it throws and the stack trace survives
  ([T5.2](docs/DECISIONS.md#t5-2)). Only the read and the final write are
  caught, and the reader names its own failures so that a bug in another layer
  is never misreported as a problem with the user's file
  ([T6.12](docs/DECISIONS.md#t6-12)).
- **`main` takes its streams as arguments** and returns an exit code
  ([T6.2](docs/DECISIONS.md#t6-2)), so every test drives the real entry point
  with no stubbing and `process` is named in exactly one file.
- **Input is streamed, not slurped** ([T6.4](docs/DECISIONS.md#t6-4)), which is
  what lets a mistyped line be answered as it is typed. Lines are split on `\n`
  alone: `readline` also breaks on a lone `\r`, which would silently renumber
  every later line and make every later warning point at the wrong one.

Tests sit beside the code they cover ([T1.1](docs/DECISIONS.md#t1-1)). The
brief's example is tested twice: `report.test.ts` reads the shipped `examples/input.txt`
from disk, so the file a reviewer runs and the file the suite asserts on cannot
drift apart ([T5.5](docs/DECISIONS.md#t5-5)), and `cli.test.ts` spawns the
program end to end for both the file argument and a pipe, asserting the exact
output with **empty stderr** ([T6.10](docs/DECISIONS.md#t6-10)).

---

## How I used LLM tools

I used Claude throughout, as an engineer I was pairing with rather than as a
generator: it produced most of the first drafts, and I directed the work,
argued with it, and own the result.

The method was to make the reasoning the artifact. The repository carries three
documents: the brief, frozen verbatim as the source of truth; a
[plan](docs/PLAN.md) that turns it into checkable requirements, open questions,
and tasks; and a [decision log](docs/DECISIONS.md) where every choice is written
down **when it is made**, with its context, its reasoning, and the alternatives
it rejected. All three are loaded into the model's context at the start of every
session ([T4.1](docs/DECISIONS.md#t4-1)), so a settled question stays settled
instead of being relitigated three sessions later, and a decision made in
conversation reaches the record even when it changes no code yet
([T4.2](docs/DECISIONS.md#t4-2)).

Every entry in that log ends with an **Origin** line recording where the idea
came from: `Mine`, `LLM-suggested, accepted`, `LLM-suggested, modified` with
what I changed, or `LLM-suggested, rejected`. Those lines are the honest record,
and the pattern in them is roughly this. The model was reliably good at
scaffolding, at naming the alternatives to a choice once asked, and at finding
the case I had not considered — a stray `\r` renumbering every warning, a
warning that garbles itself on a Windows file. It was less good at judgment
about scope and about what a user experiences: it recommended failing on the
first bad line, leaving a byte-order mark unhandled, and shipping a one-line
interactive hint, and I overruled all three for reasons the relevant entries
give. Asking it for its reasoning before accepting a recommendation changed the
recommendation often enough to be worth doing every time, and twice changed my
own.

Nothing here was accepted because it compiled. Where I took the model's
suggestion, the entry says so; where I did not, the entry says what it
recommended instead.

---

## Assumptions and edge cases

The brief allows well-formed input to be assumed. This program does not: every
line is validated, and anything it rejects is reported rather than dropped
silently. Items marked † are places where the brief was open to more than one
reading and I chose one.

### What counts as a line

A **word is letters only**, `[A-Za-z]+` †. The brief says "the upper- and
lowercase characters A thru z", which read literally as an ASCII range would
also admit `[ \ ] ^ _` and a backtick; "upper- and lowercase characters" makes
letters the clear intent (Q9). Two consequences worth naming: a keyword is a
legal name, so `Company Contact` declares a company called Contact and the
program handles it; and because every name in the output is letters, no control
character or terminal escape sequence from the input can ever reach the report.

**Words are separated by runs of spaces or tabs**, and leading and trailing
whitespace is ignored, as is the trailing `\r` of a Windows line ending (Q10).
An unusual space — a non-breaking space, say — stays part of its word and so
fails the letters-only check, which means it is warned about rather than
silently accepted.

**Command keywords are case-sensitive** (Q11): `partner Chris` is an unknown
command, not a `Partner`. Names are case-sensitive too (Q4), and so are contact
types, so `Email` is rejected. One rule covers every word on a line.

**A line with no words is skipped silently** (Q6) — the shipped `examples/input.txt`
ends with one, as the brief's example does.

**A byte-order mark at the very start of the file is removed, silently** (Q16).
A file saved by Windows Notepad or as Excel's UTF-8 CSV begins with an
invisible character that would otherwise make line 1 an unknown command; if
line 1 were `Partner Chris`, every later contact naming Chris would fail to
resolve and the report would name a different partner — one invisible byte, and
a wrong answer. A U+FEFF anywhere else is treated as data and rejected by the
letters-only rule.

### Names and identity

**One name means one person** †. The brief says employee names are "globally
unique" and shows only employees; I read that as a single namespace shared by
partners and employees, so a name is never both (Q12). Company names are their
own namespace — a company may share a name with a person, which the
letters-only rule makes likely, and that is not a conflict. This is what lets a
swapped `Contact` line say "Chris is declared as a partner, not an employee"
instead of calling two known names unknown.

**Declaration order never matters.** The brief only guarantees that a company
precedes its employees, and its own example declares a partner after the
contacts that name them. Contacts are therefore resolved after all input is read
(Q8), and so are partners and employees (Q5, Q12). A name that never resolves is
reported with the line it came from and discarded.

**A repeated declaration is discarded with a warning; a repeated contact
counts** †. The brief defines strength as the "total amount of Contacts", so
two identical `Contact` lines are two interactions — the input has no field that
could distinguish a genuine repeat from a double entry (Q13). A second
`Partner`, `Company`, or `Employee` line for the same name is a data error: the
first valid declaration stands, and the warning says which line it was, wording
an exact repeat differently from a name claimed by a different declaration
([T6.8](docs/DECISIONS.md#t6-8)).

### When the input is wrong

**Every bad line is discarded with one stderr warning, and the report still
prints** (Q7). The warning gives the line number, what was wrong, the expected
format for that command, and the line itself:

```
herbie-lite: line 9: contact type must be one of email, call, coffee; expected "Contact <EmployeeName> <PartnerName> <ContactType>"; discarded: Contact Laurie Chris text
```

The alternative — refusing to report until the file is clean — withholds the
answer over a typo. The tradeoff is that a discarded contact lowers that
partner's strength and a close result can then name a different partner; the
warning is the signal that the report may be affected. Warnings for malformed
lines appear as each line is read, so typed input is answered immediately, while
warnings that need the whole file appear at the end; stderr is therefore in two
passes rather than one run of line order ([T6.7](docs/DECISIONS.md#t6-7)).

**Quoted input is escaped and capped at 200 characters**
([T6.11](docs/DECISIONS.md#t6-11)). Control, format and separator characters are
shown as `\t`, `\r`, or `\u00a0`, so an invisible character is visible in the
warning and a hostile or merely binary file cannot send terminal escape
sequences to stderr. Past the cap the quote ends `... (5008 characters)`.
Visible non-ASCII such as `Zoë` is left as typed. **Known limit:** invalid
UTF-8 arrives as the replacement character U+FFFD, which is printable and so is
not escaped — the warning shows `�` and cannot recover the original bytes.

**The command line takes one optional file path, or `--help`** (Q15, Q19).
Zero arguments reads STDIN. `--help` or `-h` prints the help and exits 0,
wherever it appears. Two or more paths, any other argument starting with `-`
(including `-` alone, which does not mean STDIN), and a file that cannot be
read are each an error: one line on stderr, ending with the usage when the
invocation itself was wrong, and exit 1 with no report. A file whose name
starts with `-` is reached as `./-name`. The path or option is quoted and
escaped in that line like any other input ([T8.4](docs/DECISIONS.md#t8-4)).

**A closed stdout ends the run quietly** (Q17). `node dist/bin.js examples/input.txt |
head -1` is a correct pipeline, and `head` closing the pipe is not a failure:
the program exits 0 with no message. Any other write failure, and any failure
while reading, prints one line and exits 1. **A stderr that cannot be written to
is silent** ([T6.15](docs/DECISIONS.md#t6-15)): warnings are lost, and the exit
code still reflects only what stdout did, because failing the run would discard
a report that stdout accepted.

### The report

**Every declared company is listed** (FR4), sorted alphabetically, whether or
not anyone at Drive knows it.

**A company with no contacts — including one with no employees — prints `No
current relationship`** (Q2). Strength 0 is not a relationship.

**Drive Capital never appears** (Q3). It is never declared with `Company`, and
it could not be: names are a single word, so `Company Drive Capital` is not
expressible.

**Ties go to the alphabetically first partner** †. The brief's output format
names exactly one partner and says nothing about ties (Q1). The rule is
deterministic and independent of input order, which "earliest contact wins"
would not be — the brief never says the file is chronological. **The output
gives no sign that a tie occurred:** `Globex: Abdi (2)` reads identically
whether Abdi won outright or on the alphabetical rule, and the winner is
arbitrary in business terms. A tie-break that means something is
[U4](docs/UPGRADES.md#u4).

**"Sorted alphabetically" means UTF-16 code-unit order** †, so every uppercase
letter sorts before every lowercase one and `Zebra` precedes `acme` (Q14).
Because names are letters only this is ordinary alphabetical order for input of
one case — every example in the brief. `localeCompare` was rejected: it groups
`acme` with `ACME` as a person would, but it depends on the runtime's locale
data, so a submission could print a different order when graded than it does
here.

**No declared companies prints nothing at all**, not a blank line
([T6.14](docs/DECISIONS.md#t6-14)) — a list of no companies is no output, and
anything counting lines would otherwise see one report where there is none.

### Every question, and where it was settled

| ID    | Assumption                                                                | Settled in                       |
| ----- | ------------------------------------------------------------------------- | -------------------------------- |
| Q1 †  | Ties go to the alphabetically first partner                               | [T5.3](docs/DECISIONS.md#t5-3)   |
| Q2    | No contacts, or no employees → `No current relationship`                  | [T1.14](docs/DECISIONS.md#t1-14) |
| Q3    | Drive Capital never appears in the output                                 | [T1.15](docs/DECISIONS.md#t1-15) |
| Q4    | Names are case-sensitive                                                  | [T1.16](docs/DECISIONS.md#t1-16) |
| Q5    | Declarations are resolved at end of input; the first valid one stands     | [T1.17](docs/DECISIONS.md#t1-17) |
| Q6    | Blank lines are skipped silently; every other bad line gets Q7            | [T1.18](docs/DECISIONS.md#t1-18) |
| Q7    | A malformed line is discarded with a warning; the report still prints     | [T1.19](docs/DECISIONS.md#t1-19) |
| Q8    | Contacts are resolved after all input; unresolved ones are warned         | [T1.20](docs/DECISIONS.md#t1-20) |
| Q9 †  | A word is letters only, `[A-Za-z]+`                                       | [T1.21](docs/DECISIONS.md#t1-21) |
| Q10   | Words split on runs of spaces or tabs; edges and a CRLF `\r` ignored      | [T3.2](docs/DECISIONS.md#t3-2)   |
| Q11   | Command keywords are case-sensitive                                       | [T3.3](docs/DECISIONS.md#t3-3)   |
| Q12 † | One name, one person; companies have their own namespace                  | [T2.7](docs/DECISIONS.md#t2-7)   |
| Q13 † | Every `Contact` line counts; a repeated declaration is warned and dropped | [T2.6](docs/DECISIONS.md#t2-6)   |
| Q14 † | "Sorted alphabetically" is UTF-16 code-unit order                         | [T5.4](docs/DECISIONS.md#t5-4)   |
| Q15   | One optional file argument; a bad invocation exits 1                      | [T6.3](docs/DECISIONS.md#t6-3)   |
| Q16   | A byte-order mark is stripped in the reader, silently                     | [T6.6](docs/DECISIONS.md#t6-6)   |
| Q17   | A closed stdout ends quietly; other I/O fails loudly                      | [T6.9](docs/DECISIONS.md#t6-9)   |
| Q18   | The help text is built from the parser's grammar table                    | [T9.9](docs/DECISIONS.md#t9-9)   |
| Q19   | `--help` and `-h` are the only options, and win wherever they appear      | [T9.10](docs/DECISIONS.md#t9-10) |

† The brief was open to more than one reading here.

---

## Deliberately left out

The brief grades how quality software is built rather than how much of it there
is, so anything it does not ask for was written down in
[UPGRADES](docs/UPGRADES.md) instead of being built: a guided input-file builder
(U1), a tie-break that reflects the relationship rather than the alphabet (U4),
and an opening explanation for typed input (U6). `--help` and a usage line (U5)
were deferred the same way and built after the base was tagged
([T9.10](docs/DECISIONS.md#t9-10)).
Each entry carries the open questions it would have to answer, so what was
deferred is the work, not the thinking.

Two exceptions were pulled into the base, each because leaving it out meant
shipping a program that could be confidently wrong:

- **Stripping a byte-order mark** ([T6.6](docs/DECISIONS.md#t6-6)) — one
  invisible byte in a file a reviewer could plausibly produce would otherwise
  change the reported partner, with three warnings that cannot show the cause.
- **Escaping quoted input** ([T6.11](docs/DECISIONS.md#t6-11)) — a warning on a
  Windows file was found overwriting its own text, so the message naming the
  problem was lost.

---

## Where the reasoning lives

- [`docs/BRIEF.md`](docs/BRIEF.md) — the interview prompt, verbatim and frozen.
- [`docs/PLAN.md`](docs/PLAN.md) — requirements, the task breakdown, and an
  index of the decisions worth reading first.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — every decision in the order it was
  made, with its alternatives and where the idea came from.
- [`docs/UPGRADES.md`](docs/UPGRADES.md) — what was deliberately deferred.
- [`CLAUDE.md`](CLAUDE.md) — the working rules those documents are kept under.
