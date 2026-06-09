"""Lifecycle tests for the git-worktree workspace manager.

Each test builds a throwaway git repo in a tmp dir and drives real ``git``.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from blaid.workspace import WorkspaceError, WorkspaceManager


def _run(cwd: Path, *args: str) -> None:
    subprocess.run(args, cwd=cwd, check=True, capture_output=True, text=True)


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """A git repo with one commit on ``main``."""
    root = tmp_path / "repo"
    root.mkdir()
    _run(root, "git", "init", "-b", "main")
    _run(root, "git", "config", "user.email", "test@example.com")
    _run(root, "git", "config", "user.name", "Test")
    (root / "README.md").write_text("hello\n")
    _run(root, "git", "add", ".")
    _run(root, "git", "commit", "-m", "init")
    return root


@pytest.fixture
def manager(repo: Path, tmp_path: Path) -> WorkspaceManager:
    return WorkspaceManager(repo, work_dir=tmp_path / "work")


def test_rejects_non_repo(tmp_path: Path) -> None:
    with pytest.raises(WorkspaceError):
        WorkspaceManager(tmp_path / "not-a-repo")


def test_create_makes_branch_and_worktree(manager: WorkspaceManager, repo: Path) -> None:
    ref = manager.create("t1", base_branch="main")

    assert ref.url_or_path == str(repo)
    assert ref.base_branch == "main"
    ws = Path(ref.workspace_dir)
    assert ws.is_dir()
    assert (ws / "README.md").exists()

    branch = subprocess.run(
        ["git", "-C", str(ws), "rev-parse", "--abbrev-ref", "HEAD"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    assert branch == "blaid/t1"


def test_branch_isolation_keeps_base_clean(manager: WorkspaceManager, repo: Path) -> None:
    ref = manager.create("t2", base_branch="main")
    ws = Path(ref.workspace_dir)

    (ws / "new.txt").write_text("work\n")
    _run(ws, "git", "add", ".")
    _run(ws, "git", "commit", "-m", "agent work")

    # The base checkout never sees the agent's commit.
    assert not (repo / "new.txt").exists()
    main_log = subprocess.run(
        ["git", "-C", str(repo), "log", "--oneline", "main"],
        capture_output=True, text=True, check=True,
    ).stdout
    assert "agent work" not in main_log


def test_create_is_idempotent(manager: WorkspaceManager) -> None:
    first = manager.create("t3", base_branch="main")
    second = manager.create("t3", base_branch="main")
    assert first.workspace_dir == second.workspace_dir


def test_create_reattaches_existing_branch(manager: WorkspaceManager) -> None:
    ref = manager.create("t4", base_branch="main")
    ws = Path(ref.workspace_dir)
    (ws / "x.txt").write_text("x\n")
    _run(ws, "git", "add", ".")
    _run(ws, "git", "commit", "-m", "wip")

    manager.teardown("t4")  # branch preserved
    again = manager.create("t4", base_branch="main")

    # Reattached to the same branch — the prior commit survives.
    assert (Path(again.workspace_dir) / "x.txt").exists()


def test_teardown_removes_worktree_keeps_branch(manager: WorkspaceManager, repo: Path) -> None:
    ref = manager.create("t5", base_branch="main")
    ws = Path(ref.workspace_dir)
    assert ws.exists()

    manager.teardown("t5")
    assert not ws.exists()

    branch_exists = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "--verify", "--quiet", "blaid/t5"],
        capture_output=True, text=True,
    ).returncode == 0
    assert branch_exists


def test_teardown_is_idempotent(manager: WorkspaceManager) -> None:
    manager.create("t6", base_branch="main")
    manager.teardown("t6")
    manager.teardown("t6")  # no raise


def test_teardown_delete_branch(manager: WorkspaceManager, repo: Path) -> None:
    manager.create("t7", base_branch="main")
    manager.teardown("t7", delete_branch=True)

    branch_exists = subprocess.run(
        ["git", "-C", str(repo), "rev-parse", "--verify", "--quiet", "blaid/t7"],
        capture_output=True, text=True,
    ).returncode == 0
    assert not branch_exists


def test_gc_reclaims_orphaned_dirs(manager: WorkspaceManager) -> None:
    ref = manager.create("t8", base_branch="main")
    ws = Path(ref.workspace_dir)

    # Simulate a crash: the worktree dir is gone but git's registry is stale.
    import shutil
    shutil.rmtree(ws)
    # And a stray dir that was never a worktree.
    stray = manager.work_dir / "stray"
    stray.mkdir()
    (stray / "junk").write_text("junk\n")

    reclaimed = manager.gc()
    assert "stray" in reclaimed
    assert not stray.exists()
