---
name: planton-free-form
description: Make a free-form Planton workflow — cards that can be done in any order, grouped by theme and linked where they relate, shown as a flowchart. Use for brainstorming, research, trip or event ideas, packing and shopping lists, mind maps, content ideas, and goals with many independent parts. Not for procedures that must happen in order (use planton-steps), routines at set times (use planton-schedule), or processes with yes/no decisions (use planton-gen's flowchart type).
---

# Planton free-form

Organise many independent pieces into themed groups the user can work through in any order.

Read first: [format.md](../planton/reference/format.md), [writing.md](../planton/reference/writing.md), and
[handoff.md](../planton/reference/handoff.md) in the `planton` skill folder next to this one.

## 1. Ask for scope, if it matters

At most one AskUserQuestion round, up to 3 questions, only when the answer changes the groups: dates or duration,
budget, who's involved, or which areas to include (use `multiSelect` for areas). Skip it for simple lists.

## 2. Build the structure

The workflow is `"type": "freeform"`.

- **Root → 3–7 theme cards → 2–8 item cards each.** Themes are the natural areas of the goal ("Flights", "Stay",
  "Food", "Things to do"). Go one level deeper only for a big theme, and never past 3 levels.
- **Theme card**: a one-line note on what the group covers; no checklist unless the group has its own finish line.
- **Item card**: a short note (what, why, and any key detail like cost or link to check), then one checklist item per
  action, each specific enough to do without searching (usually 2–10). A task with parts of its own can hold cards
  inside it, each with its own note and checklist.
  Ideas the user may skip get a bullet "Optional".
- **Order doesn't matter**, so don't number anything or imply a sequence in titles.

## 3. Link what relates

Give cards a `key` and add `links` for real relationships across themes — a dependency ("Book flights" → "Book hotel",
because hotel dates follow flight dates) or a strong connection ("Beach day" → "Pack swimwear"). Guidelines:

- Only link across different themes; every card is already connected to its parent.
- Keep it readable: at most about one link for every two item cards.
- Mention important dependencies in the source card's notes too ("Do this before booking the hotel").

## 4. Save and deliver

Everyday plans go to `plansDir`; plans about the current code project go to its `planton/` folder. Validate and
deliver following [handoff.md](../planton/reference/handoff.md). Tell the user the flowchart shows the groups and links.
