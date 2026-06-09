"""Engine-neutral data model shared across the harness.

These types are the contract between harness components (intake -> planner ->
dispatcher -> engine -> publisher). They must stay **engine-neutral**: no
Claude-Code prompt formats, tool names, or CLI flags here. Anything tool-specific
lives inside an engine adapter. See DESIGN.md §4.1.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class TaskSpec:
    """One unit of work, normalized from any intake source."""

    id: str
    title: str
    body: str  # the ticket / sub-task description
    acceptance: list[str] = field(default_factory=list)  # acceptance criteria
    scope_hints: list[str] = field(default_factory=list)  # files/dirs likely involved
    kind: str = "issue"  # "issue" | "bug" | "greenfield" | "refactor"
    source: dict = field(default_factory=dict)  # raw origin (path, issue url...) for audit


@dataclass
class RepoRef:
    """A repository plus the isolated workspace an engine should act in."""

    url_or_path: str
    base_branch: str
    workspace_dir: str  # the worktree/sandbox path


@dataclass
class ModelConfig:
    """Provider + model selection, resolved by the router and injected into Limits."""

    provider: str  # "anthropic" | "bedrock" | "ollama" | ...
    model_id: str
    endpoint: str | None = None
    auth_ref: str | None = None  # keychain/secret reference, never the secret itself


@dataclass
class Limits:
    """Per-task guardrails enforced by the harness, independent of the engine."""

    max_tokens: int
    max_wall_seconds: int
    allowed_tools: list[str] = field(default_factory=list)  # tool/command allowlist
    model: ModelConfig | None = None


# Terminal statuses an engine run may report. Kept as a frozenset so callers can
# validate without importing an enum across the engine seam.
RUN_STATUSES = frozenset(
    {
        "pr_open",
        "no_changes",
        "failed:tests",
        "failed:budget",
        "failed:error",
    }
)


@dataclass
class RunResult:
    """The only thing an engine returns; drives the PR body and the run record."""

    task_id: str
    status: str  # one of RUN_STATUSES
    branch: str | None = None
    pr_url: str | None = None
    tests_passed: bool | None = None
    cost_usd: float = 0.0
    tokens: int = 0
    duration_s: float = 0.0
    log_path: str | None = None
