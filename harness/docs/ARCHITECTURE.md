# Blaid — Architecture Document

> **Status:** Draft v0.1
> **Date:** 2026-06-08
> **Companion docs:** [PRD.md](./PRD.md), [DESIGN.md](./DESIGN.md)

---

## 1. System context

```
        ┌──────────────┐         ┌──────────────────────────────┐
 PRD /  │              │ tasks   │            BLAID             │
 ticket │   Operator   ├────────►│   (harness + engine + sandbox)│
 ─────► │   (you)      │◄────────┤                              │
        │              │  PRs    │                              │
        └──────────────┘         └───────┬───────────┬──────────┘
            ▲ approves                    │           │
            │ (Gate 1 + Gate 2)           ▼           ▼
                                   ┌────────────┐ ┌─────────────┐
                                   │  Git host  │ │  Model APIs │
                                   │  (GitHub)  │ │ Bedrock /   │
                                   │  PRs,issues│ │ Anthropic / │
                                   └────────────┘ │ local Ollama│
                                                  └─────────────┘
```

Blaid sits between the operator and the git host + model providers. The operator
supplies intent (PRD/ticket) and exercises two approval gates; everything else
is automated.

---

## 2. Logical components

| # | Component | Responsibility | V1 implementation |
|---|---|---|---|
| 1 | **Intake** | source → `TaskSpec` | markdown file + CLI arg |
| 2 | **Planner** | PRD → ordered `TaskSpec[]`; Gate 1 | single LLM call + interactive approve |
| 3 | **Queue/State** | persist tasks + run records | SQLite (local file) |
| 4 | **Dispatcher** | routing policy, concurrency, local/cloud | in-process worker pool |
| 5 | **Engine adapters** | `run(task, repo, limits)→RunResult` | `ClaudeCodeEngine` |
| 6 | **Workspace mgr** | git worktree lifecycle | `git worktree` wrapper |
| 7 | **Verifier** | run tests/lint, capture | subprocess + config command |
| 8 | **Publisher** | branch → PR; Gate 2 | `gh pr create` |
| 9 | **Observability** | logs, cost, status, audit | structured logs + SQLite |
| 10 | **Config** | env/profile resolution (local vs cloud) | TOML/YAML + env |

---

## 3. Engine adapter architecture

```
            ┌─────────────────────────┐
            │   Dispatcher            │
            │   .run(task) ──────────┐│
            └────────────────────────┼┘
                                     ▼
                         ┌──────────────────────┐
                         │  Engine (Protocol)   │   ◄── stable seam
                         │  run(task,repo,limits)│
                         └─────────┬────────────┘
            ┌──────────────────────┼───────────────────────┐
            ▼                      ▼                        ▼
  ┌───────────────────┐ ┌────────────────────┐ ┌────────────────────┐
  │ ClaudeCodeEngine  │ │ OpenShellEngine    │ │ OpenHandsEngine    │
  │ (V1)              │ │ (V2/V3)            │ │ (optional)         │
  │ claude -p,        │ │ openshell sandbox  │ │ openhands headless │
  │ worktree, Bedrock │ │ create -- <agent>  │ │                    │
  └───────────────────┘ └────────────────────┘ └────────────────────┘
```

- The dispatcher depends only on the `Engine` Protocol (see DESIGN §4).
- Each adapter encapsulates *all* tool-specific concerns (CLI flags, prompt
  format, sandbox driver, model wiring).
- Adding an engine = new file implementing `Engine` + registering it in the
  engine registry. No other code changes.

---

## 4. Deployment architecture

### 4.1 Local (macOS, Apple Silicon)

```
┌─ Mac ───────────────────────────────────────────────┐
│ blaid CLI                                            │
│   ├─ SQLite (queue + run records)                    │
│   ├─ Dispatcher (in-proc workers)                    │
│   └─ ClaudeCodeEngine                                │
│        ├─ git worktree under ~/.blaid/work/<task>    │
│        ├─ claude -p  ──►  Anthropic API (or local    │
│        │                  Ollama via OpenShell, V3)   │
│        └─ gh pr create ──► GitHub                     │
└──────────────────────────────────────────────────────┘
```
- **No Docker required** (R8): host git worktrees + tool allowlist.
- Inference: Anthropic API (V1), or local Ollama via OpenShell (V3).

