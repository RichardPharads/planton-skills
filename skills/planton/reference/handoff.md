# Saving, checking, and delivering a plan

Every Planton skill finishes the same way. Follow these steps in order.

`<skills folder>` below is the folder that contains this skill's folder (the parent of this skill's base directory).

The skills are installed either on their own (`/planton-connect`) or as the `planton` plugin
(`/planton:planton-connect`). When you name one to the user, write it the way your list of skills shows it.

## 0. Show progress on the phone

If the user has paired a phone with `/planton-connect`, the plan shows up on it live. Report a few milestones with
the `push` script that ships with the `planton` skill:

```bash
node "<skills folder>/planton/bridge/push.mts" status '<milestone>'
```

- As soon as you know the plan's title: `Planning <title>` (for example `Planning Chicken Adobo`).
- Right before writing the file: `Writing the plan`.
- Right before validating it: `Checking it`.

Milestones are only these short phrases: never file names, paths, commands, or anything else from the user's files.
Write the title plainly in a milestone, leaving out quotes, backticks, `$` and backslashes, so the shell passes it
as plain text.
If `push` says the bridge isn't running, skip the other `push` commands for this plan and carry on.

## 1. Read the config

Read `~/.claude/planton/config.json` (on Windows: `C:\Users\<name>\.claude\planton\config.json`). It may contain:

| Field | Meaning |
| --- | --- |
| `plansDir` | Folder for everyday plans that don't belong to a code project. |

A missing file or field is fine: use the fallbacks below.

## 2. Choose where to save

- **Plans about the current code project** (project plans, recommendations, plans from docs, progress updates):
  `<project root>/planton/<slug>.planton.json`.
- **Everyday plans** (recipes, routines, trips, learning): `<plansDir>/<slug>.planton.json`. With no `plansDir`,
  save to `planton/` in the current folder and mention that setting `plansDir` keeps everyday plans in one place.
- `<slug>` is the title in lowercase ASCII kebab-case, e.g. `filipino-pork-adobo`.
- When updating a plan, overwrite its own file, but read it first: the person may have changed it in the Planton
  workspace. Keep every card's `key` and `position` exactly as they are, give new cards keys, and never write a
  `position` yourself (see "Updating a plan" in format.md).
- When creating a new plan and the name is taken by a different plan, add `-2`, `-3`, ….

## 3. Validate

Run the validator that ships with the `planton` skill. It uses the same checks as the app's importer:

```bash
node "<skills folder>/planton/validator/validate.mts" "<file>"
```

It prints `OK: …` with a summary, or the exact field that's wrong. Fix the file and run it again until it passes. If
Node can't run it (Node older than 22.6), at least check the file parses as JSON and has
`"format": "planton.workflow"` and `"version": 1`.

## 4. Deliver

- If the bridge is running (step 0 didn't say otherwise), send the file to the phone once it has passed the validator:
  `node "<skills folder>/planton/bridge/push.mts" plan "<file>"`. Never send a file that hasn't passed. It prints
  "Sent to your phone.", or that the plan waits on the PC until the phone connects.
- Otherwise, tell them how to import it: in Planton open **Integrations** → **Import a plan**, then paste the file, paste
  a link to it, or **Choose file** (for example after saving it to iCloud Drive, OneDrive, or Google Drive). Mention
  once that `/planton-connect` makes plans appear on the phone directly.
- Importing or receiving a plan whose title already exists offers **Update existing**, which keeps progress made in
  the app (finished cards and ticked items stay done). Renaming a plan's title makes the app treat it as a new plan.

## 5. Final message

Keep it short:

1. What was made: title, type, and size ("Step-by-step · 8 steps · 31 cards").
2. Where the file is, and "Sent to your phone" when it was (or that it's waiting for the phone).
3. Anything assumed on the user's behalf ("Assumed 4 servings").
4. The first thing to do, and an offer to help with it.
