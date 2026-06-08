# Architecture — BLAID v1

> **Status:** Derived from [PRD v0.2](./PRD.md) §7 and the [PR/FAQ](./PRFAQ.md) · 2026-06-07
> **Scope:** Phase 1 (Safe-Mode Launcher). Phase 2 (Magic Folder) reuses `core/sandbox` + `policy/` unchanged.
>
> Diagrams are [Mermaid](https://mermaid.js.org/) — they render natively on GitHub and most Markdown viewers.

---

## 1. System overview

`blaid` is a single static Rust binary that sits **on the host**. It compiles a per-project policy, asks NVIDIA OpenShell to create a least-privilege sandbox, injects credentials + the inference `baseUrl`, then `exec`s the coding agent **inside** the box with the terminal attached. The sandbox is destroyed on exit.

```mermaid
flowchart TB
    Dev([Developer<br/>cd my-project · blaid claude])

    subgraph Host["HOST (your machine)"]
        CLI["blaid CLI<br/>(Rust — single static binary)"]
        Ollama["Local model server<br/>ollama / vLLM<br/>(keyless, local-only)"]
    end

    subgraph Enforce["ENFORCEMENT LAYER — NVIDIA OpenShell"]
        direction TB
        Box["Sandbox<br/>(agent runs here)"]
        Linux["Linux: native Landlock + seccomp<br/><b>full kernel guarantee</b>"]
        VM["macOS / Win: Docker/Podman VM<br/><i>container-grade tier (weaker)</i>"]
        Box --- Linux
        Box --- VM
    end

    Cloud["Anthropic API<br/>api.anthropic.com<br/>(cloud path)"]

    Dev --> CLI
    CLI -- "compiled policy (host-side, FR0a)" --> Box
    Box -- "egress: provider host + registries only" --> Cloud
    Box -- "host bridge — zero-egress mode's ONLY route" --> Ollama

    classDef host fill:#e8f0fe,stroke:#4285f4,color:#000
    classDef enforce fill:#fce8e6,stroke:#ea4335,color:#000
    classDef ext fill:#e6f4ea,stroke:#34a853,color:#000
    class CLI,Ollama host
    class Box,Linux,VM enforce
    class Cloud ext
```

---

## 2. Module architecture (the Rust core)

Everything **above** the `core/sandbox` adapter is pure, OpenShell-free, and unit-testable. Only the adapter imports OpenShell — this is what makes the alpha-churn risk survivable and the test pyramid (§13 of the PRD) possible.

```mermaid
flowchart TB
    subgraph Binary["blaid CLI — Rust static binary"]
        direction TB
        UI["ui/<br/>terminal passthrough · launch summary · deny-log render"]
        Policy["policy/<br/>schema · resolution · project inference (init)<br/>compiles .blaid.yaml ON THE HOST (FR0a)"]
        Inference["inference/<br/>provider interface (v1: anthropic | ollama)<br/>→ derives egress rule + credential + injected baseUrl"]
        Creds["credentials/<br/>host env / keychain lookup → env-var injection<br/>(cloud path only — wedge is keyless)"]
        Adapter["core/sandbox — SandboxAdapter<br/><b>the ONLY module that talks to OpenShell</b>"]

        UI --> Policy
        UI --> Inference
        Policy --> Adapter
        Inference --> Adapter
        Creds --> Adapter
    end

    OpenShell["NVIDIA OpenShell<br/>(gateway + sandbox runtime)"]
    Adapter -->|"fixed, OpenShell-agnostic contract"| OpenShell

    classDef pure fill:#e8f0fe,stroke:#4285f4,color:#000
    classDef boundary fill:#fef7e0,stroke:#fbbc04,color:#000
    classDef alpha fill:#fce8e6,stroke:#ea4335,color:#000
    class UI,Policy,Inference,Creds pure
    class Adapter boundary
    class OpenShell alpha
```

### The adapter contract (the entire OpenShell surface)

```
SandboxAdapter
  create(compiledPolicy)           -> SandboxHandle | EnforcementError   # fail-closed origin (FR0)
  probe(handle)                    -> Ok | EnforcementViolation          # FR0 active check
  exec(handle, argv, env)          -> exitCode                           # terminal attached
  tailDenials(handle)              -> stream<DenyEvent>                  # FR8 deny-log
  hotReloadNetwork(handle, rules)  -> Ok | Err                           # FR9 allow <domain>
  destroy(handle)
```

Above this line: ours, pure, tested with **zero OpenShell**. Below it: mockable. `core/sandbox` + `policy/` is exactly the core Phase 2 (Magic Folder) reuses.

---

## 3. Launch sequence

```mermaid
sequenceDiagram
    actor Dev
    participant CLI as blaid CLI
    participant Pol as policy/
    participant Inf as inference/
    participant Cred as credentials/
    participant Adp as core/sandbox (adapter)
    participant Box as OpenShell sandbox
    participant Agent as Coding agent

    Dev->>CLI: blaid claude
    CLI->>Pol: resolve policy
    Note over Pol: 1. .blaid.yaml (project)<br/>2. ~/.config/blaid/default.yaml<br/>3. built-in default profile
    Pol->>Inf: provider = anthropic | ollama
    Inf-->>Pol: egress rule + credential req + baseUrl
    Pol->>Pol: compile policy ON HOST (FR0a — agent never sees it)
    CLI->>Cred: lookup required credential (cloud path only)
    Cred-->>CLI: ANTHROPIC_API_KEY (or none — keyless wedge)

    CLI->>Adp: create(compiledPolicy)
    Adp->>Box: establish Landlock/seccomp sandbox
    alt enforcement NOT confirmed
        Box-->>Adp: EnforcementError
        Adp-->>CLI: abort
        CLI-->>Dev: ❌ loud, specific error — NO "run anyway" (FR0)
    else enforcement active
        Adp->>Box: probe() — denied read + denied write + denied connect
        Note over Box: any probe SUCCEEDS → EnforcementViolation → abort
        Box-->>Adp: Ok (<100ms)
        CLI-->>Dev: launch summary line (paths, egress, agent, provider/model) (FR5)
        CLI->>Adp: exec(handle, ["claude"], env)
        Adp->>Agent: run inside box, terminal attached
        Agent-->>Dev: interactive session
        Box-->>CLI: deny events stream (FR8)
        Dev->>Agent: exit
        CLI->>Adp: destroy(handle)
    end
```

---

## 4. Policy resolution & the two v1 paths

The user picks an **agent** (runs in the box) and an **inference provider** (where the model runs) — two orthogonal choices. The provider choice *drives* the egress rule and credential automatically; the user never hand-edits host-bridge plumbing.

```mermaid
flowchart TB
    Start([blaid &lt;cmd&gt;]) --> Resolve{Resolve policy}
    Resolve -->|"1"| F1[".blaid.yaml<br/>(committed, reviewed)"]
    Resolve -->|"2"| F2["~/.config/blaid/default.yaml"]
    Resolve -->|"3"| F3["built-in default profile"]

    F1 --> Prov{inference.provider}
    F2 --> Prov
    F3 --> Prov

    Prov -->|anthropic| P1["CLOUD PATH<br/>agent: claude<br/>egress: api.anthropic.com<br/>credential: ANTHROPIC_API_KEY (env var)"]
    Prov -->|ollama| P2["WEDGE / ZERO-EGRESS PATH<br/>agent: openclaw<br/>egress: host model socket ONLY<br/>credential: none (keyless)"]
    Prov -->|other| P3["❌ reject early<br/>'supported in v1: anthropic, ollama'<br/>(FR13/FR14)"]

    P1 --> Launch([compile on host → sandbox → exec])
    P2 --> Launch

    classDef path fill:#e6f4ea,stroke:#34a853,color:#000
    classDef reject fill:#fce8e6,stroke:#ea4335,color:#000
    class P1,P2 path
    class P3 reject
```

> **Zero-egress honesty (§6.2):** local mode means *no direct egress from the sandbox* — the sandbox still reaches the host model process, which itself has host internet. The honest guarantee: exfil now requires abusing the host model path, not a free outbound socket. For a true air-gap, restrict the host model process too. Not marketed as kernel-enforced zero-exfil.

---

## 5. Enforcement tiers by platform

The guarantee is strongest on Linux and explicitly weaker on macOS/Windows — `blaid doctor` reports which tier is active.

```mermaid
flowchart LR
    subgraph LinuxTier["🐧 Linux — full guarantee"]
        L["Landlock + seccomp<br/>against the HOST kernel directly<br/>protected files never exist in the box"]
    end
    subgraph MacWinTier["🍎🪟 macOS / Windows — best-effort"]
        M["sandbox runs in a Linux VM<br/>(Docker Desktop / Podman)<br/>Landlock/seccomp bind the GUEST kernel<br/>host files protected by VM/bind-mount boundary<br/><i>= ordinary container isolation</i>"]
    end
    Doctor["blaid doctor<br/>reports active tier"]
    Doctor --- LinuxTier
    Doctor --- MacWinTier

    classDef strong fill:#e6f4ea,stroke:#34a853,color:#000
    classDef weak fill:#fef7e0,stroke:#fbbc04,color:#000
    class L strong
    class M weak
```

---

## 6. Key invariants

| ID | Invariant | Mechanism |
|----|-----------|-----------|
| **FR0** | Never launch unless enforcement is confirmed active. No "run anyway" path. | `create()` fails closed; active `probe()` inside the fresh box must see denied read **and** write **and** connect, or it aborts. |
| **FR0a** | The agent cannot read or alter the policy that governs it. | Policy is **compiled on the host before the sandbox exists** — the governing file never enters the box. |
| **FR4** | Wedge path is keyless; cloud path injects a session env var only. | Local Ollama needs no credential; `ANTHROPIC_API_KEY` injected as env (never written to disk in-box). |
| **Adapter isolation** | OpenShell alpha churn breaks at most one module. | All OpenShell calls confined behind the fixed `SandboxAdapter` contract. |

---

## 7. Phase 2 reuse boundary

Phase 2 (Magic Folder / AI Dropbox) adds a watcher daemon + processing pipeline + results UX — **zero new security architecture**. It builds entirely on the v1 `core/sandbox` + `policy/` modules; the React/TS UI ships via Tauri (shares the Rust core) or Electron (shells out to the binary).

```mermaid
flowchart LR
    subgraph V1["Phase 1 (this doc) — reusable core"]
        Core["core/sandbox + policy/"]
    end
    subgraph V2["Phase 2 — Magic Folder"]
        Watcher["watcher daemon"]
        Pipe["processing pipeline"]
        UX["results UX (Tauri / Electron)"]
    end
    Watcher --> Core
    Pipe --> Core
    UX --> Core

    classDef core fill:#e8f0fe,stroke:#4285f4,color:#000
    class Core core
```
