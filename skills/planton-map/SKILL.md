---
name: planton-map
description: Draw the current project's system as a Planton system map, a Flowchart of the technologies it runs on (Next.js, Node.js, PostgreSQL, Auth0, Stripe…) connected by how they talk, with each part's setup steps ticked where the repository shows them done. Reads package.json, lock files, ORM schemas, docker-compose, infrastructure and CI files, framework configs, .env.example names and architecture docs, and writes planton/system-map.planton.json; run again, it updates the map and keeps the person's arranging. Use when the user asks to map, draw, diagram or show their system, stack or architecture as a workflow or in Planton. For planning what to build next, use planton.
---

# Draw the project's system map

The map is a Flowchart without Start or End: one card per part of the system, each naming its technology (`tech`),
connected by labelled links, with that part's setup steps as checklist lines. Read
[format.md](../planton/reference/format.md) first, especially "Technologies", the system-map example and "Updating a plan".

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

**Never open `.env`, `.env.local`, `.env.development` or any other real env file, or any file that holds secrets**
(keys, certificates, credentials files), even if asked to look everywhere: only `.env.example` and `.env.sample`. Never
copy a value from any file into the plan. Which settings are set is the bridge's job, not yours.

## 2. Decide the parts

- One card per part a developer would point at: the web app, the API, the database, sign-in, payments, storage, email,
  hosting. A library inside a part (an ORM, a UI kit) belongs in that part's notes, not a card of its own, unless it's
  the main thing someone would ask about (Prisma often is).
- Give each card its `version` when the project's own files say it: the major version (or major.minor) from
  `package.json` (without `^` or `~`, so `"^16.0.1"` becomes `"16"`), a lock file, `pyproject.toml`, `go.mod`, a
  Dockerfile tag or the compose file's image tag (`postgres:16` is `"16"`). Leave `version` out when it isn't written
  down or the parts disagree; never guess it from memory.
- Give each card its `env`: the names from `.env.example` or `.env.sample` that this part uses (`DATABASE_URL` on the
  database, `STRIPE_SECRET_KEY` on payments), each a valid name (capitals, digits, underscores, starting with a
  letter), at most 20 a card, none repeated. Names only: a value never goes in a plan. Don't check whether a name is
  set yourself; the workspace page does that with the bridge, which reads the real `.env` files on this PC.
- Name each card for its job ("Database", "Sign-in"), and set `tech` to its id from the Technologies table. For a
  technology not listed, leave `tech` out and put the technology's name in `description`.
- Link the parts the way requests and data move, from the caller to the called, labelled in a few words ("HTTP",
  "reads / writes", "webhook", "sends email"). Order `links` from the user-facing part down, so the chart reads top to
  bottom.
- Each card's notes: one short paragraph on what that part does here, then its setup steps as `checklist` lines,
  `"checked": true` only with evidence in the repository (the migration exists, the variable is in `.env.example`, the
  config file is there). Five steps at most per card.
- About 4 to 12 cards. A map of more than 15 is too big to read on a phone: group minor services into one card.

## 3. Write or update the file

- New: write `planton/system-map.planton.json` with the title "<Project name>: system map", `"type": "flowchart"`, and
  `"author": "Claude Code"`.
- Already there: read it, then follow "Updating a plan" in format.md: keep every card's `key` and `position`, keep cards
  you aren't changing exactly as they are, add new parts as new cards (give each a key from its title, and no
  position), tick steps that are now done, and
  **ask before removing a card**, since the person may have added it by hand. Keep the `version` and `env` a card
  already has unless the repository shows it changed; add them to cards that lack them.

Then finish with [handoff.md](../planton/reference/handoff.md): validate, deliver, and the short final message. Mention
that `/planton-workspace` shows the map in the browser, where it can be arranged and extended by dragging technologies
onto it.
