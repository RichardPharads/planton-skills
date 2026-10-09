---
name: planton-workspace
description: Open the project's Planton workspace in the browser, a page on this PC showing the plans in the project's planton/ folder live, where the person can arrange them and build Flowchart and free-form plans by hand, dragging shapes and technologies (PostgreSQL, Next.js, Stripe…) from a palette and connecting them. Use when the user asks to open, see, preview or edit the project's plans or workflows in the browser, wants the Planton workspace or its address, or asks which projects have one. Lists and removes workspaces too.
---

# Open the Planton workspace

The workspace is a page served by the Planton bridge on this PC, one for each project. It shows the plans in the
project's `planton/` folder and updates while they change, so the person can watch a plan as you write it. Changes they
make there are saved straight into those files, so read a plan file again before changing it.

It ships with the `planton` skill, in `<skills folder>/planton/bridge/`, where `<skills folder>` is the folder that
contains this skill's folder. It needs Node 22.6 or later.

## Open it

1. From the project's root folder, run:

   ```bash
   node "<skills folder>/planton/bridge/workspace.mts"
   ```

   It starts the bridge if it isn't running, adds the project, opens the page in the browser and prints its address
   (`Workspace: http://127.0.0.1:…/w/…/`). Add `--no-open` when there's no browser to open, and give the address.
2. Tell the user: the page shows this project's plans and keeps up as they change; drag from the palette on the left to
   add cards, drag between cards to connect them, and select one to edit it on the right. Only this PC can open it.
   The address stays the same while the bridge keeps its port: 4444, unless something else had that port when the
   bridge started, when it's the next free one up to 4454. `workspace.mts list` always gives the current address.
3. If the project has no `planton/` folder or no system map yet, offer once: `/planton-map` draws the project's system
   (an overview of its stack in columns), `/planton-flow` explains how one feature works, and `/planton` plans it. In
   an overview, a card's Open button leads into the flow that explains it, and the top bar leads back.

## Other commands

- `node "<skills folder>/planton/bridge/workspace.mts" list`: the projects with a workspace, and their addresses.
- `node "<skills folder>/planton/bridge/workspace.mts" remove "<folder>"`: forget a project's workspace. Its plan files
  stay.
- To stop the bridge (the phone connection stops too): `node "<skills folder>/planton/bridge/connect.mts" stop`.

## If it doesn't open

- "The Planton bridge didn't start": show the log path it printed and the last lines of that log.
- The page says a plan "doesn't open": the file has an error the app's importer names; fix that field (run the
  validator, see [handoff.md](../planton/reference/handoff.md) step 3).
- Something else answers on port 4444: the bridge takes the next free port up to 4454 by itself.
