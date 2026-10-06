---
name: planton-gen
description: Make a Planton workflow for any everyday goal or how-to — cooking a dish, planning a trip or event, moving house, learning a skill, a fitness or savings goal, a home project. Picks the right workflow type (step-by-step, scheduled, free-form, or flowchart), asks at most a few quick multiple-choice questions, and writes a .planton.json the Planton app imports. Use for "how to…", "help me plan…", or "make me a workflow for…" requests that aren't about a software project. For a software project use planton; for extra-precise procedures use planton-steps; for routines with dates and times use planton-schedule.
---

# Planton general planner

Turn an everyday goal into a Planton workflow that someone can follow on their phone.

Read first: [format.md](../planton/reference/format.md), [writing.md](../planton/reference/writing.md), and
[handoff.md](../planton/reference/handoff.md) in the `planton` skill folder next to this one.

## 1. Understand the goal

Restate the goal in one line. If the request is about building or changing software, switch to the `planton` skill.

## 2. Pick the type

Use the type the user asked for ("as a checklist", "free-form", "with a schedule", "as a flowchart"). Otherwise pick with
this table:

| The goal is… | Type | Then follow |
| --- | --- | --- |
| Done once, in a fixed order | `steps` | Step rules below |
| Repeated at set times or tied to dates | `scheduled` | The `planton-schedule` skill, from its step 1 |
| Many parts with no fixed order | `freeform` | The `planton-free-form` skill's structure rules |
| A process with decisions or loops ("if it fails, try…") | `flowchart` | Flowchart rules below |

If a goal mixes types (a recipe plus meal-prepping it every Sunday), make the main one now and offer the other as a
follow-up plan.

## 3. Ask only what changes the plan

At most one AskUserQuestion round with up to 3 questions, and none if the request already answers them. Good questions
change quantities, order, or scope:

| Goal | Useful questions |
| --- | --- |
| Recipe | How many servings; key equipment (oven, pressure cooker); dietary needs |
| Trip or event | How many days or guests; budget level; must-dos |
| Learning a skill | Current level; time per week; goal (casual, exam, job) |
| Home project | Tools available; renting or owning; budget |

Put a sensible default first with "(Recommended)". If the user says "just make it", skip the questions, use defaults,
and list them in the workflow's notes under an "Assumed" heading.

## 4. Build the workflow

Workflow notes:

- A heading and a 1–2 sentence overview (what this is, total time or cost if relevant).
- "What you need" as a checklist when there are ingredients, tools, or documents — or put that in the first step.
- "Assumed" bullets for any defaults you chose.

Step rules (for `steps`):

- 4–12 steps. The first gathers what's needed; the last finishes the job (serve, check, clean up, store).
- Each step: a paragraph with exactly how to do it (amounts, times, sizes), optional "Watch for:" or "Tip:" bullets,
  and one checkable checklist item per action, each with its own amount (usually 2–10). See "Be specific" in
  writing.md.
- `timerMinutes` on steps that are mostly waiting.
- Use cards inside a step only when a step has several parallel parts (e.g. "Prepare the sides" with three sides).
- When the user wants more precision than this, follow the `planton-steps` skill instead.

Flowchart rules (for `flowchart`):

- 5–15 cards, all flat (no cards inside cards). Give each a `key` and draw the flow with `links`: nothing is connected
  for you. List the main path's links first; the app draws the first link out of a card straight down.
- One `start` card first and an `end` card last. Every other card is a step: a `process` (leave `shape` out) or, where
  it says something, one of the other shapes in format.md's "Flowchart shapes" (a `delay` for waiting, a `document`
  for writing something up, a `subprocess` for a process described elsewhere).
- A `decision` is a short question with exactly two links out, labelled "Yes" and "No". A link back to an earlier card
  makes a loop ("No" → fix it → back to the check).
- Titles under 40 characters, so they fit in a box; details go in the card's notes.

Pick a cover that fits the topic (see format.md).

## 5. Save and deliver

Everyday plans go to `plansDir`. Validate and deliver following [handoff.md](../planton/reference/handoff.md).
