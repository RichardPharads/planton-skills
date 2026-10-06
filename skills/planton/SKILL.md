---
name: planton
description: Plan a software project as a step-by-step Planton workflow. Interviews the developer in short rounds of multiple-choice questions (who it's for, platform, market, constraints, MVP, tech, risks), records each answer as a Decision card, and writes planton/<name>.planton.json for the Planton app. Also extends or changes an existing project plan. Use when the user asks to plan or scope a software project, decide what to build, or doesn't know its long-term direction. For everyday plans use planton-gen; for "what's next?" use planton-next; to convert existing roadmaps or tickets use planton-from-docs; for a design or tech recommendation use planton-reco.
---

# Planton project planner

You help a developer who can build software but hasn't decided what to build, for whom, or where it's going. Interview
them in short rounds, turn every answer into a recorded decision, and build a step-by-step workflow they can open in
the Planton app and that you both follow while building.

Read these before writing a plan:

- [reference/format.md](reference/format.md): the file format.
- [reference/writing.md](reference/writing.md): how to write cards.
- [reference/handoff.md](reference/handoff.md): where to save, how to validate, how to deliver.

## Pick the mode

Look for `planton/*.planton.json` in the project first.

- **No plan yet** → [Plan a new project](#plan-a-new-project). If the project already has a ROADMAP, TICKETS, spec,
  or issue list, suggest the `planton-from-docs` skill instead, since it keeps that work.
- **A plan exists and the user wants to change or extend it** → [Continue a plan](#continue-a-plan).
- **A plan exists and the user asks what to do next or reports progress** → follow the `planton-next` skill.

## Plan a new project

### 1. Read before asking

Scan the repo so you don't ask what you can already see: README, package.json / pubspec.yaml / requirements.txt /
go.mod, app config (app.json, AndroidManifest, next.config), and any docs. Note the platform, stack, and how far along
it is. Tell the user in one or two sentences what you found. An empty folder is fine — then everything is open.

### 2. Interview in rounds

Use the AskUserQuestion tool. Each round is one call with 1–4 questions, each with 2–4 choices; the user can always
type their own answer. Skip any question the repo or earlier answers already settle, and adapt later choices to earlier
answers (don't offer App Store pricing for an internal tool).

| Round | Phase it creates | Ask about |
| --- | --- | --- |
| 1 Vision | Discovery | Who uses it; the main problem; what success looks like in 6 months |
| 2 Market & platform | Discovery | iOS/Android, web, desktop, or several; local, global, or niche/B2B; main alternative people use today |
| 3 Constraints | MVP scope | Team (solo, small team); time available; budget; experience with the likely stack |
| 4 MVP | MVP scope | Must-have features (multiSelect); how it makes money (free, subscription, one-time, ads, decide later) |
| 5 Tech | Architecture | Stack, data storage, sign-in, hosting — recommend based on rounds 1–4 and the repo |
| 6 Risks & first milestone | Build, Launch | Biggest risk; what the first shippable milestone is; launch channel |

Rules for choices:

- Put your recommended choice first and end its label with "(Recommended)" when you have a real reason, and say the
  reason in its description.
- Offer "Not sure yet" where a beginner might genuinely not know (market, money, long-term platform). Never force a
  decision the user can't make yet.
- Keep descriptions to one line: the trade-off, not a lecture.
- If a tech question needs a deeper comparison (e.g. choosing an architecture), follow the `planton-reco` skill for
  that question, then continue the interview.

After each round, reply with a 2–3 line summary of what was decided, then save and validate the file (handoff steps
1–3) so progress is never lost if the session ends. Stop the interview early if the user says they have enough.

### 3. Turn answers into the plan

Build a `steps` workflow. Phases are its top-level cards, in order; tasks are cards inside each phase.

- **5–9 phases**, typically: Discovery → MVP scope → Architecture → Build milestone 1 → Build milestone 2 → Test →
  Launch → Grow. Merge or drop phases that don't fit the project.
- **3–6 tasks per phase.** Each task has a one-sentence note saying what and why, then a **checklist of 2–5 concrete,
  checkable items** (its definition of done). Put a rough estimate in the phase's `description`, e.g. "About 3 days",
  and base it on the team's real available time from round 3.
- **Decision cards.** Each answered question becomes a card in the phase it belongs to, marked `"status": "done"`,
  titled "Decision: <topic>", with notes:
  - heading "Decision", paragraph with the choice and the reason in the user's words;
  - bullet "Considered: <other options>";
  - bullet "Assumption to verify: …" for anything you inferred rather than the user stated (market size, pricing,
    competitors). Never present guesses about markets, prices, or laws as facts.
- **"Not sure yet" → Revisit card.** Create a pending card titled "Revisit: <topic>" in the phase where the decision
  starts to matter (e.g. monetisation in Launch), with a note on what to learn first and a checklist item "Decide
  <topic>". Mention it in your round summary.
- Tasks in Build phases should be small enough to finish in a session or two, and named so you can act on them
  ("Add sign-in with Google", not "Auth").
- Root notes: a short "The idea" paragraph, a "Decisions so far" bullet list, and a "How to use this plan" paragraph.
- Suggested cover: `midnight` or `lagoon`.

### 4. Save and deliver

Save to `planton/<slug>.planton.json` in the project, validate, and deliver following
[reference/handoff.md](reference/handoff.md). Then name the first task and offer to start it.

## Continue a plan

Read the whole file first. Ask only about what's new or changed, in the same round format. When updating:

- Never delete or rewrite cards that are `"status": "done"` or have checked checklist items — add new cards instead.
- Keep card titles stable: the app matches cards by title to keep progress when the plan is re-imported. Rename only
  when the meaning truly changed, and say so.
- Keep the user's own edits and wording.
- Replace a "Revisit" card with a "Decision" card once it's decided.
- Summarise what you changed (added, moved, removed), then validate and deliver following
  [reference/handoff.md](reference/handoff.md).
