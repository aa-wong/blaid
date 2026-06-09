# Blaid — Design Document

> **Status:** Draft v0.1
> **Date:** 2026-06-08
> **Companion docs:** [PRD.md](./PRD.md), [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 1. Design philosophy

One idea drives everything: **separate the durable harness from the swappable
engine.** Everyone conflates three layers; we keep them apart so V1 decisions
never block the future.

| Layer | Owns | Stability | Examples |
|---|---|---|---|
| **Harness** | intake, planning, dispatch, verify, PR, budgets, observability | **Stable forever** | (this project) |
| **Engine** | one ticket + repo → one PR | **Swappable** | Claude Code, OpenShell, OpenHands |
| **Sandbox + Model** | isolation + inference (usually owned by the engine) | **Swappable** | host worktree / MicroVM; Bedrock / Ollama |

**Rule of the seam:** the harness *never* calls Claude Code directly. It calls
the `Engine` interface. Anything Claude-Code-specific lives *inside* the Claude
Code adapter and never leaks above the seam.

---

## 2. The two gates (PR-gated autonomy)

The human is in the loop at exactly two moments; everything between is unattended:

```
PRD ─► [PLAN] ──Gate 1: approve task list──► [BUILD each task] ──► [PR] ──Gate 2: review──► merge
        (LLM)        (human)                    (autonomous)              (human)
```

- **Gate 1 — Plan approval:** prevents "it built the wrong thing." The planner
  proposes tasks + acceptance criteria; the human edits/approves the list.
- **Gate 2 — PR review:** prevents bad code from merging. Standard PR review.

This is the single most important reliability lever: scoped, approved tasks +
PR review is what makes "walk away" actually safe today.

---

## 3. Component design (harness)

```
┌─ HARNESS (stable) ───────────────────────────────────────────┐
│ 1 Intake      PRD / ticket / issue  → TaskSpec                │
│ 2 Planner     PRD → [TaskSpec...]    ─ Gate 1 (approve)       │
│ 3 Dispatcher  queue + concurrency + local/cloud routing      │
│ 4 ══ Engine interface ══  ◄── the swap point                 │
│ 5 Workspace   git worktree / sandbox per task                │
│ 6 Verifier    run tests / lint, capture results              │
│ 7 Publisher   open PR with context  ─ Gate 2 (review)        │
│ 8 Observability  run records, logs, cost/time caps           │
└───────────────────────────────────────────────────────────────┘
            │ implements
   ┌────────┼───────────────────────┐
 Claude Code     OpenShell(agent)   OpenHands
 (V1)            (V2/V3)            (optional)
```

### 3.1 Intake
Normalizes any source into a `TaskSpec`. Sources: markdown file (watched dir or
explicit path), GitHub issue (label trigger), CLI arg. Keeps raw source for audit.

### 3.2 Planner
For a PRD, an LLM call decomposes it into an ordered list of `TaskSpec`s, each
with **acceptance criteria** and **scope hints** (target files/dirs). Emits the
list for **Gate 1**. For a single ticket, planning is a pass-through (one task).

### 3.3 Dispatcher
Pulls approved tasks from the queue, applies **routing policy** (which engine,
which model, local vs cloud), respects a **concurrency cap**, and hands each task
to an engine. V1 queue = local (SQLite/JSON files); V2 = SQS for cloud.

### 3.4 Engine interface (the seam)
The whole extensibility story. See §4.

### 3.5 Workspace
One **git worktree** per task (V1, host-native, zero Docker) → MicroVM/OpenShell
sandbox (V2+). Guarantees task isolation and clean teardown.

### 3.6 Verifier
Runs the repo's configured test/lint command inside the workspace; results feed
the PR body and the run record. Failing tests don't block PR creation (the human
sees the status) but are flagged.

### 3.7 Publisher
Commits the branch, pushes, and opens a PR (via `gh`) with: linked task,
acceptance criteria, summary of changes, and test/lint results. This is **Gate 2**.

### 3.8 Observability & budgets
Per-task **run record**: status, logs, token + dollar cost, wall-clock, PR link.
**Hard ceilings** on tokens and wall-clock; breach → kill task, discard worktree,
mark `failed:budget`, report.

