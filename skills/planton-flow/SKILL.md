---
name: planton-flow
description: Explain how one feature of the current project works as a Planton flow, a Flowchart traced from the real code, from what starts it (a button, a request, a webhook, a schedule) through each step and decision to every way it can end, each step naming the technology that does it and the files it happens in. Writes planton/flow-<name>.planton.json and adds it to the How it works column of the system overview. Use when the user asks how something in their project works (sign-in, checkout, a webhook, caching, a background job), wants a request, login or data flow traced, drawn or explained, or wants to understand code before changing it. For the whole system's stack, use planton-map; for planning new work, use planton.
---

# Explain how a feature works

A flow is an ordinary Flowchart, traced from the code rather than imagined. Read
[format.md](../planton/reference/format.md) first, especially "Flowchart shapes", "Overviews and flows",
"Technologies" and "Updating a plan".

## 1. Pin down what to trace

- One feature, with one way in: "signing in with email and password", not "auth". If the question covers several
  (signing in and signing up), trace the one asked about first and offer the others after.
- Find where it starts by searching the code: the screen or route with the button, the API handler, the webhook route,
  the job or schedule that registers it. Say in one sentence what you're tracing and where it starts.
- `planton/flow-<name>.planton.json` already there: this is an update (step 5).

## 2. Trace it through the code

- Follow the real calls from that entry point: the handler, the functions it calls, the services and the stores they
  reach. Read only what the trace needs.
- For each step note what happens (one line, starting with a verb), which part of the system does it, the files it's
  in, and every branch that changes the outcome: invalid input, a wrong password, nothing found, an error the code
  catches and answers.
- **Only what the code does.** Never add a step you think should be there (a check that isn't written, a retry that
  doesn't exist). A step inside a library or another service you can't read is named by its call
  (`auth0.passwordLogin`) and says it happens outside the repository.
- **Never open `.env`, `.env.local` or any other real env file, or any file that holds secrets.** A setting the code
  reads is named (`AUTH0_SECRET`), never its value.

## 3. Draw it

- **Start** (`"shape": "start"`): what starts it, as the person or system sees it ("Patient presses Sign in", "Stripe
  sends invoice.paid"). **End** (`"shape": "end"`): one for each way it finishes ("Opens Appointments", "Shows Wrong
  email or password").
- Between them one card per step, 6 to 14 cards in all: a Process for something done, a Decision for a branch (its
  links labelled "Yes" / "No", or the cases), a Database for a read or write to a store, an Input/output for data
  arriving or leaving, a Delay for a wait or a timer, a Document for an email or a file sent. Merge steps too small to
  matter; a flow of more than 16 cards is two flows.
- Every card: `tech`, the technology doing the step, from the Technologies table and the same as the overview uses
  for that part; `paths`, the files it happens in (relative to the project's root, at most 3); and notes of one or two
  lines on what happens and why, naming functions in `code` marks.
- `links` in the order things happen. A branch that goes back (try again) links to the card it returns to.
- Title "How <feature> works" ("How sign-in works"); `"type": "flowchart"`, `"author": "Claude Code"`; the file
  `planton/flow-<slug>.planton.json` (`flow-sign-in`).
- Run the analyzer and fix what it lists: `node "<skills folder>/planton/validator/analyze.mts" "<file>"`, where
  `<skills folder>` is the folder that contains this skill's folder.

## 4. Add it to the overview

- `planton/system-map.planton.json` is an overview (`"layout": "columns"`): add a card to its How it works column,
  titled for the feature ("Sign-in") with `opens` set to the flow's name (`"flow-sign-in"`). Make the column, last, if
  it isn't there. A card that already opens this flow stays as it is. Change nothing else in the file ("Updating a
  plan" in format.md), and validate it too.
- No overview, or the older kind of map (`"type": "flowchart"`): leave it alone and mention that `/planton-map` draws
  the overview, which links every flow.

## 5. Updating a flow

Asked again about a feature that has a flow, or told the code changed: read the flow, trace the code again, and follow
"Updating a plan" in format.md. Keep every card's `key` and `position`, change the steps that changed, add new ones,
and ask before removing a card the person may have added.

Then finish with [handoff.md](../planton/reference/handoff.md): validate, deliver, and the short final message: what it
traced, where it starts and the ways it ends, and anything surprising found on the way (a branch with no answer to the
user, an error nobody catches). Mention that `/planton-workspace` opens it from the overview.
