# Herbie Lite

Interview code sample for **Drive Capital** (Software Engineer). Ingests a file
describing Drive's interpersonal network (partners, companies, employees,
contacts) and reports, per company, the partner with the strongest relationship.

## Documents

The three below are imported into every session's context automatically; read
them as already-loaded, not as files to go fetch.

@docs/BRIEF.md
@docs/PLAN.md
@docs/DECISIONS.md

- [`docs/BRIEF.md`](docs/BRIEF.md) — the interview prompt, **verbatim and frozen**. Source of truth. Do not edit.
- [`docs/PLAN.md`](docs/PLAN.md) — requirements, an index of decisions, open questions, and the task plan.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — chronological decision log: what was decided at each stage, and why.
- [`docs/UPGRADES.md`](docs/UPGRADES.md) — _(later)_ smart iterations beyond the brief. Deliberately **not** imported, and **do not build from it until the base submission is complete.**

## Decisions

Record a decision in [`docs/DECISIONS.md`](docs/DECISIONS.md) when it is made,
including one made in conversation that changes no code yet. The entry is part
of the change, not a write-up of it afterwards.

A decision is any choice a reviewer could ask "why that way?" about: one where a
reasonable alternative existed and the choice constrains later code or docs.
Domain semantics, structure, tooling, conventions, and process all count. The
test: **if you can name the alternative you rejected, it is a decision.** Not
decisions: applying a rule already recorded here, and anything the types or a
passing test already force.

Route each one:

- **Decided** — an entry in DECISIONS, in the section of the task in progress,
  with **Decision** · **Context** · **Why** (incl. rejected alternatives) ·
  **Origin**, per that file's Key.
- **Still open** — [`docs/PLAN.md`](docs/PLAN.md) §4, as a numbered question
  with its current default and the subtask that will settle it (T2.2). It
  graduates to DECISIONS once settled.
- **Out of scope** — [`docs/UPGRADES.md`](docs/UPGRADES.md), with a `U<n>` ID.
- **Reversed** — a new entry with **Supersedes:**, and **Superseded by** added
  to the old one. What an old entry says is never edited.

### Citing a decision

Outside DECISIONS itself — in conversation, in a review, in a commit message —
never cite a `T<n>.<m>`, `Q<n>` or `U<n>` bare. Carry enough of the decision
for the sentence to be read on its own: a clause summarising it, or a note of
which part of it you are relying on. I should not have to open a file to
follow what you just said.

- No: "this follows T4.2."
- Yes: "this follows T4.2, which asks for a decision to be logged when it is
  made rather than at commit time."
- Yes, when only part applies: "T3.4's check order — keyword, then word count
  — is why the count is reported first here."

Code comments are the exception: they sit beside the code the entry governs
and a reader there already has the repository open, so a bare ID is fine
(T8a asks for comments that cite IDs, not ones that reproduce them).

## Stack

- **Language:** TypeScript 6 (Node.js 22.13+).
- Tooling and scaffolding decisions are in [`docs/DECISIONS.md`](docs/DECISIONS.md) (T0.1, T0.2, T1.1–T1.9).
- **Verify:** `npm run check` (typecheck, lint, format check, tests) must pass before any commit.

## Commits

- **I make the commits, not the LLM.** Never run `git commit`, `git push`,
  `git merge`, `git rebase`, or `git reset`, even after I've chosen how a
  change should be split up or approved the work itself — deciding what a
  commit contains is not the same as asking for it to be made. Leave the
  changes in the working tree, say what's ready, and offer a subject line and
  body if one would help. `git add` only when I ask for staging.
- Everything below is how I write commits; follow it when drafting a message
  for me.
- Each commit belongs to exactly one PLAN task; never mix tasks. A task may
  take several commits, each prefixed `T<n>:` and each passing
  `npm run check`. Split when the body would need bullets with unrelated
  reasons.
- Include each change's tests and DECISIONS entries in the same commit.
- Subject: `T<n>: <imperative summary>`, at most 72 characters
  (e.g. `T3: Parse lines into commands`). Non-task work: `docs:` or `chore:`.
- Body: a lead of one or two sentences, then bullet points. Bullets say why, not
  what (the diff shows what), and name the DECISIONS IDs added or changed.
  Wrap at 72 columns.
- `npm run check` passes before committing.
- Never add a `Co-Authored-By:` trailer, or any other attribution line, to a
  commit or pull request. How LLMs were used is recorded in the DECISIONS
  Origin lines and the README (T7c), not in git metadata.

## Scope discipline

This is graded on how quality software is built, not on scope. Build exactly what
[`docs/BRIEF.md`](docs/BRIEF.md) asks for first. Anything not in the brief goes to
`docs/UPGRADES.md` and stays there until the base is done, unless a
[`docs/DECISIONS.md`](docs/DECISIONS.md) entry records a deliberate choice to include
it in the base (e.g. T1.10's interactive entry).