---

## 4. The Engine contract

The single interface every engine implements. The harness knows only this.

```python
from typing import Protocol

class Engine(Protocol):
    name: str

    def run(self, task: TaskSpec, repo: RepoRef, limits: Limits) -> RunResult:
        """Turn ONE task + repo into a branch with changes (+ optionally a PR).
        Must be self-contained: set up workspace, do the work, respect limits,
        return a structured result. Never mutates the base branch directly."""
        ...
```

### 4.1 Data model (engine-neutral — no engine-isms allowed)

```python
@dataclass
class TaskSpec:
    id: str
    title: str
    body: str                 # the ticket / sub-task description
    acceptance: list[str]     # acceptance criteria
    scope_hints: list[str]    # files/dirs likely involved (optional)
    kind: str                 # "issue" | "bug" | "greenfield" | "refactor"
    source: dict              # raw origin (file path, issue url...) for audit

@dataclass
class RepoRef:
    url_or_path: str
    base_branch: str
    workspace_dir: str        # the worktree/sandbox path

@dataclass
class Limits:
    max_tokens: int
    max_wall_seconds: int
    allowed_tools: list[str]  # tool/command allowlist
    model: ModelConfig        # provider + model id + endpoint

@dataclass
class RunResult:
    task_id: str
    status: str               # "pr_open" | "no_changes" | "failed:tests"
                              # | "failed:budget" | "failed:error"
    branch: str | None
    pr_url: str | None
    tests_passed: bool | None
    cost_usd: float
    tokens: int
    duration_s: float
    log_path: str
```

**Lock-in guard:** `TaskSpec`/`RunResult` must never contain Claude-Code prompt
formats, tool names, or flags. If it's Claude-specific, it lives inside the
adapter.

---

## 5. Engine implementations

### 5.1 ClaudeCodeEngine — V1 (primary)
- Runs `claude` **headless** (`claude -p`) with an `--allowedTools` allowlist and
  `--max-turns`.
- Model: **Anthropic API** locally, **Amazon Bedrock** in cloud
  (`CLAUDE_CODE_USE_BEDROCK=1`) — keeps inference in the user's AWS account.
- Sandbox: **host git worktree** (no Docker locally), per-task.
- Best autonomy quality; the default engine for hard/greenfield work.

```python
class ClaudeCodeEngine:
    name = "claude-code"
    def run(self, task, repo, limits):
        # 1. git worktree add <workspace> -b blaid/<task.id>
        # 2. prompt = render(task)   # task → Claude Code instructions (adapter-local)
        # 3. claude -p prompt --allowedTools <limits.allowed_tools> --max-turns N
        #       (env: CLAUDE_CODE_USE_BEDROCK + ANTHROPIC_MODEL in cloud)
        # 4. run tests; gh pr create
        # 5. return RunResult(...)
```

### 5.2 OpenShellEngine — V2/V3 (multi-agent, multi-model)
One adapter unlocks **all** OpenShell-supported agents (Claude Code, Codex,
OpenCode, Copilot CLI, OpenClaw, **Hermes**, **Ollama**, Pi), parameterized by
agent name. Gives **MicroVM** isolation (answers "Docker is heavy") and a built-in
**inference router** (answers "different models").

```python
class OpenShellEngine:
    name = "openshell"
    def __init__(self, agent):      # "claude" | "hermes" | "ollama" | "codex"
        self.agent = agent
    def run(self, task, repo, limits):
        # openshell inference set --provider <p> --model <m>
        # openshell sandbox create -- <self.agent>   (compute driver: microvm)
        # → tests → gh pr create → RunResult
```

### 5.3 (Optional) OpenHandsEngine
Available as a fallback model-agnostic engine; deferred unless needed.

---

## 6. Model routing strategy

Routing is **per-task policy**, decided by the dispatcher, never hard-coded:

| Task profile | Default route |
|---|---|
| Greenfield, complex refactor, ambiguous | **Claude Code → Bedrock (frontier)** |
| Scoped bug, small issue, cheap iteration | Claude Code → cheaper Claude tier |
| Offline / private / cost-sensitive | **OpenShell → Ollama/Hermes (local)** |

