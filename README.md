# Planton Skills

> **Turn any goal into a clear, actionable workflow — right from your coding agent.**

**Planton Skills** gives AI coding agents a set of specialized skills for turning goals, ideas, documents, and decisions into structured **Planton workflows**.

Describe what you want to accomplish, answer a few quick questions, and get a workflow you can open in the **Planton app on your phone**.

Works with **Claude Code** and other compatible coding agents.

---

## ✨ What Can Planton Skills Do?

Planton Skills helps your agent turn different kinds of work into structured workflows:

* 🧩 **Software projects** → Break projects into actionable tasks
* 📋 **Step-by-step guides** → Create precise procedures and instructions
* 🗓️ **Schedules & routines** → Build routines with real dates and times
* 🔀 **Flowcharts** → Visualize decisions and processes
* 📄 **Existing documents** → Convert roadmaps, tickets, and specs into plans
* 💡 **Ideas & goals** → Organize goals that can be completed in any order
* 🎯 **Decisions** → Compare options for your project and record the choice in its plan
* 🗺️ **System overviews** → Draw your project's stack in columns: frontend, backend, data and services
* 🔍 **How it works** → Trace how one feature works through your code, step by step
* 🖥️ **Workspace in your browser** → See and edit a project's plans live on your computer
* 🔌 **Phone connection** → Send workflows directly to the Planton app, and chat with your agent from your phone

The goal is simple:

**Take something you want to accomplish → turn it into a workflow → work through it step by step.**

## 🛠️ Available Skills

| Skill               | What it does                                                                     |
| ------------------- | -------------------------------------------------------------------------------- |
| `planton`           | Plan a software project, from scratch or from its roadmap and tickets, recording each decision |
| `planton-gen`       | Turn everyday goals into workflows: step-by-step, with dates and times, free-form or a flowchart |
| `planton-next`      | Find the next task to work on while keeping progress up to date                  |
| `planton-map`       | Draw your project's system overview: its parts, technologies and settings        |
| `planton-flow`      | Explain how one feature works, traced from the real code: what the system does, or what a person goes through |
| `planton-workspace` | Open your project's plans live in the browser, to arrange and build by hand      |
| `planton-connect`   | Pair your phone so workflows arrive in the Planton app, and chat from it         |

Seven skills since 1.0.3, down from thirteen: the step-by-step, schedule and free-form skills are now part of
`planton-gen`; plans from existing docs and recommendations are part of `planton`; and every skill tidies its own
plan's flowchart. Ask the same way as before ("make me a morning routine", "turn our roadmap into a plan"), and the
right skill picks it up.

---

## 🚀 How It Works

The workflow is designed to be simple:

```text
Your Goal
   ↓
AI Agent
   ↓
Planton Skill
   ↓
Structured Workflow
   ↓
Planton App
   ↓
Work Through It
```

For example, instead of asking an agent:

> "Help me build a SaaS application."

You can use the Planton skill to turn that goal into a structured project plan with tasks, decisions, dependencies, and progress.

The resulting workflow can then be opened on your phone through Planton.

---

## 🤖 Built for AI Coding Agents

Planton Skills is designed to work alongside AI coding agents rather than replacing them.

Your agent can:

1. Understand your goal
2. Ask clarifying questions
3. Break the goal into manageable pieces
4. Record important decisions
5. Build the workflow
6. Keep track of progress
7. Send the workflow to Planton

This makes Planton useful for both **software development** and **everyday planning**.

---

## 📦 Installation

