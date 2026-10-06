---
name: planton-reco
description: Recommend a design or approach and record the decision — system architecture, tech stack, database, hosting and deployment, tools, or a better everyday routine. First checks what already exists (Planton plans, README, docs/*.md, ARCHITECTURE.md, ADRs, roadmaps, config files); if there's no design doc, writes one. Compares 2–3 options with trade-offs, lets the user choose, updates the Planton plan with a Decision card, and offers to turn the choice into a plan. Use for "recommend…", "what's the best way to…", "how should I design/structure…". Not for writing the plan itself (planton, planton-gen).
---

# Planton recommendations

Give a grounded recommendation, let the user decide, and write the decision down where the project and the plan can
use it.

Read first: [format.md](../planton/reference/format.md), [writing.md](../planton/reference/writing.md), and
[handoff.md](../planton/reference/handoff.md) in the `planton` skill folder next to this one.

## 1. Look at what exists

**In a code project**, read before recommending anything:

- `planton/*.planton.json` (decisions already made, the current phase)
- `README*`, `docs/**/*.md`, `ARCHITECTURE.md`, ADR folders (`docs/adr`, `docs/decisions`), `ROADMAP.md`, `TICKETS.md`
- Manifests and infrastructure: `package.json`, `pyproject.toml`, `go.mod`, `docker-compose*.yml`, `Dockerfile`,
  CI workflows, `.env.example`

Summarise the current state in 3–5 bullets with file references, including anything already decided that constrains
the answer. If a decision on this topic already exists, say so and ask whether to revisit it before going further.

**For an everyday question** (a routine, a study method, a budgeting approach), skip the file search.

## 2. Fill the gaps

If what matters isn't in the files or the request, ask one AskUserQuestion round (up to 4 questions):

- Scale (users, data volume, or for everyday topics: time available)
- Hard constraints (budget, team skills, hosting, compliance such as data privacy laws, offline use)
- What matters most (ship fast · low cost · reliability · simplicity to maintain)

## 3. Compare options

Present 2–3 real options — not a strawman next to a favourite. For each:

- What it is, in 1–2 sentences
- Why it fits their situation (tie it to their answers and files)
- Costs, risks, and effort (rough, and labelled as estimates)

Then recommend one and say why. Prefer building on what already exists unless there's a strong reason to change: a
rewrite or migration costs time the plan has to pay for. For facts that change often (pricing, limits, versions,
regulations), check a current source if you have web access; otherwise say "check current pricing/limits". Mark
anything inferred as "Assumption to verify".

Ask the user to choose with AskUserQuestion: recommended option first with "(Recommended)", plus "I need more detail".
If they ask for more detail, answer, then ask again.

## 4. Write it down

**Code projects** — record the decision in the repo:

- If a design doc exists (e.g. `ARCHITECTURE.md`, `docs/architecture/*.md`), update only the relevant section and
  summarise what changed.
- If none exists and the topic is the overall system design, create `docs/ARCHITECTURE.md` with: Overview, Components
  (with a Mermaid diagram), Data and storage, Deployment, Security and privacy, Decisions (table linking to ADRs), Open
  questions.
- For a single decision, create `docs/decisions/NNNN-<slug>.md` (next number) with: Status, Context, Decision, Options
  considered (a table of pros and cons), Consequences, Follow-ups.

**Everyday topics** — don't create files unless the user asks; the decision goes into a plan instead (step 6).

## 5. Update the Planton plan

If the project has a Planton plan:

- Add a done card "Decision: <topic>" in the phase it affects, with a heading "Decision", a paragraph with the choice
  and reason, a bullet "Considered: …", a bullet linking the doc ("See docs/decisions/0003-hosting.md"), and
  "Assumption to verify: …" bullets.
- Add tasks the decision creates (e.g. "Set up nightly backups") to the right phase, and "Revisit: …" cards for open
  questions.
- Keep existing card titles unchanged, then validate and deliver following [handoff.md](../planton/reference/handoff.md).

## 6. Offer the next step

Offer to turn the choice into action: a project plan (`planton`), a precise procedure (`planton-steps`), a routine
(`planton-schedule`), or a general plan (`planton-gen`).
