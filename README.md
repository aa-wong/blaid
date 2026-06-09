# BLAID

Monorepo for **BLAID**. This repo holds two components:

| Directory | What it is | Stack | Status |
|-----------|------------|-------|--------|
| [`Website/`](./Website) | Marketing site | Next.js (App Router) + Tailwind CSS v4 | Buildable; contact form + real copy still TODO |
| [`harness/`](./harness) | The BLAID product — a self-hosted autonomous coding harness that turns PRDs/tickets into reviewable pull requests | Python 3.12 + Typer (planned); Claude Code as V1 engine | Planning — docs only, no code yet |

## The product (`harness/`)

**Feed it a PRD or a ticket; walk away; come back to pull requests.**

Blaid is a self-hosted autonomous coding harness. You give it a PRD or a feature
ticket; it decomposes the work into scoped tasks, executes each one unattended in
an isolated git worktree, runs your tests, and opens a **pull request** for you to
review. The human is in the loop at exactly two points: **plan approval** (Gate 1)
and **PR review** (Gate 2). Everything in between is autonomous.

It runs the **same harness** on your **local machine** (macOS, Apple Silicon — for
cheap/offline/private work) and in your **own AWS account** (so it builds while you
do other things). Only two things change by config: where it runs, and which model
endpoint it talks to.

The core design goal is **engine independence**: the harness is built around a
stable `Engine` contract. **Claude Code is the V1 engine** (headless `claude -p`,
host git worktree, Anthropic API locally / Amazon Bedrock in-account in cloud).
Open-weight models and other agents (Hermes, Ollama, Codex via NVIDIA OpenShell)
are added later as additional engine adapters — **without changing the harness**.

```
PRD ─► [PLAN] ──Gate 1: approve task list──► [BUILD each task] ──► [PR] ──Gate 2: review──► merge
        (LLM)        (human)                     (autonomous)             (human)
```

Full detail lives in the product docs:

- **[harness/docs/PRD.md](./harness/docs/PRD.md)** — product requirements
- **[harness/docs/DESIGN.md](./harness/docs/DESIGN.md)** — design philosophy, the Engine contract, model routing & safety
- **[harness/docs/ARCHITECTURE.md](./harness/docs/ARCHITECTURE.md)** — components, deployment (local + AWS), data flow, build order

## The site (`Website/`)

The marketing site for BLAID, built with Next.js + Tailwind CSS v4.

```bash
cd Website
npm install
npm run dev        # http://localhost:3000
```

See [Website/README.md](./Website/README.md) for scripts, structure, and the pre-launch TODO list.

## Repo layout

```
blaid/
├── Website/   # Next.js marketing site
└── harness/   # BLAID product — autonomous coding harness (PRD, DESIGN, ARCHITECTURE)
    └── docs/
```

---

> **Note on positioning:** the marketing site currently frames BLAID as "AI enablement for small & medium businesses," while the product docs describe a developer-facing autonomous coding harness. Align the two narratives (or document the relationship between them) before any public launch.
