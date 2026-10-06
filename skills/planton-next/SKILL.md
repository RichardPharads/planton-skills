---
name: planton-next
description: Answer "what's next?" from a Planton plan and keep its progress up to date. Finds the current phase and task in planton/*.planton.json, shows its checklist, offers to start, and while working ticks checklist items and completes cards only when there's evidence (tests pass, PR merged, file exists), then re-delivers the plan to the Planton app. Use when the user asks what to do next, starts a work session, says a task is finished, or asks for progress on a project that has a Planton plan.
---

# Planton what's next

Keep the plan and the real work in step: pick up the right task, and record progress honestly.

Read first: [format.md](../planton/reference/format.md) and [handoff.md](../planton/reference/handoff.md) in the
`planton` skill folder next to this one.

## 1. Find the plan

Look for `planton/*.planton.json` in the project. With several, ask which one (AskUserQuestion). With none, offer to
create one with `planton`, or with `planton-from-docs` if the project has a roadmap or tickets.

## 2. Work out where things stand

**Steps plans** (most project plans):

- The **current phase** is the first top-level card whose `status` isn't `"done"`.
- The **next task** is the first card inside it that isn't done, skipping "Decision:" cards. If a "Revisit:" card in
  this phase blocks the task (the task depends on that decision), bring it up first.
- If every task in the phase is done but the phase isn't, the next action is closing the phase: check its own checklist.

**Free-form plans**: list unfinished cards, favouring ones that other cards link to (they unblock the most).

**Scheduled plans**: get the local date and time (`node -e "console.log(new Date().toString())"`) and list what's due
today, in time order.

## 3. Report

Keep it to a few lines: phase and position ("Phase 3 of 9 · Build 1"), the task, its checklist with ticks, anything
blocking it, and "Want me to start on this?". For "show progress", add counts: tasks done / total overall and in the
current phase.

## 4. Record progress honestly

While working on a task, or when the user reports progress:

- Tick a checklist item (`"checked": true`) only with evidence: a test run that passed, a merged PR or commit, a file
  or setting that exists, or the user saying they did it. Mention the evidence in your reply.
- When all of a task's checklist items are ticked, set its `"status": "done"`. When all tasks in a phase are done and
  its own checklist is ticked, set the phase to done.
- Never untick items or reopen cards without asking. The user may have ticked things in the app; re-importing with
  **Update existing** keeps what they ticked there.
- If the work reveals something unplanned, add a task card to the current phase. If it reveals an open decision, add a
  "Revisit: …" card — don't decide silently.
- Keep titles unchanged so the app can match cards when the plan is re-imported.

## 5. Save and deliver

After changing the file, validate it and deliver it following [handoff.md](../planton/reference/handoff.md), then name
the next task.