You need [Node.js](https://nodejs.org) 22.6 or later: the skills use it to check plans and to send them to your phone.

### Claude Code (recommended)

Inside Claude Code, run:

```text
/plugin marketplace add RichardPharads/planton-skills
/plugin install planton@planton-skills
```

The skills are then run as `/planton:planton-gen`, `/planton:planton-connect` and so on, or simply by asking
("make me a workflow for…"), since Claude picks the right skill on its own.

**Get updates automatically:** open `/plugin`, go to **Marketplaces**, pick `planton-skills` and turn on auto-update.
Otherwise run `/plugin marketplace update planton-skills` now and then.

### Other coding agents (Cursor, Codex, OpenCode and more)

With the open [`skills`](https://github.com/vercel-labs/skills) installer:

```bash
npx skills add RichardPharads/planton-skills -g
```

Update with `npx skills update`. Installed this way, the skills keep their plain names (`/planton-gen`).

### Where plans are saved

Project plans go in a `planton/` folder in your project. To keep everyday plans (recipes, routines, trips) in one
place, create `~/.claude/planton/config.json`:

```json
{ "plansDir": "/path/to/your/Documents/Planton" }
```

---

## 📱 Planton + Your Phone

With `planton-connect`, you can pair your phone with your agent.

Once connected, workflows created by your agent can be made available in the **Planton app**.

This creates a simple loop:

```text
Plan on your computer
        ↓
Send to Planton
        ↓
Open on your phone
        ↓
Follow the workflow
        ↓
Update progress
```

You can also talk to your agent from your phone: once you allow a project folder, the Planton app's chat can ask
Claude Code about that project. It only reads the folder; it can't change files or run commands.

---

## 🗺️ See Your System

Three skills help you see a software project at two levels: the whole system, and how each part works.

* **`planton-map`** reads your repository (package files, lock files, database schemas, Docker and hosting files, CI,
  and only the variable *names* in `.env.example`) and draws a **system overview**: your project's name on top, then a
  column for each side of it (Frontend, Backend, Data, Services). Each part (your web app, API, database, sign-in,
  payments…) names its technology and version, the settings it needs, the folder it lives in, and its setup steps,
  already ticked where the repository shows them done. Run it again later and it updates the overview while keeping
  your arrangement. It never opens your real `.env` files.
* **`planton-flow`** answers "how does this work?" for one feature, like sign-in, checkout or a webhook. It follows
  the real code from what starts it to every way it can end, and draws one of two kinds of flow: a **request flow**,
  what the system does, with a lane for each part (web app, API, database, Stripe…) and each call between them named;
  or a **user flow**, what a person goes through, screen by screen and tap by tap. Each step names the technology
  doing it and the files it happens in. It only draws what the code does, never a step it thinks should be there. The
  flow is added to the overview's **How it works** column.
* **`planton-workspace`** opens a page on your computer showing every plan in the project's `planton/` folder, updating
  live as your agent writes them. The overview shows each column on its own lane, and a **How it works** card's Open
  button leads into its flow, with a way back. Every card shows where it stands: to do, in progress (a ring that fills
  as its steps are ticked) or done. Arrange cards, drag shapes and technologies (PostgreSQL, Next.js, Stripe…) from the
  palette, connect them, and edit a card's details: your changes are saved straight back into the plan files. Only
  your computer can open it.

```text
Your repository
      ↓
planton-map   →  planton/system-map.planton.json        (the whole system)
planton-flow  →  planton/flow-sign-in.planton.json      (how one feature works)
      ↓
planton-workspace  →  see them, open a flow from the overview, arrange, build on them
      ↓
Planton app  →  carry them on your phone
```

---

## 🧠 Example Use Cases

### Software Development

```text
"Build a dental clinic management system."
```

Planton can help turn the idea into:

```text
Project
├── Authentication
├── Patient Management
├── Appointments
├── Clinical Records
├── Billing
└── Dashboard
```

Each part can then be broken down into smaller actionable tasks.

---

### Learning

```text
"I want to learn React."
```

Turn it into a structured learning workflow with topics, exercises, and progression.

---

### Everyday Goals

```text
"Help me prepare for a 5-day trip."
```

Create a workflow covering:

* Planning
* Packing
* Transportation
* Accommodation
* Daily activities
* Important documents

---

### Procedures

```text
"Show me how to set up my new Raspberry Pi."
```

Generate a precise sequence of steps that can be followed one by one.

---

### Decisions

```text
"Should I use PostgreSQL or MySQL for this project?"
```

`planton` compares two or three real options against your project, recommends one, and records your choice as a
Decision card in the project's plan.

---

### Architecture

```text
"Draw my project's architecture."
```

`planton-map` turns the repository into an overview of its parts (for example Next.js in Frontend, an API in Backend,
PostgreSQL in Data, Auth0 and Stripe in Services), and `planton-workspace` opens it in your browser to rearrange or
extend.

---

### Understanding Code

```text
"How does sign-in work in this project?"
```

`planton-flow` traces it through the code: the form, the API route, the password check, the session, and every way it
ends (signed in, wrong password, account locked), each step pointing to the file it happens in.

---

## 🧩 Skill Overview

| Skill               | Best for                |
| ------------------- | ----------------------- |
| `planton`           | Software projects, existing roadmaps, decisions |
| `planton-gen`       | Everyday goals, procedures, routines, ideas     |
| `planton-next`      | Progress & next actions |
| `planton-map`       | System & architecture   |
| `planton-flow`      | How a feature works     |
| `planton-workspace` | Plans in your browser   |
| `planton-connect`   | Phone connection & chat |

---

## 🎯 Why Planton?

Large goals are often difficult because the next step isn't obvious.

Planton focuses on turning:

**Big goals → smaller tasks → clear actions → completed work**

Instead of keeping a plan buried inside a conversation, Planton turns it into something you can **see, follow, and update**.

---

## 📄 License

The skills are under the MIT License (see [LICENSE](LICENSE)), except two folders that are built from the Planton app's
own code: `skills/planton/validator/` and `skills/planton/bridge/`. Each has its own `LICENSE.md`: you may install and
run them with the Planton skills, but not reuse them elsewhere. The libraries the bridge ships, and the third-party code bundled into the workspace page, keep their own licences
([THIRD-PARTY-NOTICES.md](skills/planton/bridge/THIRD-PARTY-NOTICES.md) and
`skills/planton/bridge/workspace/THIRD-PARTY-NOTICES.txt`).