### 4.2 Cloud (user's AWS account)

```
┌─ AWS (your account) ─────────────────────────────────────────┐
│  Trigger:  GitHub webhook │ EventBridge cron │ manual         │
│        │                                                      │
│        ▼                                                      │
│   SQS queue ──► ECS task (Fargate, V1) / EC2 or EKS (V2 for   │
│        │         OpenShell MicroVM)                           │
│        │           ├─ blaid worker + engine                   │
│        │           ├─ git worktree in container/VM            │
│        │           ├─ model: Amazon Bedrock (in-account) ◄────┤ IAM role:
│        │           │     CLAUDE_CODE_USE_BEDROCK=1             │ bedrock:InvokeModel
│        │           └─ gh pr create ──► GitHub                 │
│        ▼                                                      │
│   CloudWatch logs + run records (DynamoDB/S3)                 │
│   Secrets Manager (GitHub token, etc.)                        │
└───────────────────────────────────────────────────────────────┘
```

| Concern | V1 (Claude Code) | V2 (OpenShell) |
|---|---|---|
| Compute | **Fargate** (per-task container) | **EC2 / EKS** (MicroVM driver needs host virt) |
| Model | Bedrock in-account | Bedrock or local model on GPU EC2 (g5/g6) |
| Isolation | container | MicroVM + seccomp/Landlock/netns |
| Secrets | Secrets Manager + IAM task role | same |

> **Why Fargate for V1 but EC2/EKS for OpenShell:** OpenShell's MicroVM driver
> needs host virtualization / privileged access that Fargate doesn't allow.
> Claude Code's worktree model runs fine on Fargate.

---

## 5. End-to-end data flow (sequence)

```
1. Intake       PRD.md ─► TaskSpec(s) drafted
2. Plan         LLM decomposes ─► [task A, task B, ...]
3. GATE 1       operator approves/edits task list
4. Enqueue      approved tasks → queue (SQLite/SQS)
5. Dispatch     for each task (≤ concurrency):
   5a Route        pick engine + model (policy)
   5b Workspace    git worktree add (isolated branch)
   5c Engine.run   agent edits code within limits
   5d Verify       run tests/lint in workspace
   5e Publish      commit, push, gh pr create
   5f Record       status, cost, logs, PR url
   5g Teardown     remove worktree
6. GATE 2       operator reviews each PR → merge / iterate
```

State transitions per task:
`queued → planning(if PRD) → approved → running → (pr_open | no_changes |
failed:tests | failed:budget | failed:error)`.

---

## 6. Technology stack

| Layer | Choice | Rationale |
|---|---|---|
| Language | **Python 3.12** | Best fit for Agent SDK, LiteLLM, scripting `claude`/`gh`/`git` |
| CLI | **Typer** (or Click) | Ergonomic command surface |
| State | **SQLite** (local) → **DynamoDB/S3** (cloud) | Zero-setup local; managed in cloud |
| Queue | local in-proc → **SQS** (cloud) | Simple V1; durable cloud fan-out |
| Git ops | `git` CLI + worktrees (subprocess) | Native, reliable isolation |
| PR ops | **`gh` CLI** | Simplest PR creation/auth |
| Model (cloud) | **Amazon Bedrock** | In-account inference, data boundary |
| Model (local) | Anthropic API; **Ollama** via OpenShell (V3) | Local/offline path |
| Sandbox | git worktree (V1) → **OpenShell MicroVM** (V2+) | Light local; hardened later |
| Config | TOML + env + profiles | Local/cloud parity via config only |
| IaC (cloud) | Terraform (or CDK) | Reproducible AWS setup |

> TypeScript is a viable alternative (Claude Agent SDK has a TS flavor); Python
> chosen for the broader agent/infra ecosystem. Decision is reversible — it lives
> below the harness boundary.

---

## 7. Proposed repository structure

