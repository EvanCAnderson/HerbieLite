# Herbie Lite — Upgrades

Ideas beyond the [brief](./BRIEF.md). Not built until the base submission is
complete.

<a id="u1"></a>

## U1 — Guided input-file builder

An interactive mode that creates a new input file, checking each line as it is
typed and saving only lines that pass validation. Extends T1.10's interactive
entry, which only reads typed commands and prints a report.

- **Origin:** Mine (raised during the T1 review; LLM recommended deferring it
  here rather than building it in the base).

Planned as T9k, a panel of the web UI ([U9](#u9)) rather than a CLI mode,
which answers the third open question below; see
[DECISIONS T9.8](./DECISIONS.md#t9-8). The other two are PLAN §4's Q30 and
Q29, with their defaults there.

- ~~Where the file is saved, and what happens on a clash or a failed save~~ —
  Q30.
- ~~Accept lines whose references can't be checked yet?~~ — Q29.
- ~~A separate mode or command from the analyzer?~~ — Neither: a UI panel
  (T9.8).

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

## U4 — A tie-break that means something

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

Planned as T9e. Its open question — which signal, if any, ranks first, and
where a ranking would live — is PLAN §4's Q21, whose default is to surface the
tie and keep the ranking as it is.

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

## U9 — A local web UI

A web page served on this machine for working with input files: list them,
read them, edit and delete the ones in a workspace with the command reference
beside the editor, and run the report on any of them in an embedded terminal
pane. It is where the file
builder ([U1](#u1)) lives once built.

- **Terminal:** the page's embedded pane is a Herbie console that runs
  herbie-lite and nothing else, not a shell; the shell limit belongs to the
  UI alone ([DECISIONS T9.5](./DECISIONS.md#t9-5)). It runs files and shows
  their output, and takes no typed commands
  ([T9.12](./DECISIONS.md#t9-12)).
- **Files:** `examples/` listed read-only, since the tests assert every one;
  a git-ignored `inputs/` workspace for everything editable
  ([T9.6](./DECISIONS.md#t9-6)).
- **Stack:** plain TypeScript bundled by Vite, served by `node:http`
  ([T9.7](./DECISIONS.md#t9-7)).
- **Order:** built after U5, U6 and U4, and before U1
  ([T9.4](./DECISIONS.md#t9-4)).
- **Origin:** Mine (a local page with an embedded terminal, file management,
  and the builder, placed before U1). Limiting the terminal to Herbie, the
  workspace split, and the stack: LLM-suggested, accepted.

Planned as T9f–T9j, with T9l for the README. Its open questions are PLAN §4's
Q22–Q28: layout and packaging, testing, keeping the server local, workspace
file names, two edits of one file, the console's transport, and how the
console runs the analyzer.
