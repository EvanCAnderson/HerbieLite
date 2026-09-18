# Herbie Lite — Upgrades

Ideas beyond the [brief](./BRIEF.md). Not built until the base submission is
complete.

<a id="u1"></a>

## U1 — Guided input-file builder

An interactive mode that creates a new input file, checking each line as it is
typed and saving only lines that pass validation. Extends D1's interactive entry,
which only reads typed commands and prints a report.

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
