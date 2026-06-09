"""Workspace (V1 sandbox): per-task git worktree isolation.

V1 isolation is a host-native git worktree per task — no Docker (PRD R8/NFR2).
Each task gets its own branch + checkout under the work dir; teardown is
idempotent and orphaned worktrees are garbage-collected on startup
(ARCHITECTURE §11). MicroVM/OpenShell isolation arrives as a separate driver in
V2+ behind the same ``WorkspaceManager`` surface.
"""

from blaid.workspace.worktree import WorkspaceError, WorkspaceManager

__all__ = ["WorkspaceManager", "WorkspaceError"]
