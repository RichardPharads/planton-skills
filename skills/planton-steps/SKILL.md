---
name: planton-steps
description: Make a precise, detailed step-by-step Planton workflow — one action per step, exact amounts, times, and settings, observable "done when" checks, timers on waiting steps, and warnings for common mistakes. Use for procedures that must be followed in order and done right — recipes, baking, installing or setting something up, repairs, applications and paperwork, first-time tasks. Use planton-gen when a lighter plan is enough, planton-schedule for things that repeat, and planton for software projects.
---

# Planton precise step-by-step

Write a procedure so exact that a first-timer can follow it on their phone without guessing.

Read first: [format.md](../planton/reference/format.md), [writing.md](../planton/reference/writing.md), and
[handoff.md](../planton/reference/handoff.md) in the `planton` skill folder next to this one.

## 1. Ask what changes the procedure

One AskUserQuestion round, up to 3 questions, skipping anything the request already says:

- **Scale**: servings, size, quantity, or number of rooms/devices.
- **Equipment**: what they have (oven vs air fryer, drill vs screwdriver, phone vs computer).
- **Experience**: first time (explain every technique) or done before (shorter notes).

Put a sensible default first with "(Recommended)". If they want to skip, use defaults and record them under "Assumed".

## 2. Research carefully

Get the facts right before writing: quantities that scale correctly, standard times and temperatures, the official
requirements for paperwork. When a detail varies by place or product (a form's current version, a device model, local
rules), tell the user to check it and add a "Check: …" bullet — don't guess.

## 3. Write the steps

The workflow is `"type": "steps"`. Rules:

- **Prepare step first**: titled like "Gather the ingredients" or "Get your documents ready", with a checklist of
  every item and its exact amount or specification.
- **One action per step.** If a step has "and then", split it. Typical length: 6–15 steps.
- **Each step's notes, in this order:**
  1. A paragraph with exactly how: amounts, sizes, heat level, settings, where to click, how long.
  2. A bullet **"Done when: …"** describing what the person will see, smell, hear, or measure.
  3. Optional bullets **"Watch for: …"** (the common mistake or warning sign) and **"If … : …"** (what to do when
     something goes differently). Don't create branches; describe alternatives in bullets.
  4. Checklist items the person ticks as they go, one per action with its own amount (usually 2–10), each
     observable.
- **Timers**: `timerMinutes` on every step that's mostly waiting (marinate, rise, simmer, cure, dry, charge). For waits
  longer than 24 hours, say so in the notes instead.
- **Safety as a checklist item** where it matters: safe internal temperature for meat and poultry (e.g. chicken 74 °C /
  165 °F), turning off power at the breaker, gloves and ventilation for chemicals.
- **Last step finishes the job**: serve, test, verify it works, clean up, and how to store or maintain.
- Put the total time and difficulty in the workflow's `description` ("About 1½ hours · Beginner").

## 4. Review before saving

Walk through the steps once as a beginner would. Check that every ingredient or item used in a step appears in the
prepare step, amounts add up, and timers match the text.

## 5. Save and deliver

Everyday plans go to `plansDir`; plans about the current code project go to its `planton/` folder. Validate and
deliver following [handoff.md](../planton/reference/handoff.md).
