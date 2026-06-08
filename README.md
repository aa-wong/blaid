# BLAID

Monorepo for **BLAID**. This repo holds two components:

| Directory | What it is | Stack | Status |
|-----------|------------|-------|--------|
| [`Website/`](./Website) | Marketing site | Next.js (App Router) + Tailwind CSS v4 | Buildable; contact form + real copy still TODO |
| [`drive/`](./drive) | The BLAID product — a safe-mode launcher that runs coding agents inside a least-privilege sandbox | Rust core (planned); React/TS UI in Phase 2 | Planning — docs only, no code yet |

## The product (`drive/`)

**Run your coding agent with full autonomy — without giving it your whole machine.**

One command launches a coding agent (Claude Code, OpenClaw, …) inside a kernel-isolated [NVIDIA OpenShell](https://github.com/NVIDIA) sandbox scoped to the current project — filesystem access to that repo only, network access to your model API and package registries only, credentials injected as scoped env vars the agent can use but never read off disk.

```bash
cd my-project
blaid claude                      # Claude Code on Anthropic — autonomous, contained
blaid --provider ollama openclaw  # fully local, zero direct egress (the privacy wedge)
```

Full detail lives in the product docs:

- **[drive/README.md](./drive/README.md)** — product overview & CLI surface
- **[drive/docs/PRD.md](./drive/docs/PRD.md)** — product requirements (v0.2, CEO + Eng reviewed)
- **[drive/docs/PRFAQ.md](./drive/docs/PRFAQ.md)** — press release & FAQ
- **[drive/docs/ARCHITECTURE.md](./drive/docs/ARCHITECTURE.md)** — architecture diagrams

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
└── drive/     # BLAID product — launcher docs (PRD, PR/FAQ, architecture)
    └── docs/
```

---

> **Note on positioning:** the marketing site currently frames BLAID as "AI enablement for small & medium businesses," while the product docs describe a developer-facing agent sandbox launcher. Align the two narratives (or document the relationship between them) before any public launch.
