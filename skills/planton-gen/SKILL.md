---
name: planton-gen
description: Make a Planton workflow for any everyday goal or how-to — a recipe, a repair or setup, paperwork, a trip or event, moving house, learning a skill, a daily routine, habit or training program with real dates and times, a packing list or brainstorm, or a process with decisions. Picks the right type (step-by-step, scheduled, free-form or flowchart), asks a few quick multiple-choice questions, and writes a .planton.json the Planton app imports. Also tidies an existing plan whose flowchart looks long or cluttered. Use for "how to…", "help me plan…", or "make me a routine, checklist or workflow for…" requests that aren't about a software project; for a software project use planton.
---

# Planton everyday planner

Turn an everyday goal into a Planton workflow that someone can follow on their phone.

Read first: [format.md](../planton/reference/format.md), [writing.md](../planton/reference/writing.md), and
[handoff.md](../planton/reference/handoff.md) in the `planton` skill folder next to this one.

## 1. Understand the goal

Restate the goal in one line. If it's about building or changing software, switch to the `planton` skill. If the user
wants an existing plan tidied, compacted or cleaned up, follow [tidy.md](../planton/reference/tidy.md) instead.

## 2. Pick the type

Use the type the user asked for ("as a checklist", "free-form", "with a schedule", "as a flowchart"). Otherwise pick with
this table, then read that type's rules before going on:

| The goal is… | Type | Rules |
| --- | --- | --- |
| Done once, in a fixed order: a recipe, a repair or setup, paperwork, a learning path | `steps` | [reference/steps.md](reference/steps.md) |
| Repeated at set times or tied to dates: a routine, habit, training program, medication, appointments | `scheduled` | [reference/schedule.md](reference/schedule.md) |
| Many parts with no fixed order: trip ideas, packing, shopping, research, a brainstorm | `freeform` | [reference/free-form.md](reference/free-form.md) |
| A process with decisions or loops ("if it fails, try…") | `flowchart` | [reference/flowchart.md](reference/flowchart.md) |

If a goal mixes types (a recipe plus meal-prepping it every Sunday), make the main one now and offer the other as a
follow-up plan.

## 3. Ask only what changes the plan

At most one AskUserQuestion round with up to 3 questions (a scheduled plan's own round has 4), and none if the request
already answers them. The type's rules list the questions that matter for it; good questions change quantities, order,
dates or scope:

| Goal | Useful questions |
| --- | --- |
| Recipe | How many servings; key equipment (oven, pressure cooker); dietary needs |
| Trip or event | How many days or guests; budget level; must-dos |
| Learning a skill | Current level; time per week; goal (casual, exam, job) |
| Home project | Tools available; renting or owning; budget |

Put a sensible default first with "(Recommended)". If the user says "just make it", skip the questions, use defaults,
and list them in the workflow's notes under an "Assumed" heading.

## 4. Build the workflow

Follow the type's rules. Every type's workflow notes have:

- A heading and a 1–2 sentence overview (what this is, total time or cost if relevant).
- "What you need" as a checklist when there are ingredients, tools, or documents, or that in the first step.
- "Assumed" bullets for any defaults you chose.

Pick a cover that fits the topic (see format.md).

## 5. Save and deliver

Everyday plans go to `plansDir`; a plan about the current code project (a setup procedure, a team routine) goes to its
`planton/` folder. Validate and deliver following [handoff.md](../planton/reference/handoff.md).
