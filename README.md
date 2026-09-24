# Herbie Lite

A code sample for Drive Capital. It reads a file describing Drive's
interpersonal network: partners, companies, employees, and the contacts
between them. For every company, it reports the partner with the strongest
relationship to it.

```
$ node dist/bin.js examples/input.txt
ACME: No current relationship
Globex: Chris (2)
Hooli: Molly (1)
```

`examples/input.txt` is the brief's example, verbatim. The test suite asserts
against the same file, and five more examples sit beside it.

The submission that answers the brief is tagged `base-submission`. Every later
commit is an upgrade beyond it ([T9.2](docs/DECISIONS.md#t9-2)).

---

## Build, run, and test

**Requires Node.js 22.13 or later** (`node --version`). There are no runtime
dependencies; everything else is a dev dependency.

```bash
npm install
```

```bash
npm run check
```

`check` is the gate. It runs the type-check, lint, format check and tests, in
that order, and stops at the first failure. It needs no build.

```bash
npm run build
```

Compiles the program to `dist/` and bundles the web page into `dist/web/`.
Run it before any `node dist/bin.js` command below, and again after changing
the source. `npm start --` runs the source directly and needs no build.

The steps of `check` also run alone: `npm run typecheck`, `npm run lint`,
`npm run format:check`, `npm test`, and `npm run test:watch`.

```bash
npm run coverage
```

Runs the tests with line and branch coverage over `src/` and `web/`. It
prints a table and writes an HTML report to `coverage/`. It is a report, not
a gate ([T9.3](docs/DECISIONS.md#t9-3)).

```bash
npx playwright install chromium   # once: downloads the browser, about 94MB
npm run test:e2e
```

Builds the web page and runs seven tests that use it in a real browser. They
cover opening the page, running a file, typing a command, asking a query with
the buttons, editing and saving, naming a new file and watching its marks,
and deleting ([T10.29](docs/DECISIONS.md#t10-29),
[T12.5](docs/DECISIONS.md#t12-5)). They are not part of `check`, so `check`
still needs no browser. `check` does type-check and lint them
([T10.28](docs/DECISIONS.md#t10-28)).

### Running it

There are four forms, and all four print the same report
([T1.10](docs/DECISIONS.md#t1-10)):

```bash
node dist/bin.js examples/input.txt        # a file argument, after npm run build
cat examples/input.txt | node dist/bin.js  # STDIN
npm start -- examples/input.txt            # the same, from source, no build
cat examples/input.txt | npm start
```

The two `npm start` forms also print npm's own header on stdout, before the
report. To get only the report from source, add `--silent`:
`npm start --silent -- examples/input.txt > report.txt`
([T12.4](docs/DECISIONS.md#t12-4)).

The general form is
`node dist/bin.js [--help | [--partners <Company> | --employees <Company>] file]`.
`--help`, or `-h`, prints it along with the queries, the four commands and the
contact types ([Q19](docs/DECISIONS.md#q19)):

```bash
node dist/bin.js --help
npm start -- --help   # from source
```

From source, the `--` matters. Without it, npm reads `--help` itself and
prints its own help.

Commands come from a file: write them in any editor, then name the file or
pipe it in. A bare `node dist/bin.js` at a terminal does not wait for typed
commands. It prints a short welcome, how to give a file, and the four
commands, then exits 1, since no report was produced
([Q20](docs/DECISIONS.md#q20)). A file can be fixed at the line a warning
names and run again; a typed session cannot.

### Asking about one company

Two queries answer the brief's first example question, "Who do we know who
works at ACME Co?". They were added after the base was tagged, and print
instead of the report ([Q31](docs/DECISIONS.md#q31)):

```
$ node dist/bin.js --partners Globex examples/input.txt
Globex: Chris (2), Molly (1)

$ node dist/bin.js --employees Globex examples/input.txt
Jamie: No contacts
Laurie: Chris (2), Molly (1)
```

- `--partners` lists every partner who has contacted the company, strongest
  first. Equal strengths are alphabetical, as in the report, so the first
  partner is always the one the report names.
- `--employees` lists the company's employees alphabetically, each with the
  partners who contacted them ([Q32](docs/DECISIONS.md#q32)).

One query per run. The option can come before or after the file, and works
with a pipe. Warnings still print, since a discarded line can change an
answer. Tie notes do not, since `--partners` already shows every tied
partner. A company the input never declares is an error, exit 1, checked once
the whole file is read ([Q33](docs/DECISIONS.md#q33)).

### Exit codes and streams

- **0**: a report, or a query's answer, was produced. Bad lines never change
  this. They are reported on stderr, and the output still prints.
- **1**: nothing was produced. The causes are more than one file argument, an
  unknown option, a query with no company, two queries, a company the input
  never declares, no file at a terminal (which prints the opening instead), a
  file that could not be read, or an I/O failure.

The report goes to stdout; warnings and tie notes go to stderr. So
`node dist/bin.js examples/input.txt > report.txt` gives a clean file and
leaves the warnings on screen.

### In a browser

Since the base was tagged, a web page does the same work in a browser:

```bash
npm run ui
```

This builds the page and serves it at <http://127.0.0.1:5170>. It has three
parts:

- **Files.** The six examples are listed read-only. Any of them can be copied
  into a workspace, and any `.txt` file on disk can be opened into it.
- **Console.** A shell that runs herbie-lite and nothing else
  ([T11.5](docs/DECISIONS.md#t11-5)). Type a command as in a terminal:
  `node dist/bin.js examples/input.txt`, a query, the same through
  `npm start --`, or `cat examples/input.txt | node dist/bin.js`. A file is
  `examples/<name>`, or a workspace file by its name; `help` lists the rest.
  **Run** types the command for the file shown. A company field with
  **--partners** and **--employees** types a query. Each run prints what the
  command line would, then the exit code. It is the program's own code, not a
  copy, so the output matches line for line
  ([T10.23](docs/DECISIONS.md#t10-23)).
- **Editor.** A workspace file opens as text, with the four commands beside
  it, or below it on a narrow screen. As you type, each line the program would
  warn about is marked. It is _discarded_ if it would be thrown away as it
  stands, and _pending_ if it names a company or person not declared yet
  ([Q29](docs/DECISIONS.md#q29)). A file saves with marks or without, and
  **Run** runs the editor's text, saved or not.

What it does not do:

- **It has no server** ([T10.16](docs/DECISIONS.md#t10-16)). `npm run ui` only
  serves the built files. Everything runs in the page, and nothing is sent
  anywhere.
- **The workspace lives in that browser**, in its local storage. Files reach
  your disk only as downloads, so editing a file opened from disk never
  changes the original. Writing back to it was not built
  ([U12](docs/UPGRADES.md#u12)). If the browser refuses storage, as some
  private windows do, the workspace lasts until reload, and the page says so.
- **The examples cannot be edited**, since the tests assert every one
  ([T9.6](docs/DECISIONS.md#t9-6)). Copy one to change it.
- **The console runs nothing else** ([T9.5](docs/DECISIONS.md#t9-5)). Another
  program is refused with a reason. So is a command such as `Partner Chris`
  typed on its own, since commands go in a file
  ([T9.12](docs/DECISIONS.md#t9-12)).
- **Two tabs can edit one file, and neither edit is lost.** A save from an
  older copy is refused, and offers to keep yours or load theirs
  ([Q26](docs/DECISIONS.md#q26)).

---

## Examples

[`examples/`](examples) holds six inputs. The test suite asserts each one's
exact report **and** exact warnings, so none can quietly stop matching the
program ([T7.5](docs/DECISIONS.md#t7-5)).

| File                    | What it shows                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `input.txt`             | The brief's example, verbatim.                                                                                                                                                  |
| `late-declarations.txt` | Every name used before it is declared, and resolved anyway (Q5, Q8, Q12).                                                                                                       |
| `ties.txt`              | The alphabetical tie-break (Q1) and its note on stderr (Q21), and code-unit sorting, where `Zebra` precedes `acme` (Q14).                                                       |
| `names-and-repeats.txt` | A keyword used as a name (Q9), a person and a company sharing one (Q12), a repeated contact counting twice (Q13), and an empty company (Q2).                                    |
| `queries.txt`           | Both queries (Q31, Q32): `--partners` ranking three partners, `--employees` with an employee nobody contacted, and a tie the report notes but `--partners Hooli` shows in full. |
| `warnings.txt`          | Every warning the program can print, with the report still printing underneath (Q7).                                                                                            |

The input format has no comments. The brief marks the comment in its own
example as illustration only. So the files are not annotated, and what each
shows is described here.

### Declaration order does not matter

The brief guarantees only that a company comes before its employees. Its own
example declares a partner after the contacts that name them. Nothing about a
person or a contact is judged until input ends, so this file works although
it names everything backwards:

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

There are no warnings. The contact on line 1 finds its employee on line 2,
whose company arrives on line 4, and its partner on line 3. A program that
resolved each name as it read it would reject most of this file. The brief's
own example would not show the difference.

### Every warning, on one file

`warnings.txt` produces twelve warnings, which cover every message the
program can print:

- the four ways the parser rejects a line;
- both wordings of a repeated declaration;
- an employee at an undeclared company;
- a contact with an unknown employee, an unknown partner, or two names in
  swapped roles.

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

Three lines in it are worth pointing at:

- **Line 8, `Company Drive Capital`,** shows why Drive Capital can never
  appear in the output. A name is one word, so that declaration cannot be
  written (Q3).
- **Line 10 holds a literal non-breaking space** between `Chris` and `Smith`.
  It is invisible in the file, and the warning shows it as
  `Partner Chris\u00a0Smith` ([T6.11](docs/DECISIONS.md#t6-11)). That is why
  quoted input is escaped.
- **Two kinds of problem print in one order.** Lines 6 to 11 fail on their
  own words. Lines 13 to 18 fail only once the whole file is in, because a
  name cannot be judged before then. All warnings print after input ends, in
  line order, so stderr reads like the file
  ([T9.13](docs/DECISIONS.md#t9-13)).

---

## How it works

The program is four layers, each testable without the one above it
([T1.11](docs/DECISIONS.md#t1-11)):

| Module       | Role                                                                             |
| ------------ | -------------------------------------------------------------------------------- |
| `parser.ts`  | One line of text → a typed `Command`, or a malformed-line result.                |
| `network.ts` | Applies commands, holds what it cannot yet resolve, resolves at end of input.    |
| `report.ts`  | Pure functions: a resolved network → the report, its ties, and the queries.      |
| `cli.ts`     | The only module that touches a stream: picks a source, wires the layers, prints. |

`cli.ts` has four helpers of its own:

- `run.ts` does all of the program's work apart from streams: it reads the
  arguments and the input, and decides what goes to stdout and stderr. The
  web console runs the same code ([T10.23](docs/DECISIONS.md#t10-23)).
- `lines.ts` reads decoded text as numbered lines.
- `warnings.ts` words every warning and error the program writes to stderr
  ([T6.5](docs/DECISIONS.md#t6-5)).
- `help.ts` builds the usage line, `--help`, and the opening for a run with no
  file, from the parser's grammar table ([Q18](docs/DECISIONS.md#q18)).

`bin.ts` is the executable entry and holds no logic, so nothing has to detect
how it was loaded ([T1.6](docs/DECISIONS.md#t1-6)).

The web page uses the same layers; it is not a fifth one. Its code is in
`web/`, with its own TypeScript project, so browser code cannot reach for a
Node API, and the program's code cannot reach for the DOM
([Q22](docs/DECISIONS.md#q22)). The parser, network, report and `run.ts` run
in the page unchanged, which works because none of them does any I/O. The
page's logic is in modules with no DOM, tested in vitest. The code that draws
the page is covered by the browser tests ([Q23](docs/DECISIONS.md#q23),
[Q36](docs/DECISIONS.md#q36)).

The main design decisions, each with what it costs:

- **Commands are a discriminated union** on the keyword, with an
  `assertNever` guard in every switch ([T1.12](docs/DECISIONS.md#t1-12)).
  Adding a fifth command makes the compiler name every place that must handle
  it.
- **The network stores raw facts, not tallies**
  ([T1.13](docs/DECISIONS.md#t1-13)). Strengths are computed at report time.
  Tallying while reading is impossible anyway, since a contact cannot be
  resolved until all input is in. Keeping the contacts is also what let the
  queries be added later. The cost is one extra pass over the contacts.
- **Nothing about a person or a contact is judged until input ends**
  ([T4.3](docs/DECISIONS.md#t4-3)). So `buildNetwork` takes the whole command
  stream as one argument. An object fed line by line would answer every
  question wrongly until told the input had ended. The cost is holding the
  commands in memory, which T1.13 already requires.
- **The report layer keeps its tallies private**
  ([T5.1](docs/DECISIONS.md#t5-1)). It exports three functions: the report
  with its ties ([T10.7](docs/DECISIONS.md#t10-7)), and one per query
  ([T10.9](docs/DECISIONS.md#t10-9)). All three share one ranking, so they
  cannot disagree about who comes first. They return lines, not one string,
  so the line ending stays with the stream that writes them.
- **Bad data warns; a broken invariant crashes**
  ([T6.1](docs/DECISIONS.md#t6-1)). A malformed line is data, and data never
  costs the user the report. A network that breaks its own invariants is a
  bug, so it throws and keeps its stack trace
  ([T5.2](docs/DECISIONS.md#t5-2)). Only the read and the final write are
  caught. The reader names its own failures, so a bug elsewhere is never
  blamed on the user's file ([T6.12](docs/DECISIONS.md#t6-12)).
- **`main` takes its streams as arguments** and returns an exit code
  ([T6.2](docs/DECISIONS.md#t6-2)). Every test drives the real entry point
  with no stubbing, and `process` is named in one file only.
- **Input is read by the program's own line reader**
  ([T6.4](docs/DECISIONS.md#t6-4)), so each line number is exact. It splits
  on `\n` alone. Node's `readline` also splits on a lone `\r`, which would
  silently renumber every later line, and every later warning with it.

Tests sit beside the code they cover ([T1.1](docs/DECISIONS.md#t1-1)). The
brief's example is tested twice. `report.test.ts` reads the shipped
`examples/input.txt`, so the file a reviewer runs and the file the suite
checks cannot drift apart ([T5.5](docs/DECISIONS.md#t5-5)). `cli.test.ts`
runs the program as a process, with a file argument and with a pipe, and
asserts the exact output with **empty stderr**
([T6.10](docs/DECISIONS.md#t6-10)).

---

## How I used LLM tools

I used Claude throughout, as an engineer I was pairing with. It wrote the
first drafts. I directed the work, argued with it, and own the result.

The method was to make the reasoning the artifact. The repository carries
three documents:

- the brief, frozen verbatim as the source of truth;
- a [plan](docs/PLAN.md) that turns it into checkable requirements, open
  questions, and tasks;
- a [decision log](docs/DECISIONS.md), where every choice is written down
  **when it is made**, with its context, its reasoning, and the alternatives
  it rejected.

All three are loaded into the model's context at the start of every session
([T4.1](docs/DECISIONS.md#t4-1)). So a settled question stays settled, and a
decision made in conversation reaches the record even before it changes any
code ([T4.2](docs/DECISIONS.md#t4-2)).

Every entry in the log ends with an **Origin** line saying where the idea
came from: `Mine`, `LLM-suggested, accepted`, `LLM-suggested, modified` with
what I changed, or `LLM-suggested, rejected`. Those lines are the honest
record, and they show a pattern:

- The model was reliably good at scaffolding, at naming the alternatives to
  a choice once asked, and at finding cases I had missed: a stray `\r`
  renumbering every warning, or a warning that garbles itself on a Windows
  file.
- It was weaker on scope and on what a user experiences. It recommended
  failing on the first bad line, leaving a byte-order mark unhandled, and
  shipping a one-line interactive hint. I overruled all three, for reasons
  the entries give.
- Asking for its reasoning before accepting a recommendation often changed
  the recommendation, so I did it every time. Twice it changed my own view.

Nothing was accepted because it compiled. Where I took the model's
suggestion, the entry says so. Where I did not, it says what the model
recommended instead.

One failure was the tools' own. They wrote some escape sequences in the
decision log as the characters they name: invisible marks, and a raw terminal
escape that turned a terminal red when the file was printed. An audit found
them. The escapes were restored in place, each line listed
([Q37](docs/DECISIONS.md#q37)), and a test in `check` now fails on any such
character in a Markdown file ([T12.3](docs/DECISIONS.md#t12-3)).

---

## Assumptions and edge cases

The brief allows well-formed input to be assumed. This program does not
assume it: every line is checked, and anything rejected is reported, never
dropped silently. Items marked † are where the brief allowed more than one
reading and I chose one.

### What counts as a line

**A word is letters only**, `[A-Za-z]+` †. The brief says "the upper- and
lowercase characters A thru z". Read as an ASCII range, `A`–`z` would also
admit `[ \ ] ^ _` and a backtick. "Upper- and lowercase characters" makes
letters the clear intent (Q9). Two consequences:

- A keyword is a legal name. `Company Contact` declares a company called
  Contact.
- Every name in the output is letters, so no control character or terminal
  escape from the input can reach the report.

**Words are separated by runs of spaces or tabs** (Q10). Leading and trailing
whitespace is ignored, as is the `\r` of a Windows line ending. An unusual
space, such as a non-breaking space, stays part of its word. It then fails
the letters-only check, so it is warned about, not silently accepted.

**Keywords are case-sensitive** (Q11): `partner Chris` is an unknown command.
So are names (Q4) and contact types, so `Email` is rejected. One rule covers
every word on a line.

**A line with no words is skipped silently** (Q6). `examples/input.txt` ends
with one, as the brief's example does.

**A byte-order mark at the very start of the file is removed, silently**
(Q16). Windows Notepad, and Excel's UTF-8 CSV, start a file with this
invisible character. Left in, it makes line 1 an unknown command. If line 1
were `Partner Chris`, every contact naming Chris would then fail, and the
report would name a different partner. A U+FEFF anywhere else is data, and
the letters-only rule rejects it.

### Names and identity

**One name means one person** †. The brief says employee names are "globally
unique", and shows only employees. I read that as one namespace shared by
partners and employees, so a name is never both (Q12). Companies have their
own namespace. A company may share a name with a person, which letters-only
names make likely, and that is not a conflict. This is what lets a swapped
`Contact` line say "Chris is declared as a partner, not an employee", rather
than calling two known names unknown.

**Declaration order never matters.** The brief guarantees only that a company
comes before its employees, and its own example declares a partner after
contacts that name them. So contacts are resolved after all input is read
(Q8), and so are partners and employees (Q5, Q12). A name that never resolves
is reported with its line and discarded.

**A repeated declaration is discarded with a warning; a repeated contact
counts** †. The brief defines strength as the "total amount of Contacts", so
two identical `Contact` lines are two interactions. The input has no field
that could tell a real repeat from a double entry (Q13). A second `Partner`,
`Company`, or `Employee` line for the same name is a data error. The first
valid declaration stands, and the warning names its line. An exact repeat is
worded differently from a name claimed by a different declaration
([T6.8](docs/DECISIONS.md#t6-8)).

### When the input is wrong

**Every bad line is discarded with one warning on stderr, and the report
still prints** (Q7). The warning gives the line number, what was wrong, the
expected format, and the line itself:

```
herbie-lite: line 9: contact type must be one of email, call, coffee; expected "Contact <EmployeeName> <PartnerName> <ContactType>"; discarded: Contact Laurie Chris text
```

The alternative, refusing to report until the file is clean, withholds the
answer over a typo. The tradeoff is that a discarded contact lowers a
partner's strength, so a close result can name a different partner. The
warning is the signal that the report may be affected. All warnings print
after input ends, in line order ([T9.13](docs/DECISIONS.md#t9-13)).

**Quoted input is escaped and capped at 200 characters**
([T6.11](docs/DECISIONS.md#t6-11), [Q40](docs/DECISIONS.md#q40)). Control, format and separator characters
show as `\t`, `\r`, or `\u00a0`. So an invisible character is visible in the
warning, and a hostile or binary file cannot send terminal escapes to stderr.
Past the cap, the quote ends `... (5008 characters)`, counting characters
as a person would, not UTF-16 units. An escape that would pass the cap is
left out whole rather than cut. Visible non-ASCII such
as `Zoë` is left as typed. **Known limit:** invalid UTF-8 arrives as the
replacement character, U+FFFD. It is printable, so it is not escaped, and the
warning cannot show the original bytes.

**The command line takes one optional file, one optional query, or
`--help`** (Q15, Q19, [Q31](docs/DECISIONS.md#q31)). No file means STDIN.
`--help` or `-h` prints the help and exits 0, wherever it appears. Each query
option takes the next argument as the company. Every other bad invocation is
one line on stderr and exit 1, with no report; the causes are listed under
[Exit codes and streams](#exit-codes-and-streams). The line ends with the
usage when the invocation itself was wrong. `-` alone is an unknown option,
not STDIN, and a file whose name starts with `-` is reached as `./-name`. A
path or option in the message is quoted and escaped like any other input
([T8.4](docs/DECISIONS.md#t8-4)).

**A closed stdout ends the run quietly** (Q17).
`node dist/bin.js examples/input.txt | head -1` is a correct pipeline, and
`head` closing the pipe is not a failure, so the program exits 0 with no
message. Any other write failure, and any read failure, prints one line and
exits 1. **A stderr that cannot be written to is silent**
([T6.15](docs/DECISIONS.md#t6-15)). The warnings are lost, and the exit code
reflects only stdout, because failing the run would discard a report stdout
accepted.

### The report

**Every declared company is listed** (FR4), sorted alphabetically, whether or
not anyone at Drive knows it.

**A company with no contacts, or no employees, prints `No current
relationship`** (Q2). Strength 0 is not a relationship.

**Drive Capital never appears** (Q3). It is never declared with `Company`,
and it cannot be: names are one word, so `Company Drive Capital` cannot be
written.

**Ties go to the alphabetically first partner** †. The brief's format names
one partner and says nothing about ties (Q1). The rule is deterministic and
independent of input order. "Earliest contact wins" would not be, and the
brief never says the file is chronological. **The report line shows no sign
of a tie:** `Globex: Abdi (2)` reads the same whether Abdi won outright or
alphabetically, and the winner is arbitrary in business terms. Since the base
was tagged, a tie is noted on stderr after the report, as a footnote. The
line itself is unchanged ([Q21](docs/DECISIONS.md#q21)):

```
Globex: Abdi (2)
herbie-lite: Globex is a tie between Abdi and Zoe (2 contacts each); Abdi is shown because it comes first alphabetically
```

Tied partners are not ranked on anything else. Weighting contact types would
depart from the brief's count, and recency needs dates the input does not
have ([T10.3](docs/DECISIONS.md#t10-3)).

**"Sorted alphabetically" means UTF-16 code-unit order** † (Q14). Every
uppercase letter sorts before every lowercase one, so `Zebra` precedes
`acme`. For input in one case, as in every example in the brief, this is
ordinary alphabetical order. `localeCompare` was rejected. It groups `acme`
with `ACME` as a person would, but it depends on the runtime's locale data,
so the graded run could print a different order from this one.

**No declared companies prints nothing at all**, not a blank line
([T6.14](docs/DECISIONS.md#t6-14)). A list of no companies is no output.
Anything counting lines would otherwise see a report where there is none.

### Every question, and where it was settled

| ID    | Assumption                                                                | Settled in                         |
| ----- | ------------------------------------------------------------------------- | ---------------------------------- |
| Q1 †  | Ties go to the alphabetically first partner                               | [T5.3](docs/DECISIONS.md#t5-3)     |
| Q2    | No contacts, or no employees → `No current relationship`                  | [T1.14](docs/DECISIONS.md#t1-14)   |
| Q3    | Drive Capital never appears in the output                                 | [T1.15](docs/DECISIONS.md#t1-15)   |
| Q4    | Names are case-sensitive                                                  | [T1.16](docs/DECISIONS.md#t1-16)   |
| Q5    | Declarations are resolved at end of input; the first valid one stands     | [T1.17](docs/DECISIONS.md#t1-17)   |
| Q6    | Blank lines are skipped silently; every other bad line gets Q7            | [T1.18](docs/DECISIONS.md#t1-18)   |
| Q7    | A malformed line is discarded with a warning; the report still prints     | [T1.19](docs/DECISIONS.md#t1-19)   |
| Q8    | Contacts are resolved after all input; unresolved ones are warned         | [T1.20](docs/DECISIONS.md#t1-20)   |
| Q9 †  | A word is letters only, `[A-Za-z]+`                                       | [T1.21](docs/DECISIONS.md#t1-21)   |
| Q10   | Words split on runs of spaces or tabs; edges and a CRLF `\r` ignored      | [T3.2](docs/DECISIONS.md#t3-2)     |
| Q11   | Command keywords are case-sensitive                                       | [T3.3](docs/DECISIONS.md#t3-3)     |
| Q12 † | One name, one person; companies have their own namespace                  | [T2.7](docs/DECISIONS.md#t2-7)     |
| Q13 † | Every `Contact` line counts; a repeated declaration is warned and dropped | [T2.6](docs/DECISIONS.md#t2-6)     |
| Q14 † | "Sorted alphabetically" is UTF-16 code-unit order                         | [T5.4](docs/DECISIONS.md#t5-4)     |
| Q15   | One optional file argument; a bad invocation exits 1                      | [T6.3](docs/DECISIONS.md#t6-3)     |
| Q16   | A byte-order mark is stripped in the reader, silently                     | [T6.6](docs/DECISIONS.md#t6-6)     |
| Q17   | A closed stdout ends quietly; other I/O fails loudly                      | [T6.9](docs/DECISIONS.md#t6-9)     |
| Q18   | The help text is built from the parser's grammar table                    | [T9.9](docs/DECISIONS.md#t9-9)     |
| Q19   | `--help` and `-h` are the only options, and win wherever they appear      | [T9.10](docs/DECISIONS.md#t9-10)   |
| Q20   | Commands come from a file; a bare run explains how, and exits 1           | [T9.12](docs/DECISIONS.md#t9-12)   |
| Q21   | A tie is one note on stderr, after the report; the line is unchanged      | [T10.6](docs/DECISIONS.md#t10-6)   |
| Q31   | `--partners` and `--employees` answer instead of the report, one per run  | [T10.8](docs/DECISIONS.md#t10-8)   |
| Q32   | A query lists partners strongest first, employees alphabetically          | [T10.9](docs/DECISIONS.md#t10-9)   |
| Q33   | A query naming an undeclared company exits 1, after the input is read     | [T10.10](docs/DECISIONS.md#t10-10) |
| Q40   | A quote holds at most 200 characters; its length is counted in characters | [T12.11](docs/DECISIONS.md#t12-11) |

The web page raised questions of its own, about the page rather than the
input:

| ID  | Decision                                                                         | Settled in                         |
| --- | -------------------------------------------------------------------------------- | ---------------------------------- |
| Q22 | The page's code in `web/`, with its own TypeScript project, bundled by Vite      | [T10.12](docs/DECISIONS.md#t10-12) |
| Q23 | DOM-free logic tested in vitest; the DOM code left to the browser tests          | [T10.13](docs/DECISIONS.md#t10-13) |
| Q24 | Withdrawn: with no server, there is nothing to keep local                        | [T10.16](docs/DECISIONS.md#t10-16) |
| Q25 | Workspace names are letters, digits, `_` and `-`, then `.txt`                    | [T10.17](docs/DECISIONS.md#t10-17) |
| Q26 | Every save raises a version; a save from an older copy is refused                | [T10.18](docs/DECISIONS.md#t10-18) |
| Q27 | The console is an xterm.js pane, showing a run as a terminal would               | [T10.24](docs/DECISIONS.md#t10-24) |
| Q28 | The program's work is one function, which the CLI and the console both call      | [T10.23](docs/DECISIONS.md#t10-23) |
| Q29 | The editor marks what the program would warn about, discarded or pending         | [T10.25](docs/DECISIONS.md#t10-25) |
| Q30 | The workspace is in `localStorage`, one key a file; a refused save keeps the old | [T10.19](docs/DECISIONS.md#t10-19) |
| Q34 | The browser tests use Playwright on Chromium                                     | [T10.27](docs/DECISIONS.md#t10-27) |
| Q35 | The browser tests have their own script, outside `check`                         | [T10.28](docs/DECISIONS.md#t10-28) |
| Q36 | One browser test per thing a person does with the page                           | [T10.29](docs/DECISIONS.md#t10-29) |

† The brief was open to more than one reading here.

---

## Beyond the brief

The base submission, tagged `base-submission`, builds what the brief asks for
and nothing more. Ideas beyond it went into [UPGRADES](docs/UPGRADES.md) as
possible next steps, each with the questions it would have to answer. Since
the tag, most have been built, each with its decisions logged.

Built:

- `--help` and a usage line (U5, [T9.10](docs/DECISIONS.md#t9-10)).
- An explanation of the commands for a run with no file (U6,
  [T9.12](docs/DECISIONS.md#t9-12)).
- A note on stderr when partners tie, with no other ranking (U4,
  [T10.6](docs/DECISIONS.md#t10-6)).
- The `--partners` and `--employees` queries. They answer questions the brief
  says Herbie answers, but does not ask this program to (U10,
  [T10.4](docs/DECISIONS.md#t10-4)).
- The web page described under [In a browser](#in-a-browser), running
  entirely in the browser (U9, [T10.16](docs/DECISIONS.md#t10-16)). Its
  editor checks each line as it is written (U1,
  [T10.2](docs/DECISIONS.md#t10-2)), and tests drive it in a real browser
  (U11, [T10.22](docs/DECISIONS.md#t10-22)).
- A tag on the base (U7) and a coverage report (U8).

Not built: saving back to a file opened from disk. Only Chrome and Edge
support it, and downloads already reach disk in every browser (U12,
[T10.22](docs/DECISIONS.md#t10-22)).

Two ideas were built into the base itself rather than waiting. Leaving either
out meant shipping a program that could be confidently wrong:

- **Stripping a byte-order mark** ([T6.6](docs/DECISIONS.md#t6-6)). Without
  it, one invisible byte in a file a reviewer could easily produce changes
  the reported partner, with three warnings that cannot show the cause.
- **Escaping quoted input** ([T6.11](docs/DECISIONS.md#t6-11)). A warning on
  a Windows file was found overwriting its own text, hiding the problem it
  named.

---

## Where the reasoning lives

- [`docs/BRIEF.md`](docs/BRIEF.md): the interview prompt, verbatim and frozen.
- [`docs/PLAN.md`](docs/PLAN.md): requirements, the task breakdown, and the
  decisions worth reading first.
- [`docs/DECISIONS.md`](docs/DECISIONS.md): every decision in the order it
  was made, with its alternatives and where the idea came from.
- [`docs/UPGRADES.md`](docs/UPGRADES.md): possible next steps beyond the
  brief, and which are built.
- [`CLAUDE.md`](CLAUDE.md): the working rules those documents are kept under.
