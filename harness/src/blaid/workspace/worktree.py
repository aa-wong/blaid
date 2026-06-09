"""Git-worktree workspace manager — the V1 task sandbox.

One worktree + one branch per task, created off a base branch, torn down cleanly.
All operations are idempotent so a crashed/re-dispatched task does not corrupt the
base branch (NFR5) and orphaned worktrees can be reclaimed on startup.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from blaid.types import RepoRef


class WorkspaceError(RuntimeError):
    """A git/worktree operation failed."""


class WorkspaceManager:
    """Manages the lifecycle of per-task git worktrees for a single repo.

    Parameters
    ----------
    repo_root:
        Path to the target git repository Blaid operates on.
    work_dir:
        Directory under which per-task worktrees are created. Defaults to
        ``~/.blaid/work``. Each task gets ``<work_dir>/<task_id>``.
    branch_prefix:
        Prefix for the per-task branch name. Defaults to ``blaid/``.
    """

    def __init__(
        self,
        repo_root: str | Path,
        work_dir: str | Path | None = None,
        branch_prefix: str = "blaid/",
    ) -> None:
        self.repo_root = Path(repo_root).resolve()
        self.work_dir = (
            Path(work_dir).resolve()
            if work_dir is not None
            else Path.home() / ".blaid" / "work"
        )
        self.branch_prefix = branch_prefix

        if not (self.repo_root / ".git").exists():
            raise WorkspaceError(f"{self.repo_root} is not a git repository")
        self.work_dir.mkdir(parents=True, exist_ok=True)

    # -- public API ---------------------------------------------------------

    def branch_for(self, task_id: str) -> str:
        return f"{self.branch_prefix}{task_id}"

    def path_for(self, task_id: str) -> Path:
        return self.work_dir / task_id

    def create(self, task_id: str, base_branch: str) -> RepoRef:
        """Create (or reattach to) an isolated worktree+branch for ``task_id``.

        Idempotent: if the worktree already exists it is reused; if the branch
        exists from a prior run it is reused rather than recreated. Returns a
        ``RepoRef`` pointing the engine at the isolated workspace.
        """
        path = self.path_for(task_id)
        branch = self.branch_for(task_id)

        if self._is_worktree(path):
            # Already checked out for this task — reuse as-is.
            return self._ref(base_branch, path)

        # A leftover non-worktree directory would make `git worktree add` fail.
        if path.exists():
            raise WorkspaceError(
                f"workspace path {path} exists but is not a registered worktree; "
                "remove it or run gc() first"
            )

        if self._branch_exists(branch):
            # Reattach the existing branch into a fresh worktree.
            self._git("worktree", "add", str(path), branch)
        else:
            self._git("worktree", "add", str(path), "-b", branch, base_branch)

        return self._ref(base_branch, path)

    def teardown(self, task_id: str, *, delete_branch: bool = False) -> None:
        """Remove a task's worktree. Idempotent — a no-op if already gone.

        The branch is preserved by default (it carries the work / open PR). Pass
        ``delete_branch=True`` to also drop it, e.g. for a ``no_changes`` run.
        """
        path = self.path_for(task_id)
        if self._is_worktree(path):
            self._git("worktree", "remove", "--force", str(path))
        elif path.exists():
            # Registered worktree gone but a stray dir remains — clean it up.
            shutil.rmtree(path, ignore_errors=True)

        self._git("worktree", "prune")

        if delete_branch:
            branch = self.branch_for(task_id)
            if self._branch_exists(branch):
                self._git("branch", "-D", branch)

    def gc(self) -> list[str]:
        """Reclaim orphaned worktrees on startup. Returns reclaimed task ids.

        Prunes git's worktree registry, then removes any stray directories under
        ``work_dir`` that git no longer tracks as worktrees.
        """
        self._git("worktree", "prune")

        tracked = self._tracked_worktree_paths()
        reclaimed: list[str] = []
        for child in self.work_dir.iterdir():
            if not child.is_dir():
                continue
            if child.resolve() not in tracked:
                shutil.rmtree(child, ignore_errors=True)
                reclaimed.append(child.name)
        return reclaimed

    # -- internals ----------------------------------------------------------

    def _ref(self, base_branch: str, path: Path) -> RepoRef:
        return RepoRef(
            url_or_path=str(self.repo_root),
            base_branch=base_branch,
            workspace_dir=str(path),
        )

    def _git(self, *args: str) -> str:
        proc = subprocess.run(
            ["git", "-C", str(self.repo_root), *args],
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            raise WorkspaceError(
                f"git {' '.join(args)} failed (exit {proc.returncode}): "
                f"{proc.stderr.strip()}"
            )
        return proc.stdout

    def _branch_exists(self, branch: str) -> bool:
        proc = subprocess.run(
            ["git", "-C", str(self.repo_root), "rev-parse", "--verify", "--quiet", branch],
            capture_output=True,
            text=True,
        )
        return proc.returncode == 0

    def _is_worktree(self, path: Path) -> bool:
        return path.resolve() in self._tracked_worktree_paths()

    def _tracked_worktree_paths(self) -> set[Path]:
        """Paths git currently tracks as worktrees (excludes the main checkout)."""
        out = self._git("worktree", "list", "--porcelain")
        paths: set[Path] = set()
        for line in out.splitlines():
            if line.startswith("worktree "):
                p = Path(line[len("worktree ") :]).resolve()
                if p != self.repo_root:
                    paths.add(p)
        return paths
