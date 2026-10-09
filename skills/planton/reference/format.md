# Planton workflow file format (version 1)

A `.planton.json` file describes one workflow. The app creates ids and timestamps on import, so the file
never contains them. Positions are optional: leave them out and the app lays the chart out itself. Invalid files are rejected with a message naming the exact field, e.g.
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
| `layout` | Optional. `"steps"`: `"rows"` or `"line"` (see "Flowchart layouts"); leave it out to let the app choose. `"freeform"`: `"columns"` for a system overview. `"flowchart"`: `"lanes"` for a request flow (both in "Overviews and flows"). |

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
| `tech` | no | Flowchart and free-form workflows only: the technology the card stands for, an id from "Technologies" below, e.g. `"postgresql"`. Shown with its name and logo. On a Flowchart, a database or cache with no `shape` is drawn as a cylinder. |
| `position` | no | Flowchart and free-form workflows only: `{ "x": 120, "y": 340 }`, where a person placed the card. Never write one yourself; keep the ones a file already has (see "Updating a plan"). |
| `version` | no | Flowchart and free-form workflows only: which version of the technology the project uses, 1–40 characters after trimming, e.g. `"16"`, `"15.2"`, `"^19.2.3"`. Read it from the repository (`package.json`, a lockfile, a Dockerfile) and leave it out when unsure. |
| `env` | no | Flowchart and free-form workflows only: the names of the settings the card needs, e.g. `["DATABASE_URL"]`. At most 20, each capital letters, digits and underscores starting with a letter (`^[A-Z][A-Z0-9_]{0,63}$`), no repeats. Take them from `.env.example` or the code. |
| `opens` | no | Flowchart and free-form workflows only: the name of another plan in the same `planton/` folder that tells this card's part in more detail, as its file name without `.planton.json`, e.g. `"flow-sign-in"` (lowercase letters, digits and dashes). See "Overviews and flows". |
| `paths` | no | Flowchart and free-form workflows only: the files the card's part lives in, or a folder ending in `/`, relative to the project's root with forward slashes, e.g. `["app/api/login/route.ts"]`. 1–10, each up to 200 characters, never starting with `/` and never with `..` in them. Only paths that exist in the repository. |
| `lane` | no | Flowchart workflows only: in a request flow, the part of the system that does this step, named exactly as that part's card on the overview, e.g. `"API"`. 1–40 characters on one line. See "Overviews and flows". |
| `cards` | no | Cards inside this one. At most 4 levels deep and 400 cards in total. Not in a `flowchart`: its cards are flat. |

`env` holds names only. A value (a password, a key, a connection string) never goes in a plan: the workspace checks the project's own `.env` files on the PC to show which names are set.

