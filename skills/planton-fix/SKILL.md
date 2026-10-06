---
name: planton-fix
description: Clean up a Planton workflow so its flowchart is compact and easy to follow on a phone. Measures and sketches the current flowchart, then applies the right pattern — wraps long step lists into rows, groups long flat lists into stages or themes, splits oversized groups, merges one-card groups, flattens deep nesting, prunes cluttered links, gives a Flowchart workflow one start, an end, and decisions with labelled Yes/No ways out, and fixes duplicate or overlong titles — without losing content or progress. Use when a plan looks too long, too linear, messy, or cluttered, or the user asks to fix, tidy, compact, clean up, or restructure a Planton workflow or its flowchart.
---

# Planton fix

Make a plan's flowchart compact and readable on a phone, while keeping everything the plan says and everything the
user has already done.

Read first: [format.md](../planton/reference/format.md) (especially "Flowchart layouts") and
[handoff.md](../planton/reference/handoff.md) in the `planton` skill folder next to this one.

## 1. Find the plan

Use the file the user names. Otherwise look in the project's `planton/` folder, then in `plansDir` from the config
(see handoff.md). If several match, ask which with AskUserQuestion. If the workflow only exists in the app, say that
the flowchart's **Layout** button switches step-by-step workflows between rows and a single line, and that this skill
restructures plan files — offer to recreate the plan as a file with the skill that made it.

## 2. Measure

Run the analyzer that ships with the `planton` skill:

```bash
node "<skills folder>/planton/validator/analyze.mts" "<file>"
node "<skills folder>/planton/validator/analyze.mts" "<file>" --layout line   # preview another layout
```

It prints the layout, the flowchart's size in phone screens, a text sketch of how it's arranged, and findings such as
long lines of steps, oversized or one-card groups, deep nesting, too many links, and duplicate titles. For a Flowchart
workflow the sketch runs top to bottom, row by row, followed by its branches and loops, and the findings cover a
missing or extra `start`, a missing `end`, decisions without two labelled ways out, cards the flow never reaches or
that lead nowhere, and titles too long for a box. Read the whole plan too: the analyzer measures shape, and you judge
meaning.

## 3. Choose the pattern

| Plan shape | Pattern | What to change |
| --- | --- | --- |
| Steps, 4 or fewer | **Line** | Nothing, or `"layout": "line"` |
| Steps, 5–12, where every step must happen in order (recipes, repairs, paperwork) | **Rows** | Set `"layout": "rows"` and keep the steps flat, so each step still unlocks the next and the app moves straight on to it |
| Steps, more than 12, or natural stages whose inside order is flexible (projects, study plans) | **Stages in rows** | Group into 3–8 stages of 2–6 tasks each, named for the outcome ("Brown the meat", "Build 1: Billing"); `"layout": "rows"` |
| Free-form with more than 7 top-level cards | **Themes** | 3–7 theme cards with 2–8 items each; keep `links` only across themes and only for real dependencies |
| Flowchart | **Flow** | One `start` card and an `end` card; every `decision` has two links out labelled "Yes" and "No"; cards flat; the main path's links listed first so it runs straight down; titles under 40 characters |
| Scheduled with many cards | **Parts of the day** | Group under cards like "Morning", "Afternoon", "Evening", or one card per day for weekly plans; keep each card's own schedule |
| Any plan | **Balance** | Split groups over 8 cards, merge groups with a single card, flatten nesting deeper than 3, make titles unique and under 60 characters |

Trade-off to respect: in a step-by-step workflow only top-level steps lock and auto-advance; cards inside a step can be
done in any order. So don't group strictly ordered steps just to save space — use rows instead.

## 4. Propose before changing

Show the user, briefly:

- **Before**: the analyzer's size and sketch.
- **After**: what you'll change (pattern, groups with their cards, renamed titles) and a sketch of the result.

Then ask with AskUserQuestion, recommended first: "Apply the fix (Recommended)" · "Layout only" (just set `layout`, no
regrouping) · "Cancel". Skip the question if the user already said to just fix it.

## 5. Apply without losing anything

- Keep every note, checklist item, status, `checked` value, schedule, and timer. Move cards; don't rewrite them.
- Keep card titles exactly as they are unless they're duplicates or too long. The app matches cards by title to carry
  progress over, even when a card moves into a new group; list any title you change in your summary.
- New group cards (stages, themes, parts of the day) get a one-line note saying what they cover, and a checklist only
  if the group has its own finish line. In a step-by-step plan, a stage whose cards are all already done gets
  `"status": "done"`.
- Decision and Revisit cards stay in the stage they belong to.
- Update `key`s and `links` so every link still points at the right cards; drop links that now duplicate a parent
  connection.
- Leave the workflow's title unchanged, so re-importing updates the existing workflow instead of adding a new one.

## 6. Check and deliver

Validate, run the analyzer again, and show before → after (size in phone screens and the sketch). Then save over the
same file and deliver following [handoff.md](../planton/reference/handoff.md). Tell the user that **Update existing**
in the app keeps their progress, and that saved flowchart positions are replaced by the new layout.
