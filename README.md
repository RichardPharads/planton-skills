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
* 🎯 **Recommendations** → Compare options and record the final decision
* 🔌 **Phone connection** → Send workflows directly to the Planton app

The goal is simple:

**Take something you want to accomplish → turn it into a workflow → work through it step by step.**

---

## 🛠️ Available Skills

| Skill               | What it does                                                                  |
| ------------------- | ----------------------------------------------------------------------------- |
| `planton`           | Plan a software project while recording important decisions                   |
| `planton-gen`       | Turn everyday goals into structured workflows                                 |
| `planton-steps`     | Create precise step-by-step procedures for recipes, setups, repairs, and more |
| `planton-schedule`  | Create routines and programs with real dates and times                        |
| `planton-free-form` | Organize ideas, lists, and goals that can be completed in any order           |
| `planton-from-docs` | Turn existing roadmaps, tickets, or specifications into a plan                |
| `planton-next`      | Find the next task to work on while keeping progress up to date               |
| `planton-reco`      | Compare options, recommend an approach, and record the decision               |
| `planton-fix`       | Clean up a workflow's flowchart so it reads well on a phone                   |
| `planton-connect`   | Pair your phone so workflows can arrive in the Planton app                    |

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

Planton Skills can be installed into compatible coding-agent environments.

For example, with Claude Code:

```bash
git clone https://github.com/RichardPharads/planton-skills.git
```

Then follow the installation instructions for your agent/environment.

> **Note:** Installation commands and paths may vary depending on the coding agent you are using.

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

`planton-reco` can compare the options, help determine the best choice, and record the decision as part of the workflow.

---

## 🧩 Skill Overview

| Skill               | Best for                |
| ------------------- | ----------------------- |
| `planton`           | Software projects       |
| `planton-gen`       | General goals           |
| `planton-steps`     | Procedures              |
| `planton-schedule`  | Routines & schedules    |
| `planton-free-form` | Flexible goals & ideas  |
| `planton-from-docs` | Existing documentation  |
| `planton-next`      | Progress & next actions |
| `planton-reco`      | Decisions & comparisons |
| `planton-fix`       | Workflow cleanup        |
| `planton-connect`   | Phone connection        |

---

## 🎯 Why Planton?

Large goals are often difficult because the next step isn't obvious.

Planton focuses on turning:

**Big goals → smaller tasks → clear actions → completed work**

Instead of keeping a plan buried inside a conversation, Planton turns it into something you can **see, follow, and update**.

---

## 🔄 Naming

The repository is currently named:

```text
planton-skills
```

Other possible names include:

```text
planton-agent
planton-for-agents
```

However, the current installation commands and **ADR 0004** assume:

```text
RichardPharads/planton-skills
```

If the repository name changes, those references should be updated as well.

---

## 📄 License

See the repository license for details.
