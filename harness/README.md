# Blaid — harness

Self-hosted autonomous coding harness. Feed it a PRD or a feature ticket; it
decomposes the work, builds each task unattended in an isolated git worktree,
runs your tests, and opens a **pull request** for review.

The human is in the loop at exactly two gates — **plan approval** and **PR
review** — and nowhere else. The harness is the stable layer; engines (Claude
Code in V1; OpenShell/Hermes/Ollama/Codex later) are swappable below the
`Engine` seam.

See [`docs/PRD.md`](./docs/PRD.md), [`docs/DESIGN.md`](./docs/DESIGN.md), and
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full picture.

## Status

Early build. Implemented so far:

- **`blaid.types`** — engine-neutral data model (`TaskSpec`, `RepoRef`, `Limits`,
  `ModelConfig`, `RunResult`).
- **`blaid.workspace`** — the V1 sandbox: per-task git-worktree lifecycle
  (create/teardown/gc), branch-isolated so a failed task never touches the base
  branch. Host-native, no Docker (PRD R8).

Not yet built: engine adapters, planner/Gate 1, dispatcher, verifier, publisher,
store, CLI.

> **Note:** this is currently a **library, not a tool**. There is no `blaid`
> command yet — the end-to-end `blaid run <ticket.md>` flow lands once the engine
> seam and CLI are built. For now you drive the `WorkspaceManager` API directly
> (see Usage).

## Install

```bash
cd harness
python3 -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
pytest                       # 9 passing
```

## Usage

The one component that does real work today is `WorkspaceManager` — it gives a
task an isolated git worktree + branch to build in, then tears it down cleanly.
Anything an engine writes stays on the task branch; the base branch is never
touched.

```python
from blaid.workspace import WorkspaceManager

# point Blaid at a target git repo
wm = WorkspaceManager("/path/to/my-project")          # work_dir defaults to ~/.blaid/work

# create an isolated worktree + `blaid/task-001` branch off main
ref = wm.create("task-001", base_branch="main")
print(ref.workspace_dir)                              # an engine edits files here

# ... engine does its work inside ref.workspace_dir, commits to the task branch ...

wm.teardown("task-001")                               # remove worktree, keep the branch
# wm.teardown("task-001", delete_branch=True)         # also drop the branch (e.g. no changes)

wm.gc()                                               # on startup: reclaim orphaned worktrees
```

Key guarantees:

- **Branch isolation** — edits live on `blaid/<task_id>`; the base branch stays
  clean even if a task crashes (NFR5).
- **Idempotent** — re-`create()` reuses an existing worktree and reattaches an
  existing branch; `teardown()` and `gc()` are safe to call repeatedly.
- **No Docker** — host-native git worktrees (PRD R8).

### Intended CLI (not yet implemented)

```bash
blaid run ticket.md      # one ticket  → build → PR
blaid plan PRD.md        # PRD → task list (Gate 1) → PRs
```

## Layout

```
harness/
├─ docs/                 # PRD, DESIGN, ARCHITECTURE
├─ src/blaid/
│  ├─ types.py           # engine-neutral data model
│  └─ workspace/         # V1 sandbox: git worktree lifecycle
└─ tests/
```
