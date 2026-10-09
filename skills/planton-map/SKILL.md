---
name: planton-map
description: Draw the current project's system as a Planton overview, its name on top and a column for each side of it (Frontend, Backend, Data, Services), each listing the technologies it runs on (Next.js, Node.js, PostgreSQL, Auth0, Stripe…) with their versions, the setting names they need and their setup steps ticked where the repository shows them done, plus a How it works column that opens the flows explaining each feature. Reads package.json, lock files, ORM schemas, docker-compose, infrastructure and CI files, framework configs, .env.example names and architecture docs, and writes planton/system-map.planton.json; run again, it updates the overview and keeps the person's arranging. Use when the user asks to map, draw, diagram or show their system, stack or architecture as a workflow or in Planton. To explain how one feature works step by step, use planton-flow; for planning what to build next, use planton.
---

# Draw the project's system overview

The overview is a free-form plan with `"layout": "columns"`: the system on top, one card per column on it, the parts of
each column inside that card. Read [format.md](../planton/reference/format.md) first, especially "Overviews and
flows", "Technologies" and "Updating a plan".

## 1. Read the repository

Look, in this order, and stop reading a kind of file once you know what it tells you:

- `package.json` files (and workspaces), lock files, `requirements.txt`, `pyproject.toml`, `go.mod`, `Gemfile`,
  `composer.json`, `*.csproj`: frameworks and the services they talk to.
- ORM schemas and migrations (`prisma/schema.prisma`, `drizzle.config.*`, `migrations/`): the database, and whether a
  first migration exists.
- `docker-compose.yml`, `Dockerfile`, infrastructure files (`*.tf`, `vercel.json`, `netlify.toml`, `fly.toml`,
  `wrangler.toml`), CI workflows: hosting and the services that run beside the app.
- `.env.example` (or `.env.sample`): **only the variable names** (the part before `=`), which say which services are
  used (`DATABASE_URL`, `STRIPE_SECRET_KEY`). Ignore anything after the `=`, since someone may have left a real value
  there, and never copy a value into the plan.
- `README.md`, `docs/ARCHITECTURE.md`, ADRs: how the parts are meant to fit.
- `planton/flow-*.planton.json`: the flows already written, for the How it works column.

**Never open `.env`, `.env.local`, `.env.development` or any other real env file, or any file that holds secrets**
(keys, certificates, credentials files), even if asked to look everywhere: only `.env.example` and `.env.sample`. Never
copy a value from any file into the plan. Which settings are set is the bridge's job, not yours.

## 2. Decide the columns

The columns are the sides of the system, in the order a request travels through them. Usually:

| Column | What goes in it |
| --- | --- |
| Frontend | What people use: the web app, the mobile app, an admin, and a UI library only when it's the main thing someone would ask about |
| Backend | What answers them: the API, the server, background jobs and workers |
| Data | What it keeps: the database, a cache, file storage, search |
| Services | Outside services it calls: sign-in, payments, email, AI |
| How it works | One card per flow (step 4) |

Name the columns for the project when these don't fit: a command-line tool has no Frontend, a mobile app's might be
"Phone app" and "Server". Use 2 to 6 columns and leave out an empty one. Give each column card a few words of
`description` saying what it holds ("What people use").

## 3. Decide the parts

- One card per part a developer would point at, inside its column: the web app, the API, the database, sign-in,
  payments, storage, email, hosting. A library inside a part (an ORM, a UI kit) belongs in that part's notes, not a
  card of its own, unless it's the main thing someone would ask about (Prisma often is).
- Name each card for its job ("Database", "Sign-in"), and set `tech` to its id from the Technologies table. For a
  technology not listed, leave `tech` out and put the technology's name in `description`.
- Give each card its `version` when the project's own files say it: the major version (or major.minor) from
  `package.json` (without `^` or `~`, so `"^16.0.1"` becomes `"16"`), a lock file, `pyproject.toml`, `go.mod`, a
  Dockerfile tag or the compose file's image tag (`postgres:16` is `"16"`). Leave `version` out when it isn't written
  down or the parts disagree; never guess it from memory.
- Give each card its `env`: the names from `.env.example` or `.env.sample` that this part uses (`DATABASE_URL` on the
  database, `STRIPE_SECRET_KEY` on payments), each a valid name (capitals, digits, underscores, starting with a
  letter), at most 20 a card, none repeated. Names only: a value never goes in a plan. Don't check whether a name is
  set yourself; the workspace page does that with the bridge, which reads the real `.env` files on this PC.
- Give each card its `paths` when the part has a home in the repository: the folder or main file it lives in
  (`apps/web/`, `app/api/`, `prisma/schema.prisma`), relative to the project's root, only paths that exist.
- Each card's notes: one short paragraph on what that part does here, then its setup steps as `checklist` lines,
  `"checked": true` only with evidence in the repository (the migration exists, the variable is in `.env.example`, the
  config file is there). Five steps at most per card.
- `"status": "done"` on a part once every setup step is ticked, or when it has none and the repository shows it in
  use; on a column once every part in it is done. Leave the rest pending: the workspace shows a part with some steps
  ticked as in progress by itself.
- Links only between columns, from the caller to the called, labelled in a few words ("HTTPS", "SQL", "webhook"), and
  only the main ones, about 5 at most. A column's own parts need none: its lane shows they belong together.
- About 4 to 16 parts in all. More is too much to read on a phone: group minor services into one card.

## 4. The How it works column

- One card for each flow already written (`planton/flow-*.planton.json`), titled for what it explains ("Sign-in"),
  with `opens` set to the flow's name (`"flow-sign-in"`).
- Then name the two or three features that matter most and have no flow yet (signing in, paying, the main thing the
  app does) and offer to trace them with `planton-flow`. Add a card for one only when the user says yes: a card that
  opens a flow not written yet shows its Open button dashed, as a promise.
- With no flows and none wanted yet, leave the column out.

## 5. Write or update the file

- **New:** write `planton/system-map.planton.json` titled with the project's name, a one-line `description` of what it
  is, `"type": "freeform"`, `"layout": "columns"` and `"author": "Claude Code"`.
- **Already an overview** (`"layout": "columns"`): read it, then follow "Updating a plan" in format.md: keep every
  card's `key` and `position`, keep cards you aren't changing exactly as they are, add new parts as new cards in their
  column (a key from the title, no position), tick steps that are now done, keep the How it works cards and their
  `opens`, and **ask before removing a card**, since the person may have added it by hand. Keep the `version`, `env`
  and `paths` a card already has unless the repository shows they changed; add them to cards that lack them.
- **The older kind** (`"type": "flowchart"`, one flat chart of technology cards): ask once, "Your system map is the
  older single chart. Turn it into an overview in columns? Every part keeps its key, settings, notes and progress; the
  parts move into columns, so where you arranged them by hand is dropped." On yes, rewrite it as an overview: each card
  keeps its `key`, `title`, `description`, `tech`, `version`, `env`, notes and `status`, loses `position` and `shape`,
  and goes into its column; keep only the links that cross columns. On no, update it as a chart, as before: keep keys
  and positions, link the parts the way requests and data move, labelled, ordered from the user-facing part down.

Then finish with [handoff.md](../planton/reference/handoff.md): validate, deliver, and the short final message. Mention
that `/planton-workspace` shows the overview in the browser, a shaded lane per column, where a How it works card's Open
button leads into its flow.
