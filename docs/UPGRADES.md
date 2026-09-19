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

## U2 — Strip a byte-order mark

Remove a U+FEFF byte-order mark from the start of line 1, so a file saved by
Windows Notepad or as Excel's UTF-8 CSV doesn't lose its first line. The base
rejects that line with the Q7 warning ([PLAN Q16](./PLAN.md#open)).

- **Origin:** LLM-suggested, deferred here by me. Found while discussing how
  a warning would show a non-breaking space (Q10); Node's `readFileSync` and
  `readline` both keep the BOM.

Open questions:

- Strip it in the cli's reader (a property of the file) or in the parser (so
  `parseLine` handles any source)? The reader is the more accurate place
  for a single file, but a BOM can also arrive mid-stream (next question).
- Strip only at the start of line 1, or anywhere at the start of a line (for
  example after files are concatenated with `cat a.txt b.txt`)?
- Strip silently, or note it on stderr?

<a id="u3"></a>

## U3 — Show invisible characters in quoted lines

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
- **Origin:** LLM-suggested, deferred here by me.

Open questions:

- Show tabs as `\t`? They are valid separators (Q10), but invisible on
  screen.
- Escape all non-ASCII instead? Simpler to state and never touches a valid
  line, but shows `Zoë` as `Zo\u00eb`.
- Invalid UTF-8 reaches the program as U+FFFD, so the warning can't show the
  original bytes; the README should say so.
