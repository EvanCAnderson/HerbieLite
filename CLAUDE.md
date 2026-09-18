# Herbie Lite

Interview code sample for **Drive Capital** (Software Engineer). Ingests a file
describing Drive's interpersonal network (partners, companies, employees,
contacts) and reports, per company, the partner with the strongest relationship.

## Documents

- [`docs/BRIEF.md`](docs/BRIEF.md) — the interview prompt, **verbatim and frozen**. Source of truth. Do not edit.
- [`docs/PLAN.md`](docs/PLAN.md) — requirements, an index of decisions, open questions, and the task plan.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — chronological decision log: what was decided at each stage, and why.
- [`docs/UPGRADES.md`](docs/UPGRADES.md) — _(later)_ smart iterations beyond the brief. **Do not build from this until the base submission is complete.**

## Stack

- **Language:** TypeScript 6 (Node.js 22.13+).
- Tooling and scaffolding decisions are in [`docs/DECISIONS.md`](docs/DECISIONS.md) (T0.1, T0.2, T1.1–T1.9).
- **Verify:** `npm run check` (typecheck, lint, format check, tests) must pass before any commit.

## Commits

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
- LLM-assisted commits end with a `Co-Authored-By:` line.

## Scope discipline

This is graded on how quality software is built, not on scope. Build exactly what
[`docs/BRIEF.md`](docs/BRIEF.md) asks for first. Anything not in the brief goes to
`docs/UPGRADES.md` and stays there until the base is done, unless a
[`docs/DECISIONS.md`](docs/DECISIONS.md) entry records a deliberate choice to include
it in the base (e.g. D1's interactive entry).