Sharing a plan from the Planton phone app drops `version`, `env`, `opens`, `paths`, `lane` and an overview's or a request flow's `layout` (the phone doesn't keep them yet, and draws a request flow as an ordinary Flowchart); the plan file in the project keeps them.

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
- **flowchart, `"lanes"`** (a request flow, in the workspace): the same rows, with each card in its `lane`'s column,
  the lanes side by side in the order they first appear. A card without a `lane` joins the lane of the card it leads
  to, so a Start and an End can leave it out.

Without `layout`, step-by-step workflows with 5 or more steps use rows and shorter ones use a line. People can switch
between rows and line in the app with the flowchart's **Layout** button. Stacked cards are joined by a rail down their
left side, so chains of tasks under a step read top to bottom.

## Overviews and flows

A software project's architecture is told in two kinds of plan, linked together:

- **The overview** (one per project, `planton/system-map.planton.json`, written by `planton-map`): what the system is
  built with. A `"freeform"` workflow with `"layout": "columns"`: the workflow is the system (its name on top), each
  card on it is a column (Frontend, Backend, Data, Services…), and the cards inside each column are its parts, with
  their `tech`, `version`, `env` and `paths`. A last column, "How it works", holds one card per flow, each with `opens`.
- **A flow** (one per behaviour, `planton/flow-<name>.planton.json`, written by `planton-flow`): how one part works,
  step by step. A `"flowchart"` from a Start to an End, with Decisions for the branches (token valid? Yes / No), each
  card naming its `tech` and the `paths` it happens in. Read the code to write one: what really happens, in the order
  it happens. Two kinds:
  - **A request flow**: what the system does behind an action, a request, a webhook or a scheduled job. Add
    `"layout": "lanes"` and give each step a `lane`, the part of the system doing it, named as that part on the
    overview ("Web app", "API", "Database", "Sign-in"). A link crossing lanes is a call or its answer; label it with
    what's called or what comes back (`"POST /api/login"`, `"SQL insert"`, `"verify"`, `"result"`).
  - **A user flow**: what a person goes through. A screen is a `display` card (`paths`: its file), something the
    person taps or types a `manual-operation` card ("Taps Sign in"), what the app does in reply a Process, an email or
    a text sent a `document`, and each way the journey ends an `end`. Use lanes only when more than one person takes
    part, one lane each ("Patient", "Clinic staff").

The workspace draws an overview with the workflow on top and each column on a shaded lane, and a card with `opens` gets
an Open button that leads into that plan, with the way back above it. A card may `opens` a plan that isn't written yet:
its button shows dashed, so the overview also lists what's left to explain.

```json
{
  "format": "planton.workflow",
  "version": 1,
  "author": "Claude Code",
  "workflow": {
    "title": "Dental Clinic",
    "description": "Appointments and records for a small clinic",
    "type": "freeform",
    "layout": "columns",
    "cards": [
      {
        "key": "frontend",
        "title": "Frontend",
        "cards": [{ "key": "web", "title": "Web app", "tech": "nextjs", "version": "16", "paths": ["app/"] }]
      },
      {
        "key": "backend",
        "title": "Backend",
        "cards": [
          { "key": "api", "title": "API", "tech": "nodejs", "version": "22", "paths": ["app/api/"] },
          { "key": "db", "title": "Database", "tech": "postgresql", "version": "16", "env": ["DATABASE_URL"] }
        ]
      },
      { "key": "services", "title": "Services", "cards": [{ "key": "auth", "title": "Sign-in", "tech": "auth0" }] },
      {
        "key": "how",
        "title": "How it works",
        "cards": [{ "key": "how-sign-in", "title": "Signing in", "opens": "flow-sign-in" }]
      }
    ],
    "links": [{ "from": "web", "to": "api", "label": "HTTPS" }]
  }
}
```

A request flow it opens, in short:

```json
{
  "format": "planton.workflow",
  "version": 1,
  "author": "Claude Code",
  "workflow": {
    "title": "How sign-in works",
    "description": "From pressing Sign in to seeing Appointments",
    "type": "flowchart",
    "layout": "lanes",
    "cards": [
      { "key": "start", "title": "Patient presses Sign in", "shape": "start" },
      { "key": "submit", "title": "Submit the form", "lane": "Web app", "tech": "nextjs", "paths": ["app/sign-in/page.tsx"] },
      { "key": "receive", "title": "Receive the request", "lane": "API", "tech": "nodejs", "paths": ["app/api/login/route.ts"] },
      { "key": "check", "title": "Check the password", "lane": "Sign-in", "tech": "auth0" },
      { "key": "right", "title": "Password right?", "shape": "decision", "lane": "API" },
      { "key": "wrong", "title": "Shows Wrong email or password", "shape": "end", "lane": "Web app" },
      { "key": "store", "title": "Store the session", "shape": "database", "lane": "Database", "tech": "postgresql" },
      { "key": "cookie", "title": "Set the session cookie", "lane": "API", "paths": ["lib/session.ts"] },
      { "key": "open", "title": "Opens Appointments", "shape": "end", "lane": "Web app" }
    ],
    "links": [
      { "from": "start", "to": "submit" },
      { "from": "submit", "to": "receive", "label": "POST /api/login" },
      { "from": "receive", "to": "check", "label": "verify" },
      { "from": "check", "to": "right", "label": "result" },
      { "from": "right", "to": "store", "label": "Yes" },
      { "from": "right", "to": "wrong", "label": "No" },
      { "from": "store", "to": "cookie", "label": "saved" },
      { "from": "cookie", "to": "open", "label": "Set-Cookie" }
    ]
  }
}
```

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

## Technologies

A card's `tech` is one of these ids. For something not listed, leave `tech` out and name the card after it.

| Kind | Ids |
| --- | --- |
| Frontend | `nextjs` Next.js, `react` React, `vue` Vue, `svelte` Svelte, `angular` Angular, `expo` Expo, `flutter` Flutter |
| Backend | `nodejs` Node.js, `express` Express, `nestjs` NestJS, `django` Django, `fastapi` FastAPI, `laravel` Laravel, `rails` Ruby on Rails, `spring` Spring, `go` Go, `dotnet` .NET, `prisma` Prisma |
| Database | `postgresql` PostgreSQL, `mysql` MySQL, `sqlite` SQLite, `mongodb` MongoDB, `supabase` Supabase, `firebase` Firebase |
| Cache and queues | `redis` Redis, `rabbitmq` RabbitMQ, `kafka` Kafka |
| Auth | `auth0` Auth0, `clerk` Clerk |
| Payments | `stripe` Stripe, `paypal` PayPal, `polar` Polar |
| Storage | `s3` Amazon S3, `r2` Cloudflare R2 |
| Hosting | `vercel` Vercel, `netlify` Netlify, `aws` AWS, `gcp` Google Cloud, `docker` Docker, `cloudflare` Cloudflare |
| AI | `claude` Claude, `openai` OpenAI |
| Messaging | `twilio` Twilio, `resend` Resend |

Technology cards on a Flowchart, without Start or End: each card is a part of the system, its links say how the parts
talk ("HTTP", "reads / writes", "webhook"), and its checklist is that part's setup steps, ticked where they're done.
This was the first kind of system map; `planton-map` now draws an overview in columns instead (see "Overviews and
flows"), and reads a map like this one as the older kind it offers to convert:

```json
{
  "format": "planton.workflow",
  "version": 1,
  "author": "Claude Code",
  "workflow": {
    "title": "Dental System: system map",
    "description": "What the project runs on and how the parts talk.",
    "type": "flowchart",
    "cards": [
      {
        "key": "web",
        "title": "Web app",
        "tech": "nextjs",
        "notes": [
          "Patients book visits and staff run the clinic here.",
          { "type": "checklist", "text": "Create the Next.js app", "checked": true },
          { "type": "checklist", "text": "Add the booking page" }
        ]
      },
      {
        "key": "api",
        "title": "API",
        "tech": "nodejs",
        "notes": [
          { "type": "checklist", "text": "Set up the server", "checked": true },
          { "type": "checklist", "text": "Add DATABASE_URL to .env.example" }
        ]
      },
      {
        "key": "db",
        "title": "Database",
        "tech": "postgresql",
        "version": "16",
        "env": ["DATABASE_URL"],
        "notes": [{ "type": "checklist", "text": "Write the first migration" }]
      },
      {
        "key": "auth",
        "title": "Sign-in",
        "tech": "auth0",
        "notes": [{ "type": "checklist", "text": "Create the Auth0 application" }]
      }
    ],
    "links": [
      { "from": "web", "to": "api", "label": "HTTP" },
      { "from": "api", "to": "db", "label": "reads / writes" },
      { "from": "api", "to": "auth", "label": "checks tokens" }
    ]
  }
}
```

## Updating a plan

A person may have arranged a plan by hand in the project workspace. When you rewrite a file that already exists:

- Keep every card's `key` exactly as it is, and give each new card a key from its title (`booking-page`).
- Keep every card's `position` exactly as it is, and never add one: cards without a position are laid out for you.
- Keep every card's `version` and `env` as they are unless the repository shows they changed.
- Keep cards you didn't mean to change exactly as they are, including the order of their fields.
