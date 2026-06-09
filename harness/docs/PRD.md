# Blaid — Product Requirements Document (PRD)

> **Status:** Draft v0.1
> **Date:** 2026-06-08
> **Owner:** Aaron Wong (aaron@mosaia.io)

---

## 1. Summary

Blaid is a **self-hosted autonomous coding harness**. You feed it a PRD or a
feature ticket; it decomposes the work, executes each task unattended in an
isolated workspace, runs tests, and opens a **pull request** for you to review.
It runs **on your local machine** (for cheap/offline/private work) **and in your
own AWS cloud** (so it can build while you do other things).

The core design goal is **engine independence**: the harness is built around a
stable `Engine` contract. **Claude Code is the V1 engine.** Open-weight models
and other agents (e.g. Hermes, Ollama, Codex via NVIDIA OpenShell) are added
later as additional engine adapters — **without changing the harness**.

---

## 2. Problem statement

A solo developer wants to multiply output by handing well-scoped work to an
autonomous agent and walking away. Existing options each miss something:

- **SaaS autonomous agents** (Devin, OpenAI Codex cloud, Google Jules, GitHub
  Copilot coding agent) can't run locally on your machine, can't use local
  inference, and require your code to live in a vendor's cloud.
- **Raw agent runtimes** (OpenHands, Aider) are model-flexible but ship no
  PRD→ticket pipeline and lean on heavy per-task Docker sandboxes.
- **Building from scratch** wastes effort re-implementing the agent reasoning
  loop, which off-the-shelf tools already do well.

The gap: **a thin, portable harness that orchestrates a swappable engine**,
runs identically on a laptop and in your AWS account, is gated by PR review, and
does not lock you into a single model vendor.

---

## 3. Goals and non-goals

### 3.1 Goals
- **G1** — Turn a PRD or feature ticket into reviewable PRs with no hands-on
  guidance during the build.
- **G2** — Run the **same harness** locally (macOS) and in the user's **own AWS**.
- **G3** — Be **engine-agnostic**: Claude Code in V1; open/local models and other
  agents addable later as adapters with zero harness changes.
- **G4** — Keep the human in control at exactly two points: **plan approval** and
  **PR review** (PR-gated autonomy).
- **G5** — Support four work types: backlog issues, bug fixes, greenfield apps,
  and refactors/maintenance.
