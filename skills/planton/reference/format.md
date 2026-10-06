# Planton workflow file format (version 1)

A `.planton.json` file describes one workflow. The app creates ids, positions, and timestamps on import, so the file
never contains them. Invalid files are rejected with a message naming the exact field, e.g.
`workflow.cards[2].title: is required`. Always run the validator before handing a file over (see handoff.md).

## Top level

| Field | Required | Value |
| --- | --- | --- |
| `format` | yes | `"planton.workflow"` |
| `version` | yes | `1` |
| `author` | no | Shown as the workflow's author, up to 60 characters. Use `"Claude Code"`. |
| `workflow` | yes | A card (below) plus `type`, `appearance`, and `links`. |

## `workflow` extras

| Field | Value |
| --- | --- |
| `type` | `"steps"`, `"freeform"`, `"scheduled"`, or `"flowchart"` (see "Choosing a type"). Default `"freeform"`. |
| `appearance` | Optional. `{ "style": "thumbnail" \| "background", "fade": "soft" \| "medium" \| "strong" }`. There's no cover-colour field — the app gives every workflow a plain fill; the person can add a photo cover themselves. |
| `links` | Optional. Connections between cards, by key: `[{ "from": "<card key>", "to": "<card key>", "label": "Yes" }]`. In a `flowchart` they are the whole flow (nothing is connected for you), and `label` (up to 24 characters) is drawn beside the line, e.g. a Decision's "Yes" and "No". In other types every card is already connected to its parent, so only add links across groups; `label` is ignored there. |
| `layout` | Optional, `"steps"` only. `"rows"` or `"line"` (see "Flowchart layouts"). Leave it out to let the app choose. |

## Card

| Field | Required | Value |
| --- | --- | --- |
| `key` | no | Name used by `links`: 1–64 letters, digits, `-`, `_`; unique in the file. |
| `title` | yes | Up to 120 characters (aim for under 60). Don't number titles; the app shows "Step 2 of 8" itself. |
| `description` | no | Short line shown under the title, e.g. an estimate ("About 2 days"). |
| `status` | no | `"pending"` (default) or `"done"`. Ignored on the workflow itself. |
| `notes` | no | List of blocks (below). |
| `timerMinutes` | no | A built-in timer, 1–1440 minutes, started with one tap. Use for waiting steps. |
| `schedule` | no | Scheduled workflows only (below). |
| `shape` | no | Flowchart workflows only: the card's symbol (see "Flowchart shapes"). Leave it out for a Process. |
| `cards` | no | Cards inside this one. At most 4 levels deep and 400 cards in total. Not in a `flowchart`: its cards are flat. |

## Blocks

A block is either a plain string (a paragraph) or an object:

| `type` | Extra fields |
| --- | --- |
| `"heading"` | `text` |
| `"paragraph"` | `text` |
| `"bullet"` | `text` |
| `"checklist"` | `text`, `checked` (`true`/`false`, default `false`) |

Text blocks can be up to 4000 characters.

A block's text can carry light formatting, drawn on the card: `**bold**`, `*italic*`, `++underline++`,
`~~strikethrough~~`, `==highlight==` and `` `code` ``. Use it sparingly, for the one thing in a line that matters
("Rest the dough **30 minutes**"); a whole line in bold is a heading instead.

## Schedules (`"type": "scheduled"` only)

Repeating:

```json
{ "time": "06:30", "days": "every-day", "startDate": "2026-09-16", "endDate": "2026-10-15" }
```

- `time`: `"HH:MM"`, 24-hour, the phone's local time.
- `days`: `"every-day"`, `"weekdays"`, `"weekends"`, or a list of `0`–`6` (0 = Sunday). Default every day.
- `startDate` / `endDate`: optional `"YYYY-MM-DD"`, both inclusive. Before the start the card shows as upcoming; after
  the end it shows "Ended".

Once: `{ "at": "2026-10-18T06:00" }` — local date and time, **no `Z` or offset**.

How the app treats them: a card is **due** from its time for 2 hours, then **missed**. A repeating card starts fresh at
each occurrence (back to pending, checklist unticked), so its checklist is what to do *each time*.

## Flowchart shapes (`"type": "flowchart"` only)

| `shape` | Drawn as | Use for |
| --- | --- | --- |
| `process` | Rounded box (the default: leave `shape` out) | A step to do |
| `decision` | Dark diamond | A short question; give it two links out, labelled "Yes" and "No" |
| `start` | Oval | Where the flowchart begins: one per chart |
| `end` | Oval | Where it finishes |
| `input-output` | Slanted box | Information going in or coming out |
| `document` | Box with a wavy bottom | A document or report |
| `subprocess` | Box with a bar down each side | A process described somewhere else |
| `delay` | Box with a round right side | A wait |
| `preparation` | Hexagon | Setting something up first |
| `manual-operation` | Box narrowing downward | A step done by hand |
| `database` | Cylinder | Where information is stored |
| `display` | Pointed left side, round right side | Something shown on a screen |