```
blaid/
├─ docs/
│  ├─ PRD.md
│  ├─ DESIGN.md
│  └─ ARCHITECTURE.md
├─ src/blaid/
│  ├─ cli.py                 # Typer entrypoint: plan, run, status
│  ├─ intake/                # file, github-issue, cli sources → TaskSpec
│  ├─ planner/               # PRD → TaskSpec[]  (+ Gate 1 approval UI)
│  ├─ dispatch/              # queue, routing policy, concurrency
│  ├─ engines/
│  │  ├─ base.py             # Engine Protocol + registry
│  │  ├─ claude_code.py      # V1 engine
│  │  ├─ openshell.py        # V2/V3 engine
│  │  └─ openhands.py        # optional
│  ├─ workspace/             # git worktree lifecycle
│  ├─ verify/                # test/lint runners
│  ├─ publish/               # gh PR creation
│  ├─ models/                # ModelConfig, routing, Bedrock/Ollama wiring
│  ├─ store/                 # SQLite/Dynamo run records
│  └─ types.py               # TaskSpec, RepoRef, Limits, RunResult
├─ infra/                    # Terraform: SQS, ECS/Fargate, IAM, Secrets
├─ config/
│  ├─ local.toml
│  └─ cloud.toml
└─ tests/
```

---

## 8. Interfaces & contracts

- **Engine Protocol** — `run(task, repo, limits) -> RunResult` (DESIGN §4). The
  one contract that must stay stable.
- **Intake → Planner → Dispatcher** pass `TaskSpec` objects only (engine-neutral).
- **ModelConfig** — `{provider, model_id, endpoint, auth_ref}`; resolved by the
  router, injected into `Limits`. Engines consume it; they don't choose models.
- **RunResult** — the only thing engines return; drives PR body + run record.

---

## 9. Security architecture

- **Tool allowlist** per task (`Limits.allowed_tools`); avoid blanket
  skip-permissions outside hardened sandboxes.
- **Branch-only writes:** engines act in a worktree branch; base branch untouched.
- **Secrets:** local → OS keychain/env; cloud → **Secrets Manager** + **IAM task
  role** (e.g. `bedrock:InvokeModel`, scoped `gh` token). No secrets in images.
- **Data boundary:** with Bedrock, inference stays in-account; with local models,
  nothing leaves the host.
- **Network policy (V2):** OpenShell netns/egress rules restrict what sandboxes
  can reach.

---

## 10. Concurrency, scaling, cost

- **Concurrency cap** in the dispatcher (config). Local: small (CPU/RAM bound).
  Cloud: scale Fargate tasks / SQS consumers.
- **Per-task budgets:** `max_tokens`, `max_wall_seconds` enforced by the harness
  (watchdog), independent of the engine.
- **Cost capture:** tokens + compute recorded per run for M4 (cost/task).
- **Backpressure:** queue depth bounded; excess tasks wait.

---

## 11. Failure modes & recovery

| Failure | Behavior |
|---|---|
| Engine error/crash | mark `failed:error`, keep logs, discard worktree |
| Budget exceeded | watchdog kills task → `failed:budget` |
| Tests fail | PR still opened, flagged `failed:tests` (operator decides) |
| No changes produced | `no_changes`, no PR |
| Host/cloud crash mid-run | task remains `queued`/`running` in store; re-dispatch is idempotent (worktree + branch keyed by task id) |
| Partial worktree | teardown is idempotent; orphaned worktrees garbage-collected on startup |

**Invariant:** a failed task never corrupts the base branch (NFR5).

---

## 12. Phased implementation → architecture mapping

| Phase | Build | New components |
|---|---|---|
| **V1** | CLI, file intake, planner+Gate1, SQLite queue, dispatcher, `ClaudeCodeEngine`, worktree, verifier, `gh` publisher, budgets | components 1–10 (local) + Fargate path |
| **V2** | GitHub-issue intake, SQS, EventBridge trigger, `OpenShellEngine`, EC2/EKS MicroVM, DynamoDB/S3 records | cloud queue + OpenShell engine |
| **V3** | routing policy for local models (Ollama/Hermes via OpenShell), GPU EC2 | model router policies |

---

## 13. Build order (suggested first PRs)

1. `types.py` + `Engine` Protocol + registry (the seam first).
2. `ClaudeCodeEngine` happy path: worktree → `claude -p` → tests → `gh` PR.
3. CLI `blaid run <ticket.md>` (single task, no planner).
4. SQLite store + run records + budgets/watchdog.
5. Planner + Gate 1 (`blaid plan <PRD.md>`).
6. Dispatcher concurrency + routing policy stub.
7. Cloud profile: Fargate task def + Bedrock env + IAM (Terraform).
8. (V2) OpenShell engine + SQS + issue intake.
```