**Honest constraint:** local open models lag frontier models on long-horizon
autonomous work. The router defaults hard tasks to frontier and only sends
narrow/cheap/private work to local inference. Routing Claude Code itself to a
non-Claude model (via Anthropic-compatible shim) is possible but lower quality —
prefer a native-multi-model engine (OpenShell) for that.

---

## 7. Sandbox / isolation strategy

| Phase | Local | Cloud |
|---|---|---|
| **V1** | host **git worktree** + tool allowlist (lightest; no Docker) | Fargate container per task |
| **V2+** | **MicroVM** via OpenShell (Apple virtualization) | OpenShell on EC2/EKS; MicroVM or K8s driver |

Worktrees give isolation + clean teardown with near-zero overhead — ideal for a
trusted solo local host. MicroVM/OpenShell adds kernel-level policy enforcement
(seccomp / Landlock / network namespaces) when stronger isolation is wanted.

---

## 8. Local vs. cloud deployment

The **same binary + same engine** runs in both; only two things change by config:
1. **Where it runs** (your Mac vs. an AWS compute target), and
2. **The model endpoint** (Anthropic API / local Ollama vs. Bedrock).

This is enforced by keeping all environment differences in config, not code.

---

## 9. Safety & guardrails

- **Allowlist, not yolo:** prefer `--allowedTools <list>` over
  `--dangerously-skip-permissions`; only widen for trusted, sandboxed runs.
- **Branch isolation:** engines only ever touch a worktree branch; the base
  branch is never modified directly.
- **Budget ceilings:** token + wall-clock caps per task; breach kills + reports.
- **Two human gates:** plan approval + PR review (no auto-merge in V1).
- **Secrets:** local via env/keychain; cloud via IAM role + Secrets Manager —
  never baked into images.

---

## 10. Key design decisions (with rationale)

| Decision | Choice | Why |
|---|---|---|
| **D1** Engine coupling | Stable `Engine` interface; adapters below it | Lets V1=Claude Code, future=Hermes/open models with no harness rewrite (R7) |
| **D2** V1 engine | Claude Code headless | Best autonomy quality, simplest, runs local + cloud (Bedrock) |
| **D3** V1 sandbox | Host git worktree (no Docker) | Directly answers "Docker is heavy locally" (R8); fine for trusted solo host |
| **D4** Multi-model path | Via OpenShell engine, not Claude Code shim | Native multi-model + MicroVM + Apache-2.0; one adapter unlocks Hermes/Ollama/Codex |
| **D5** Cloud model | Bedrock in user's account | Keeps inference + data in user's AWS boundary (R3, NFR3) |
| **D6** Autonomy | PR-gated, two gates | Only reliable "walk-away" pattern today (R5) |
| **D7** Defer OpenShell to V2 | Build V1 on Claude Code first | OpenShell cloud/GPU is experimental; don't pay that tax while validating MVP |
| **D8** Language | Python (see ARCHITECTURE) | Best ecosystem fit (Agent SDK, LiteLLM, gh, git) |

---

## 11. Alternatives considered

- **SaaS agents (Devin / Codex cloud / Jules / Copilot agent):** rejected — no
  self-host, no local inference, code leaves boundary.
- **Claude Code + LiteLLM proxy for multi-model:** kept as a fallback only;
  quality drop because Claude Code is tuned for Claude.
- **OpenHands as the whole solution:** deferred to optional engine; heavy Docker,
  no PRD pipeline.
- **Build agent loop from scratch:** rejected — re-solves a solved problem.

---

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Autonomy unreliable on vague tasks | Gate 1 task decomposition + acceptance criteria; scope hints |
| Runaway cost | Hard token/time budgets per task |
| OpenShell experimental edges | Keep it V2; Claude Code engine remains the stable default |
| Local model quality gap | Routing policy sends hard work to frontier; local only for narrow tasks |
| Engine lock-in creep | `TaskSpec`/`RunResult` engine-neutral; lint the seam in review |
