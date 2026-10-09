---
name: planton-flow
description: Explain how one feature of the current project works as a Planton flow traced from the real code, either a request flow (what the system does behind a click, a request, a webhook or a job, one lane per part of the system, each call named) or a user flow (what a person goes through, screen by screen, to every way it ends), each step naming its technology and files. Writes planton/flow-<name>.planton.json and links it from the system overview's How it works column. Use when the user asks how something in their project works (sign-in, checkout, a webhook, caching, a background job) or what a user goes through (signing up, booking, paying), or wants a flow traced, drawn or explained before changing code. For the whole system's stack, use planton-map; for planning new work, use planton.
---

# Explain how a feature works

A flow is a Flowchart traced from the code rather than imagined. Read [format.md](../planton/reference/format.md)
first, especially "Flowchart shapes", "Overviews and flows", "Technologies" and "Updating a plan".

## 1. Pin down what to trace

- One feature, with one way in: "signing in with email and password", not "auth". If the question covers several
  (signing in and signing up), trace the one asked about first and offer the others after.
- Which kind it asks for:
  - **A request flow**: what the system does behind something ("how does sign-in work", "what happens when Stripe
    calls us", "how does the nightly sync run"). The usual kind.
  - **A user flow**: what a person goes through ("what does a new patient go through to book", "walk me through
    sign-up"). When it's unclear, ask once with AskUserQuestion: "What the system does (Recommended)" or "What the
    person goes through".
- Find where it starts by searching the code: the screen or route with the button, the API handler, the webhook route,
  the job or schedule that registers it. Say in one sentence what you're tracing and where it starts.
- `planton/flow-<name>.planton.json` already there: this is an update (step 6).

## 2. Trace it through the code

- Follow the real calls from that entry point: the handler, the functions it calls, the services and the stores they
  reach. For a user flow, follow the screens instead: the routes, each screen's buttons and forms, where each one
  leads, and the messages sent. Read only what the trace needs.
- For each step note what happens (one line, starting with a verb), which part of the system does it, the files it's
  in, and every branch that changes the outcome: invalid input, a wrong password, nothing found, an error the code
  catches and answers.
- **Only what the code does.** Never add a step you think should be there (a check that isn't written, a retry that
  doesn't exist). A step inside a library or another service you can't read is named by its call
  (`auth0.passwordLogin`) and says it happens outside the repository.
- **Never open `.env`, `.env.local` or any other real env file, or any file that holds secrets.** A setting the code
  reads is named (`AUTH0_SECRET`), never its value.

## 3. Draw it: what every flow has

- **Start** (`"shape": "start"`): what starts it, as the person or system sees it ("Patient presses Sign in", "Stripe
  sends invoice.paid", "Every night at 2:00"). **End** (`"shape": "end"`): one for each way it finishes ("Opens
  Appointments", "Shows Wrong email or password").
- Between them one card per step, 6 to 14 cards in all: a Process for something done, a Decision for a branch (its
  links labelled "Yes" / "No", or the cases), a Database for a read or write to a store, an Input/output for data
  arriving or leaving, a Delay for a wait or a timer, a Document for an email or a file sent. Merge steps too small to
  matter; a flow of more than 16 cards is two flows.
- Every card: `tech`, the technology doing the step, from the Technologies table and the same as the overview uses
  for that part; `paths`, the files it happens in (relative to the project's root, at most 3); and notes of one or two
  lines on what happens and why, naming functions in `code` marks.
- `links` in the order things happen, the main path's first. A branch that goes back (try again) links to the card it
  returns to.
- `"type": "flowchart"`, `"author": "Claude Code"`; the file `planton/flow-<slug>.planton.json` (`flow-sign-in`).

## 4. Draw it: request flow or user flow

**A request flow** has `"layout": "lanes"`: each card's `lane` is the part of the system doing it.

- Name the lanes exactly as those parts' cards on the overview (`planton/system-map.planton.json`): "Web app", "API",
  "Database", "Sign-in". With no overview, name them for the parts ("Web app", "API", "Database", "Stripe"). A service
  outside the repository gets a lane of its own.
- The Start may leave its lane out: it joins the lane it leads to. Order the cards so the lanes first appear in the
  order a request travels (the person's side first).
- A link that crosses lanes is a call or its answer: label it with what's called or what comes back
  (`"POST /api/login"`, `"SQL insert"`, `"verify"`, `"result"`), at most 24 characters.
- Title "How <feature> works" ("How sign-in works").

**A user flow** follows the person, and draws each kind of moment with its own shape:

| Moment | Shape | Example |
| --- | --- | --- |
| A screen the person sees | `display` | "Sign-in screen", with `paths` its file |
| Something they tap or type | `manual-operation` | "Taps Sign in", "Types email and password" |
| What the app does in reply | Process (no `shape`) | "Checks the details" |
| A choice, theirs or the app's | `decision` | "Account exists?" |
| An email, a text or a file sent | `document` | "Welcome email" |

- Lanes only when more than one person takes part, one lane each ("Patient", "Clinic staff"), with
  `"layout": "lanes"`; otherwise no lanes.
- Title "How <someone> <does it>" ("How a new patient books a visit").

Run the analyzer and fix what it lists: `node "<skills folder>/planton/validator/analyze.mts" "<file>"`, where
`<skills folder>` is the folder that contains this skill's folder.

## 5. Add it to the overview

- `planton/system-map.planton.json` is an overview (`"layout": "columns"`): add a card to its How it works column,
  titled for the feature ("Sign-in", "Booking a visit") with `opens` set to the flow's name (`"flow-sign-in"`). Make
  the column, last, if it isn't there. A card that already opens this flow stays as it is. Change nothing else in the
  file ("Updating a plan" in format.md), and validate it too.
- No overview, or the older kind of map (`"type": "flowchart"`): leave it alone and mention that `/planton-map` draws
  the overview, which links every flow.

## 6. Updating a flow

Asked again about a feature that has a flow, or told the code changed: read the flow, trace the code again, and follow
"Updating a plan" in format.md. Keep every card's `key` and `position`, change the steps that changed, add new ones,
and ask before removing a card the person may have added. A flow from before lanes (no `layout`) becomes a request
flow by adding `"layout": "lanes"` and a `lane` on each card; its keys stay.

Then finish with [handoff.md](../planton/reference/handoff.md): validate, deliver, and the short final message: what it
traced, where it starts and the ways it ends, and anything surprising found on the way (a branch with no answer to the
user, an error nobody catches). Mention that `/planton-workspace` opens it from the overview, each part in its own lane.
