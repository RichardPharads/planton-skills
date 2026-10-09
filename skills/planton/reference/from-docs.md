# A project plan from existing docs

When the project already has written plans (a ROADMAP, TICKETS, TODO lists, specs, PRDs, milestone notes, GitHub
issues), respect that work: convert it faithfully, fill only the real gaps, and point back to the docs for technical
detail.

## 1. Find the sources

Look for `ROADMAP*`, `TICKETS*`, `TODO*`, `CHANGELOG*`, `docs/**/*.md` (specs, PRDs, milestones, plans), and open or
recently closed GitHub issues and milestones (`gh issue list --state all --limit 200` and `gh api repos/{owner}/{repo}/milestones`
when `gh` is available and the repo has a GitHub remote). If a Planton plan already exists, update it instead ("Continue
a plan" in the `planton` skill).

List what you found. If there are several candidate sources, ask which to use with AskUserQuestion (`multiSelect`).

## 2. Extract, don't invent

From the chosen sources, collect: milestones or phases, tasks, their status (`[x]`, "Done", closed issues, merged PRs),
IDs (e.g. `PMS-C7`, `#38`), owners, estimates, dependencies, acceptance criteria, and decisions already made.

## 3. Map to a plan

The workflow is `"type": "steps"`.

- **Phases** = milestones, in the order the docs give (or dependency order when the docs don't). 5–10 phases; group
  small milestones.
- **Tasks** = tickets or roadmap items. Start the note with the ID and a one-line summary ("PMS-C7: integration tests
  skip in CI because no database is provisioned."). Keep titles readable without the ID.
- **Checklists** = acceptance criteria when the docs have them; otherwise 2–3 checkable outcomes taken from the ticket
  text.
- **Status**: finished items get `"status": "done"` and ticked checklists. Partly done work stays pending, with the
  finished parts ticked.
- **Decisions** recorded in the docs become done "Decision: …" cards in the phase they affect, citing the doc.
- **Root notes**: what the project is, where the detail lives ("docs/ROADMAP.md and TICKETS.md hold the technical
  detail; this plan holds the order"), and how to use the plan.
- If the docs lack testing or launch work that the project clearly needs, you may add those phases, but set their
  `description` to start with "Suggested —" so the user can tell them apart.

## 4. Ask about the gaps

One AskUserQuestion round (up to 4 questions) for what the docs don't settle and that changes the plan: the order of
milestones when it's unclear, a target date, what's out of scope, or who owns which track. Anything still unknown
becomes a "Revisit: …" card.

## 5. Save and deliver

Save to `planton/<slug>.planton.json` in the project, validate, and deliver following [handoff.md](handoff.md). Finish
with counts: phases, tasks, how many were already done, and the gaps turned into Revisit cards.