- **G6** — Keep code and (optionally) inference inside the user's trust boundary
  (host-local, or AWS Bedrock in the user's account).

### 3.2 Non-goals (for now)
- **NG1** — Not a multi-tenant product or SaaS. Single user, single operator.
- **NG2** — No fully unattended merge/deploy in V1 (human reviews every PR).
- **NG3** — Not building a new agent reasoning loop — we orchestrate existing ones.
- **NG4** — Not guaranteeing frontier-quality results from local open models
  (explicitly a quality/cost tradeoff the user opts into per task).
- **NG5** — No IDE/GUI in V1 — CLI-first.

---

## 4. Target user

**Primary (and only) persona — "The Solo Builder" (Aaron):**
- Technically strong; comfortable with CLI, git, AWS, Docker/microVMs.
- Wants to offload scoped engineering so he can work in parallel.
- Cares about cost control, data boundaries, and avoiding vendor lock-in.
- Will personally review every PR before merge.

---

## 5. Requirements (gathered)

These were confirmed during requirements gathering and drive the design.

| # | Requirement | Source decision |
|---|---|---|
| R1 | Accept **PRDs and feature tickets** as input and construct working code | "take my PRDs and feature tickets … construct something" |
| R2 | Run **locally** (incl. ability to use **local inference**) | "run this on my local machine using local inference" |
| R3 | Run in the **cloud** so it builds while the user does other work | "run this on the cloud so it can build and code while I'm doing other things" |
| R4 | Handle **issues, bug fixes, greenfield apps, refactors/maintenance** | work-type multi-select |
| R5 | **PR-gated** autonomy (work autonomously, human reviews PR before merge) | autonomy = PR-gated |
| R6 | **Personal/solo** scope | scope = personal/solo |
| R7 | **Model-agnostic** path: Claude Code now, open models / Hermes later | follow-up Q&A |
| R8 | Avoid heavy local Docker where possible (prefer host-native or microVM) | "Docker containers are very heavy to run locally" |

---

## 6. User stories

- **US1** — *As the solo builder, I drop a PRD markdown file into a watched
  folder, approve the proposed task breakdown, then walk away and come back to a
  set of PRs.*
- **US2** — *As the solo builder, I label a GitHub issue `blaid:go` and the
  cloud instance picks it up, builds a fix, runs tests, and opens a PR.*
- **US3** — *As the solo builder, I run a cheap refactor offline on my laptop
  using a local model, with no data leaving my machine.*
- **US4** — *As the solo builder, I route a hard greenfield task to Claude Code
  on Bedrock and a trivial cleanup to a local model — same harness, one config
  flag.*
- **US5** — *As the solo builder, I set a per-task token/time budget so a runaway
  task is killed and reported rather than silently burning money.*

---

## 7. Functional requirements

- **F1 — Intake:** ingest a task from (a) a markdown PRD/ticket file, (b) a
  GitHub issue (label-triggered), (c) a CLI argument. Normalize into a `TaskSpec`.
- **F2 — Planning:** for a PRD, an LLM step decomposes it into an ordered task
  list with acceptance criteria. Present for **human approval (Gate 1)**.
- **F3 — Dispatch:** enqueue approved tasks; run locally or in cloud; respect a
  concurrency limit.
- **F4 — Engine execution:** invoke the configured `Engine` to turn one task +
  repo into a branch with changes. Engines are pluggable behind one interface.
- **F5 — Isolation:** each task runs in its own git worktree / sandbox; tasks do
  not interfere.
- **F6 — Verification:** run the repo's tests/lint inside the workspace; capture
  results into the run record.
- **F7 — PR creation:** open a PR with task context, what changed, and test
  results. This is **Gate 2 (human review)**.
- **F8 — Model routing:** select the model/provider per task (e.g. Claude on
  Bedrock vs. local Ollama), via config/policy.
- **F9 — Observability:** persist a run record per task (logs, status, cost,
  duration, links).
- **F10 — Guardrails:** enforce per-task token, wall-clock, and tool/command
  allowlists; kill and report on breach.

---

## 8. Non-functional requirements

- **NFR1 — Portability:** identical harness + engine behavior locally and in AWS;
  only deployment target and model endpoint differ by config.
- **NFR2 — Lightweight local footprint:** no mandatory heavy Docker locally; host
  worktrees (V1) or microVM (later) preferred on macOS.
- **NFR3 — Data boundary:** code stays on host (local) or in the user's AWS
  account; cloud inference via Bedrock in-account (no third-party API egress when
  configured).
- **NFR4 — Cost control:** hard per-task budget ceilings; visible spend per run.
- **NFR5 — Recoverability:** a crashed/killed task leaves a clean repo (worktree
  discarded), never a half-merged main branch.
- **NFR6 — Extensibility:** adding an engine = one adapter implementing `Engine`;
  no changes above the engine seam.
- **NFR7 — Auditability:** every run is reproducible from its stored `TaskSpec`
  + config + logs.

---

## 9. Success metrics

- **M1** — % of approved tasks that produce a PR that passes tests without manual
  fixes (target V1: ≥ 50% for scoped bug/issue tasks).
- **M2** — Median hands-off wall-clock per task (intake-approved → PR open).
- **M3** — Median reviewer effort per PR (subjective 1–5; lower is better).
- **M4** — Cost per completed task (tokens + compute).
- **M5** — Time to add a new engine adapter (target: < 1 day for OpenShell).

---

## 10. Constraints and assumptions

- **C1** — Single operator; no auth/multi-user needed in V1.
- **C2** — macOS (Apple Silicon) locally; AWS for cloud.
- **C3** — Claude Code is Claude-only natively; non-Claude models for the
  Claude Code engine require an Anthropic-compatible shim and incur a quality
  hit. Native multi-model comes via other engines (OpenShell agents).
- **C4** — OpenShell's cloud (Helm) and GPU passthrough are flagged experimental;
  treat as V2+ maturation risk.
- **A1** — The user trusts the local host enough to run host-native worktrees
  without microVM isolation in V1.
- **A2** — Target repos use git and have a runnable test command.

---

## 11. Roadmap / phasing

| Phase | Scope | Engine | Sandbox | Where |
|---|---|---|---|---|
| **V1 — Walk-away MVP** | Intake (file + CLI), planner, dispatch, verify, PR, budgets | **Claude Code** (headless) | host git worktree | local (Mac) + Fargate |
| **V2 — Hardened cloud** | GitHub-issue intake, SQS queue, concurrency, OpenShell engine | Claude Code **inside OpenShell** | **MicroVM** / K8s | local + AWS (EKS/EC2) |
| **V3 — Multi-model** | Per-task model routing policy | **OpenShell** w/ Hermes / Ollama / Codex | MicroVM | local + AWS |

**Guiding principle:** V1 ships fast on Claude Code; V2/V3 are *additive*
adapters behind the `Engine` interface, not rewrites.

---

## 12. Open questions

1. **Target stacks/languages** of the repos Blaid will work on (affects test
   runner + sandbox images)?
2. **Where do tickets live** long-term — markdown files, GitHub Issues, Linear?
3. **Local hardware** specs (Mac RAM/GPU) — bounds which local models are viable.
4. **Cloud budget** ceiling (compute + tokens) — bounds concurrency + model tier.
5. **Concurrency** — one task at a time, or N parallel cloud builds?
6. **Default model routing policy** — what goes to Claude vs. local by default?

---

## 13. Out-of-scope alternatives considered

- **Buy a SaaS agent (Devin/Codex/Jules/Copilot agent):** rejected — can't self-host,
  no local inference, code leaves user boundary (violates R2/R3).
- **OpenHands as the whole product:** deferred — great engine, but heavy Docker
  sandbox and no PRD pipeline; may appear as an optional engine later.
- **Build the agent loop from scratch:** rejected — re-implements solved work.
