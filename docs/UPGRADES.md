# Herbie Lite — Upgrades

Potential next steps beyond the [brief](./BRIEF.md), each with the questions
it would have to answer. None was built until the base submission was
complete; since then they are being built, and each entry says whether it is.

<a id="u1"></a>

## U1 — Guided input-file builder — **built as the in-browser file editor**

An interactive mode that creates a new input file, checking each line as it is
typed and saving only lines that pass validation. Extends T1.10's interactive
entry, which only reads typed commands and prints a report.

- **Origin:** Mine (raised during the T1 review; LLM recommended deferring it
  here rather than building it in the base).

Built in T10g ([DECISIONS T10.25](./DECISIONS.md#t10-25),
[T10.26](./DECISIONS.md#t10-26)): the web UI's file editor ([U9](#u9)) is the builder. Since
commands are written by editing files ([T9.12](./DECISIONS.md#t9-12)), a
separate builder would be a second way to write one; the editor gives its
convenience to any workspace file instead, with the command reference beside
the text and each line checked as it is edited. See
[DECISIONS T10.2](./DECISIONS.md#t10-2).

- ~~Where the file is saved, and what happens on a clash or a failed save~~ —
  Q30, settled with the workspace in T10d.
- ~~Accept lines whose references can't be checked yet?~~ — Yes: they are
  marked pending, and the file can be saved (Q29, T10.25).
- ~~A separate mode or command from the analyzer?~~ — Neither: the UI's
  editor (T9.8, T10.2).

<a id="u2"></a>

## U2 — Strip a byte-order mark — **built in the base**

Remove a U+FEFF byte-order mark from the start of line 1, so a file saved by
Windows Notepad or as Excel's UTF-8 CSV doesn't lose its first line.

Built in T6c rather than deferred; see
[DECISIONS T6.6](./DECISIONS.md#t6-6) for why, and the answers this entry's
open questions got:

- **Reader or parser?** The reader (`lines.ts`), which is where a file's
  encoding artifacts belong; the parser stays free of I/O concerns.
- **Line 1 only, or any line?** Only at the very start of the stream. A
  U+FEFF at the start of a later line — as `cat a.txt b.txt` produces — is
  left alone and rejected by Q9, because there it is data, not an encoder's
  mark.
- **Silently, or noted on stderr?** Silently. There is nothing for the user
  to fix once it is handled, and a note would be a stderr line that is not a
  discarded line.

- **Origin:** LLM-suggested, deferred here by me. Found while discussing how
  a warning would show a non-breaking space (Q10); Node's `readFileSync` and
  `readline` both keep the BOM. The LLM then recommended keeping it out of
  the base; I chose to build it (T6.6).

<a id="u3"></a>

## U3 — Show invisible characters in quoted lines — **built in the base**

Warnings quote the offending line, so a line broken by an invisible character
(a non-breaking space, zero-width space, or BOM) looks valid in the warning.
Escape such characters when quoting, e.g. `Partner\u00a0Chris`. Only the
cli's warning wording changes; the parser keeps the raw text, and the report
is unaffected because every name in it is ASCII letters (Q9).

- **Rule (proposed):** escape control, format, and separator characters
  (`\p{C}`, `\p{Z}`) other than a plain space, plus `\` itself so a literal
  `\u00a0` in the input can't be mistaken for an escape. Escape by code
  point (`\u{1f600}`), not by UTF-16 unit. Visible non-ASCII such as `Zoë`
  is left as typed.
- **Side benefit:** escaping control characters stops input from sending
  terminal escape codes to stderr, and shows a stray `\r` that the reader
  leaves in a line (T6c).
- **Origin:** LLM-suggested, deferred here by me. Built in the T6 review
  instead, once a mid-message quote was found to garble its own warning on a
  CRLF file; see [DECISIONS T6.11](./DECISIONS.md#t6-11) for why, and the
  answers this entry's open questions got:

- **Show tabs as `\t`?** Yes. A tab is a valid separator (Q10), so it only
  ever reaches a warning on a line that is already bad, where showing it
  exactly is what helps. `\t` and `\r` keep their familiar short forms;
  everything else is `\u` and its code point.
- **Escape all non-ASCII instead?** No. `Zoë` stays as typed; only control,
  format and separator characters are escaped.
- **Invalid UTF-8** still reaches the program as U+FFFD, which is printable
  and so survives escaping unchanged. The warning cannot show the original
  bytes, and the README says so (T7d).

<a id="u4"></a>

## U4 — A tie-break that means something — **built as a note**

Equal strengths are settled alphabetically ([Q1](./DECISIONS.md#q1)), which is
deterministic but arbitrary in business terms: `Abdi` beats `Zoe` for no
relationship reason, and the output gives no sign that a tie occurred. A
system that reflects the relationship would rank the tied partners on
something real.

- **Origin:** Mine (raised when Q1 was settled in T5; the alphabetical rule was
  kept for the base because the brief's output format names exactly one partner
  and says nothing about ties).

Directions to consider:

- Weight contact types rather than counting each as 1 — a coffee plausibly
  says more than an email. Departs from the brief's "total amount of
  Contacts", so it would need to be an option rather than the default.
- Recency: the most recent contact, or contacts decayed over time. The input
  has no dates, so this needs a richer input format.
- Breadth: the partner who knows more distinct employees of the company, or
  who has reached more senior ones, over the partner with repeat contacts to
  one person.
- Surface the tie instead of hiding it — mark the line, or report the tied
  partners on stderr while the line stays in the brief's format.

Built in T10a as the last direction alone: the tie is noted and the ranking
stays alphabetical ([DECISIONS T10.3](./DECISIONS.md#t10-3)). The other
three directions are not planned. Q21 was settled as one note on stderr per
tie, printed after the report
([T10.6](./DECISIONS.md#t10-6)):

```
herbie-lite: Zebra is a tie between Al and Bo (1 contact each); Al is shown because it comes first alphabetically
```

<a id="u5"></a>

## U5 — `--help` and a usage line — **built**

The base takes one optional file path and nothing else: a bad invocation
prints what was wrong and exits 1, with no usage text and no `--help`
([Q15](./DECISIONS.md#q15)). A `--help` / `-h` flag would print the run forms
to stdout and exit 0, and the invocation error could end with a one-line
`usage: herbie-lite [file]`.

Neighbour: [U6](#u6) is the same explanation offered to someone who typed
nothing at all, rather than to someone who asked for it.

- **Origin:** Mine (raised when Q15 was settled in T6; the LLM offered both
  as variants of the default and I chose to defer them rather than build
  them).

Built in T9c; see [DECISIONS T9.9](./DECISIONS.md#t9-9) and
[T9.10](./DECISIONS.md#t9-10) for why, and the answers this entry's open
questions got:

- **Where does the usage text live?** In `help.ts`, which builds each
  command's shape from `COMMAND_SYNTAX`; a test holds the README to the usage
  string (Q18).
- **Should `-` mean STDIN?** No; no argument already means STDIN (Q19).
- **An unknown flag, or a file of that name?** An unknown flag. A file whose
  name starts with `-` is reached as `./-name` (Q19).

<a id="u6"></a>

## U6 — An opening explanation for typed input — **built, reshaped**

The base prints nothing when commands are typed at a terminal: no hint, no
banner, and no terminal check at all ([T6.13](./DECISIONS.md#t6-13)). A bare
`node dist/bin.js` therefore looks frozen until Ctrl+D. What interactive entry
actually wants is a short opening explanation on stderr — the four commands
with their argument shapes, the three contact types, and how to finish — so a
first-time user can type a working file without opening the README.

Neighbours: [U5](#u5) covers `--help` and a usage line, which answers the same
question from an explicit flag rather than from an empty invocation, and
[U1](#u1) is the guided builder that would replace typing into a pipe
altogether. Whatever is built here should share one source of text with both.

- **Origin:** Mine (the base shipped a one-line hint; I removed it in the T6
  review rather than ship the stub, and deferred the fuller version here).

Built in T9d, and reshaped in the same subtask: once the explanation was
seen, typing commands into the program stopped being a way to write them at
all. Commands now come from a file, named or piped, and never typed. The
explanation stays, as what a run at a terminal with no file prints: how to
give a file, and the commands to write in it. See
[DECISIONS T9.12](./DECISIONS.md#t9-12), which also answers this entry's
open questions:

- **Where does the text live?** In `help.ts`, sharing its command section
  with `--help` (Q18).
- **stderr or stdout?** stdout, where help goes, with exit 1 because no
  report was produced (Q20).
- **When does it print?** Only when no file is named and STDIN is a
  terminal, and then instead of reading anything (Q20).

<a id="u7"></a>

## U7 — Tag the base submission before any upgrade — **built**

Before work starts on any upgrade in this file, tag the commit that completes
the base submission, so a reviewer can check out exactly what answers the
brief and diff the upgrades against it. The email handing in the sample
promises this ("the current version will stay on its own tagged commit"), so
the tag has to exist before that email is sent.

- **Origin:** Mine (raised while drafting the hand-in email).

Built in T9a; see [DECISIONS T9.2](./DECISIONS.md#t9-2) for why, and the
answers this entry's open questions got:

- **Which commit?** `c8fc833`, the `T8:` commit that completes the brief.
- **Name and kind?** `base-submission`, annotated, with a message saying what
  it marks.
- **Does the README name it?** Yes, in one sentence near the top.
- **Pushing it:** left to me, with `git push origin base-submission`; until
  then it exists only on this machine.

<a id="u8"></a>

## U8 — Measure test coverage — **built**

Nothing measures how much of `src/` the tests reach; the claim that they cover
the core logic rests on reading them. Add `@vitest/coverage-v8`, matched to
the installed vitest, and a script that reports coverage.

- **Origin:** LLM-suggested, deferred here rather than built (raised in an
  audit of the codebase, which could not produce a figure without the
  dependency).

Built in T9b; see [DECISIONS T9.3](./DECISIONS.md#t9-3) for why, and the
answers this entry's open questions got:

- **Report or gate?** A report, `npm run coverage`; `npm run check` is
  unchanged. The measurement found no untested path, only code the types make
  unreachable and `bin.ts` running in a child process, so a threshold would
  reward tests aimed at the number.
- **Measure first?** Yes: 96.75% of lines and 93.66% of branches, before
  anything was decided.
- **Lines or branches?** Both, in the same table.

<a id="u9"></a>

## U9 — A web UI — **built**

A web page for working with input files: list them, read them, edit and
delete the ones in a workspace with the command reference beside the editor,
and run the report on any of them in an embedded terminal pane. Its editor is
the file builder ([U1](#u1)). It runs in the browser alone, with no server
([DECISIONS T10.16](./DECISIONS.md#t10-16)).

- **Terminal:** the page's embedded pane is a Herbie console that runs
  herbie-lite and nothing else, not a shell
  ([DECISIONS T9.5](./DECISIONS.md#t9-5)). It runs files and shows their
  output, and takes no typed commands ([T9.12](./DECISIONS.md#t9-12)).
- **Files:** the examples bundled into the page, read-only, since the tests
  assert every one; a workspace in the browser's storage for everything
  editable; files opened from disk and saved as downloads
  ([T9.6](./DECISIONS.md#t9-6), [T10.16](./DECISIONS.md#t10-16)).
- **Stack:** plain TypeScript bundled by Vite
  ([T9.7](./DECISIONS.md#t9-7)), served locally by Vite's preview server.
- **Origin:** Mine (a local page with an embedded terminal, file management,
  and the builder, placed before U1; later, running it without a server).
  Limiting the terminal to Herbie, the workspace split, and the stack:
  LLM-suggested, accepted.

Built in task T10 ([T10.1](./DECISIONS.md#t10-1)): the scaffold (T10c), the
workspace (T10d), the files panel (T10e), the console (T10f), U1's editor
(T10g), browser tests ([U11](#u11), T10h), and the README (T10i). Its
questions were PLAN §4's Q22, Q23 and Q25–Q30: where the code lives, how it
is tested, workspace file names, a file open in two tabs, how the console
shows a run, how the page runs the analyzer, and saving.

<a id="u10"></a>

## U10 — Queries about one company — **built**

The report answers one question per company: who knows it best. The brief's
first example question, "Who do we know who works at ACME Co?", needs more
than that line. Two queries, asked with command-line options alongside the
input file ([DECISIONS T10.4](./DECISIONS.md#t10-4)):

- **Partners:** every partner who has contacted the company, each with their
  strength to it.
- **Employees:** every employee of the company, each with the partners who
  have contacted them and how often.

For example, on the brief's input:

```
$ node dist/bin.js examples/input.txt --partners Globex
Globex: Chris (2), Molly (1)

$ node dist/bin.js examples/input.txt --employees Globex
Jamie: No contacts
Laurie: Chris (2), Molly (1)
```

- **Origin:** The queries: Mine. Command-line options: LLM-suggested,
  accepted.

Built in T10b; see [DECISIONS T10.8](./DECISIONS.md#t10-8),
[T10.9](./DECISIONS.md#t10-9) and [T10.10](./DECISIONS.md#t10-10) for the
answers its open questions got:

- **Options and the report?** Each option takes the next argument as the
  company, before or after the file; the answer replaces the report, one
  query per run, with warnings but no tie notes (Q31).
- **What each prints?** As above: partners strongest first, employees
  alphabetically, in the report's shape (Q32).
- **A company never declared?** An error on stderr, exit 1, checked once the
  input is read (Q33).

<a id="u11"></a>

## U11 — End-to-end tests of the web page in a browser — **built**

The page's logic is kept in modules tested without a browser; the code that
touches the DOM is not tested ([DECISIONS T10.13](./DECISIONS.md#t10-13)).
A browser test would load the built page and use it as a person does.

- **Origin:** LLM-suggested, deferred here as Q23's default.

Built in T10h, after the editor and before the README
([DECISIONS T10.22](./DECISIONS.md#t10-22)): Playwright on Chromium
([T10.27](./DECISIONS.md#t10-27)), run by `npm run test:e2e` rather than in
`npm run check` ([T10.28](./DECISIONS.md#t10-28)), with one test per thing a
person does with the page ([T10.29](./DECISIONS.md#t10-29)).

<a id="u12"></a>

## U12 — Save back to the file that was opened, in Chrome and Edge — **deferred**

The web UI saves files to disk as downloads, so editing a file from disk in
the page produces a new copy in the downloads folder rather than changing the
original ([DECISIONS T10.16](./DECISIONS.md#t10-16)). Chrome and Edge's File
System Access API can write back to the file that was opened, after a
permission prompt.

- **Origin:** LLM-suggested, deferred here when the UI became browser-only.

Open questions:

- **Only where supported?** Firefox and Safari do not have the API, so the
  page would offer write-back in some browsers and downloads in all.
- **A folder, or a file?** The same API can open a whole folder, which would
  bring back something like the `inputs/` workspace on disk.
- **How is a lost permission shown?** The browser can revoke it between
  visits.

Not part of T10 ([DECISIONS T10.22](./DECISIONS.md#t10-22)): it works in two
of the four main browsers, downloads already get a file to disk, and the
README names it as not built.
