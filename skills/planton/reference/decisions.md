# Deciding something for a project

When a project's plan needs a choice made (an architecture, the stack, the database, sign-in, hosting, a tool), give a
grounded recommendation, let the user decide, and record the decision where the plan and the project can use it.

## 1. Look at what exists

Read before recommending anything:

- `planton/*.planton.json`: decisions already made, the current phase.
- `README*`, `docs/**/*.md`, `ARCHITECTURE.md`, ADR folders (`docs/adr`, `docs/decisions`), `ROADMAP.md`, `TICKETS.md`.
- Manifests and infrastructure: `package.json`, `pyproject.toml`, `go.mod`, `docker-compose*.yml`, `Dockerfile`, CI
  workflows, and only the variable names in `.env.example`. Never open a real env file.

Summarise the current state in 3–5 bullets with file references, including anything already decided that constrains
the answer. If a decision on this topic already exists, say so and ask whether to revisit it before going further.

## 2. Fill the gaps

If what matters isn't in the files or the request, ask one AskUserQuestion round (up to 4 questions): scale (users,
data volume), hard constraints (budget, team skills, hosting, compliance such as data privacy laws, offline use), and
what matters most (ship fast · low cost · reliability · simplicity to maintain).

## 3. Compare options

Present 2–3 real options, not a strawman next to a favourite. For each: what it is (1–2 sentences), why it fits their
situation (tie it to their answers and files), and its costs, risks and effort (rough, and labelled as estimates).

Then recommend one and say why. Prefer building on what already exists unless there's a strong reason to change: a
rewrite or migration costs time the plan has to pay for. For facts that change often (pricing, limits, versions,
regulations), check a current source if you have web access; otherwise say "check current pricing/limits". Mark
anything inferred as "Assumption to verify".

Ask the user to choose with AskUserQuestion: recommended option first with "(Recommended)", plus "I need more detail".
If they ask for more detail, answer, then ask again.

## 4. Record it

- **In the plan**: a done card "Decision: <topic>" in the phase it affects, with a heading "Decision", a paragraph with
  the choice and the reason in the user's words, a bullet "Considered: …", and "Assumption to verify: …" bullets. Add
  the tasks the decision creates ("Set up nightly backups") to the right phase, and "Revisit: …" cards for what's still
  open. Keep existing card titles unchanged.
- **In the project's docs**, only where the project already keeps them: a design doc (`ARCHITECTURE.md`,
  `docs/architecture/`) gets the relevant section updated; an ADR folder gets a new record in its own style and
  numbering, and the Decision card links to it ("See docs/decisions/0003-hosting.md"). Don't start a new docs folder or
  design doc unless the user asks for one.

Then validate and deliver the plan following [handoff.md](handoff.md).