Start and End are markers: they don't count toward progress and can't be completed. Every other shape is a step. Keep
titles short enough to fit in a box (under 40 characters) and phrase a Decision as a question.

## How each type behaves

- **steps**: the workflow's direct cards are steps, done in order; finishing one unlocks the next. Cards inside a step
  are its tasks and can be done in any order. A card can only be completed when its tasks are done, its checklist is
  ticked, and its notes have been read.
- **freeform**: any order. Cards connect to their parent on the flowchart; `links` add connections across groups.
- **scheduled**: cards happen at their schedule's times; the workflow opens on whatever is due now.
- **flowchart**: a process with decisions. Its cards sit side by side under the workflow and the flow is its `links`;
  a link back to an earlier card makes a loop (e.g. "No" → fix it → back to the check). The workflow opens on its
  chart.

## Flowchart layouts

How the app draws each type:

- **steps, `"line"`**: the workflow and its steps in one row, left to right. Cards inside a step stack below it.
- **steps, `"rows"`**: the same order wrapped into rows read like lines of text: 2 steps per row, or 3 when steps have
  cards inside them. The last step of a row connects down to the first of the next. Stacks stay under their step.
- **freeform and scheduled**: a tree, the workflow on the left and each level of cards in the next column.
- **flowchart**: top to bottom, without the workflow's own card. Each card sits a row below everything that leads into
  it (a loop back up doesn't count); the first link out of a card continues its column and each other one (a
  Decision's second answer) starts a column to the right. So list the main path's links first.

Without `layout`, step-by-step workflows with 5 or more steps use rows and shorter ones use a line. People can switch
between rows and line in the app with the flowchart's **Layout** button. Stacked cards are joined by a rail down their
left side, so chains of tasks under a step read top to bottom.

## Choosing a type

| The goal is… | Type | Examples |
| --- | --- | --- |
| Done once, in a fixed order | `steps` | Recipe, assembling furniture, applying for a passport, a software project |
| Repeated at set times, or tied to dates | `scheduled` | Morning routine, 30-day workout, study timetable, medication times |
| Many parts with no fixed order | `freeform` | Trip ideas, packing list, research topics, event planning areas |
| A process with decisions or loops | `flowchart` | Troubleshooting, an approval process, "if this, then that", a support script |

## Example

```json
{
  "format": "planton.workflow",
  "version": 1,
  "author": "Claude Code",
  "workflow": {
    "title": "Recipe Swap",
    "description": "A web app for sharing family recipes.",
    "type": "steps",
    "appearance": { "cover": "sunset", "style": "background", "fade": "medium" },
    "notes": [
      { "type": "heading", "text": "The idea" },
      "Families save and share their recipes in one place.",
      { "type": "heading", "text": "Decisions so far" },
      { "type": "bullet", "text": "Web first, mobile later" },
      { "type": "bullet", "text": "Free while testing; money decided after launch" }
    ],
    "cards": [
      {
        "title": "Discovery",
        "description": "About 2 days",
        "notes": ["Confirm who it's for and what they use today.", { "type": "checklist", "text": "Discovery reviewed" }],
        "cards": [
          {
            "title": "Decision: Platform",
            "status": "done",
            "notes": [
              { "type": "heading", "text": "Decision" },
              "Web first, because it's quickest to share a link with family.",
              { "type": "bullet", "text": "Considered: iOS/Android app, desktop" }
            ]
          },
          {
            "title": "Talk to 5 home cooks",
            "notes": [
              "Learn how they keep recipes today and what's annoying about it.",
              { "type": "checklist", "text": "5 conversations done" },
              { "type": "checklist", "text": "Top 3 problems written down" }
            ]
          }
        ]
      },
      {
        "title": "Launch",
        "description": "About 3 days",
        "notes": [{ "type": "checklist", "text": "Live and shared with 20 families" }],
        "cards": [
          {
            "title": "Revisit: How it makes money",
            "notes": [
              "Undecided at planning. Learn how often people use it during the first month first.",
              { "type": "checklist", "text": "Decide how it makes money" }
            ]
          }
        ]
      }
    ]
  }
}
```

A flowchart, flat, with its flow in `links`:

```json
{
  "format": "planton.workflow",
  "version": 1,
  "author": "Claude Code",
  "workflow": {
    "title": "Release check",
    "description": "Getting a build to testers",
    "type": "flowchart",
    "cards": [
      { "key": "start", "title": "Start", "shape": "start" },
      { "key": "build", "title": "Build the preview APK" },
      { "key": "smoke", "title": "Smoke test passes?", "shape": "decision" },
      { "key": "submit", "title": "Submit to internal testing" },
      { "key": "fix", "title": "Fix the blockers" },
      { "key": "end", "title": "End", "shape": "end" }
    ],
    "links": [
      { "from": "start", "to": "build" },
      { "from": "build", "to": "smoke" },
      { "from": "smoke", "to": "submit", "label": "Yes" },
      { "from": "smoke", "to": "fix", "label": "No" },
      { "from": "fix", "to": "smoke" },
      { "from": "submit", "to": "end" }
    ]
  }
}
```
