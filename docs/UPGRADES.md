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

Open questions:

- Where the file is saved, and what happens if it already exists (overwrite,
  append, or refuse), or if saving fails partway.
- Live validation can check syntax (Q7, Q9) immediately, but not references: a
  contact for a partner declared later is valid under Q8. Accept lines that
  can't be fully checked yet, or require names to be declared first in this
  mode?
- A separate mode or command from the analyzer, with its own tests and README
  section?

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

Open questions:

- Which signal ranks first, and whether the chain ends in the alphabetical
  rule as a last resort (it has to end somewhere deterministic).
- Whether any of this belongs in the report layer or in a separate ranking
  module the report calls, once more than one rule exists.

<a id="u5"></a>

## U5 — `--help` and a usage line

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

Open questions:

- Where the usage text lives so it cannot drift from the README's run forms
  (T7a) — generated from one source, or duplicated and checked by a test?
- Whether `-` should mean STDIN, which is the conventional partner to a file
  argument but adds a second non-path argument to handle.
- Whether an unknown flag (`--verbose`) should be told apart from a file
  named `--verbose`, which the letters-only rule (Q9) has no opinion about
  since it governs input lines, not arguments.

<a id="u6"></a>

## U6 — An opening explanation for typed input

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

Open questions:

- Where the text lives so it cannot drift from the README's run forms (T7a)
  or from `COMMAND_SYNTAX`, which already holds the grammar as data — the
  command shapes can be generated from it, the prose cannot.
- stderr or stdout? stderr keeps stdout reserved for the report, so
  `node dist/bin.js > out.txt` still produces a clean file; but a person
  reading a help text on stderr is unusual, and U5's `--help` conventionally
  goes to stdout.
- Whether it reappears after the report, or on an empty run, when the user
  typed nothing at all.
