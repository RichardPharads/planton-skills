# Flowcharts (`"type": "flowchart"`)

For a process with decisions or loops ("if it doesn't start, check the fuse; still nothing, call an electrician"):
troubleshooting guides, playbooks, "what do we do when…". Read "Flowchart shapes" in
[format.md](../../planton/reference/format.md).

- 5–15 cards, all flat (no cards inside cards). Give each a `key` and draw the flow with `links`: nothing is connected
  for you. List the main path's links first; the app draws the first link out of a card straight down.
- One `start` card first and an `end` card last. Every other card is a step: a `process` (leave `shape` out) or, where
  it says something, one of the other shapes (a `delay` for waiting, a `document` for writing something up, a
  `subprocess` for a process described elsewhere).
- A `decision` is a short question with exactly two links out, labelled "Yes" and "No". A link back to an earlier card
  makes a loop ("No" → fix it → back to the check).
- Titles under 40 characters, so they fit in a box; details go in the card's notes.
