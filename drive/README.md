# BLAID

> **Status:** Planning (PRD v0.2 · 2026-06-04). No code yet — this directory currently holds product docs.

**Run your coding agent with full autonomy — without giving it your whole machine.**

One command launches a coding agent (Claude Code, OpenClaw, …) inside a kernel-isolated [NVIDIA OpenShell](https://github.com/NVIDIA) sandbox scoped to the current project. Filesystem access to **this repo only**, network access to **your model API and package registries only**, credentials injected as scoped env vars the agent can use but never read off disk. Your SSH keys, browser cookies, other projects, and the rest of the internet simply don't exist from inside the box.

```bash
cd my-project
blaid claude                      # Claude Code on Anthropic — autonomous, contained
blaid --provider ollama openclaw  # fully local, zero direct egress (the privacy wedge)
```

## The problem

Today developers running coding agents pick between two bad options:

- **Supervised** — approve every file write and shell command → permission fatigue, autonomy wasted.
- **Unsupervised** (`--dangerously-skip-permissions`) — the agent inherits your full ambient authority. A single prompt injection in a dependency README can exfiltrate `~/.ssh` or `.env`.

BLAID removes the trade-off: full autonomy *because of* the sandbox, not despite the lack of one.

## v1 scope

Two validated, supported paths — the architecture is vendor-neutral, but the surface is deliberately narrow so every shipped cell is tested:

| Agent | Provider | Why it's in v1 |
|-------|----------|----------------|
| `claude` (Claude Code) | `anthropic` (cloud) | The "it just works," best-quality demo |
| `openclaw` | `ollama` (local) | **The wedge:** zero-egress, fully local, for sensitive codebases |

**Linux-first** — full Landlock + seccomp kernel enforcement. macOS/Windows ship as clearly-labeled, container-grade isolation via Docker/Podman; `blaid doctor` tells you which tier you're on.

## CLI surface

| Command | Behavior |
|---------|----------|
| `blaid <cmd>` | Resolve policy → create sandbox → inject credentials → exec `<cmd>` inside, terminal attached. Destroyed on exit. |
| `blaid --provider <p> <cmd>` | Override the inference provider for this run. |
| `blaid init` | Inspect the project and write a commented `.blaid.yaml`. |
| `blaid providers` | List providers, live reachability, and the agent×provider matrix. |
| `blaid verify [--ci]` | Dry run — print exactly what the policy permits without launching. Exits non-zero on over-broad policy. |
| `blaid allow <domain>` | Append to the network allowlist and hot-reload the running sandbox. |
| `blaid log [--follow]` | Show policy-denial events for the session. |
| `blaid doctor` | Check prerequisites and report the active enforcement tier. |

With no `.blaid.yaml` present, `blaid claude` uses the built-in default profile and prints a one-line permission summary at launch. `init` is recommended, never required.

## Policy

A plain YAML file checked into the repo, so teams review agent permissions like they review code. The `inference.provider` choice *drives* the network and credential rules automatically.

```yaml
version: 1
agent:
  command: claude            # claude | openclaw | hermes | aider | <custom>
inference:
  provider: anthropic        # v1: anthropic | ollama
  model: claude-opus-4-8
filesystem:
  allow:
    - .                      # project root (always implied)
    - ~/.gitconfig:ro
network:
  allow:
    - registry.npmjs.org     # provider host is added AUTOMATICALLY
credentials:
  - ANTHROPIC_API_KEY        # from host env; never written to disk in-sandbox
```

**Resolution order:** `.blaid.yaml` → `~/.config/blaid/default.yaml` → built-in default profile.

## Architecture

A single static **Rust** binary on the host. Everything above the `core/sandbox` adapter is pure and OpenShell-free; only the adapter talks to OpenShell, isolating its alpha churn.

```
blaid CLI (Rust — single static binary)
  ├── policy/        schema, resolution, init; compiles .blaid.yaml ON THE HOST (FR0a)
  ├── inference/     provider interface (v1: anthropic | ollama) → egress + credential + baseUrl
  ├── core/sandbox   ADAPTER: the only module that talks to OpenShell
  ├── credentials/   host env / keychain → env-var injection (cloud path only; wedge is keyless)
  └── ui/            terminal passthrough, launch summary, deny-log rendering
```

See **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** for full diagrams (system overview, launch sequence, policy resolution, enforcement tiers).

## Key safety invariants

- **FR0 — fail-closed:** never launch unless enforcement is confirmed active by an in-sandbox probe (denied read + write + connect). There is no "run anyway" path.
- **FR0a — policy immutable to the agent:** the policy is compiled on the host before the sandbox exists, so the agent never sees the file governing it.
- **Honest threat model:** "zero-egress" means no *direct* egress from the sandbox — the host model process is a trusted exception. Not marketed as kernel-enforced zero-exfil. Full boundary in [docs/PRD.md §6.2](./docs/PRD.md).

## Documentation

- **[docs/PRD.md](./docs/PRD.md)** — full product requirements (v0.2, CEO + Eng reviewed)
- **[docs/PRFAQ.md](./docs/PRFAQ.md)** — press release & FAQ
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — architecture diagrams

## Roadmap

- **Phase 1 (this directory):** the safe-mode launcher above.
- **Phase 2 — Magic Folder (AI Dropbox):** a watcher daemon triggers a sandboxed agent when files land in a designated folder (summarize PDFs, OCR + rename, organize, index). Builds entirely on the v1 `core/sandbox` + `policy/` modules — **zero new security architecture** — with a React/TS UI via Tauri or Electron.

---

*BLAID is free and open source.*
