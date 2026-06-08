# PRD — BLAID v1: Safe-Mode Launcher

> **Status:** Draft v0.2 · 2026-06-04 — reviewed (CEO + Eng)
> **Companion doc:** [PR/FAQ](./PRFAQ.md)
> **Phase:** 1 of 2 — Phase 2 (Magic Folder / AI Dropbox) summarized in §10.
>
> **Review history & locked decisions:**
> - **CEO review** (Selective Expansion → net contraction). Sharpened to the sensitive-codebase wedge (§3). **Scope contracted to two validated paths** — Claude+Anthropic (demo) and OpenClaw+Ollama zero-egress (wedge); everything else deferred. **Linux-first**, Mac/Win labeled best-effort (§6.2). An independent outside voice drove the contraction + several threat-model fixes.
> - **Eng review.** **Language: Rust core**, React/TS UI (Tauri/Electron) in Phase 2 (§7). **Credentials: keyless wedge + env-var cloud, egress-proxy deferred** (FR4). Adapter contract locked (§7). FR0 active probe = 3 enforcement domains. FR0a = compile-policy-on-host. Test strategy added (§13). Open eng spike: OpenShell's Linux-native network model before host-bridge code (open-Q #14).

---

## 1. Problem

Developers running coding agents (Claude Code, aider, Codex CLI) face a forced trade-off:

- **Supervised mode:** approve every file write and shell command → permission fatigue, agent autonomy wasted.
- **Unsupervised mode** (`--dangerously-skip-permissions` etc.): the agent inherits the developer's full ambient authority — every file in `$HOME`, every credential on disk, unrestricted network egress. A single prompt injection in a dependency README can exfiltrate `~/.ssh` or `.env`.

NVIDIA OpenShell solves the enforcement problem (kernel-level sandboxing with YAML policies) but leaves real friction: policies are hand-written, sandbox lifecycle is manual, and credentials must be wired up per-session. That friction is the product gap.

## 2. Goal

**One command that launches a coding agent with full autonomy inside a least-privilege sandbox.**

```bash
cd my-project
blaid claude
```

Success means a developer trusts the agent to run unattended *because* of the sandbox, not despite the lack of one.

### Non-goals (v1)

- **Providers beyond `anthropic` + `ollama`** — OpenAI, Gemini, Vertex, vLLM, openai-compatible are deferred to a post-v1 "more providers" milestone (CEO review scope decision). The provider *architecture* ships; the *supported surface* is two paths.
- **Google ADK and any agent beyond `claude` + `openclaw`** — deferred with the provider matrix. `blaid <any-cmd>` still technically sandboxes other CLIs, but they are not validated/supported paths in v1.
- **`blaid verify` for non-shipped providers** — verify covers the two v1 paths.
- GUI / menu-bar app (Phase 2+)
- Watcher daemon or any long-running background process (Phase 2 — Magic Folder)
- Policy marketplace or template gallery beyond built-ins
- Multi-sandbox orchestration (e.g., writer + reviewer agents)
- **Full kernel-enforcement guarantee on macOS/Windows** — v1 is **Linux-first** (Landlock/seccomp against the host kernel). macOS/Windows ship as best-effort container-grade isolation, **explicitly labeled** as the weaker tier (§6.2); closing that gap is post-v1.
- Sandboxing GUI applications
- Solving the Docker-on-macOS install dependency (documented prerequisite where Mac/Win are used)

## 2.5 Prior art & positioning

The closest comparable is **NVIDIA NemoClaw** — NVIDIA's own reference stack that runs agents inside OpenShell. It is genuinely the prior art to reckon with, not a strawman: it ships a single CLI, a hardened policy blueprint, managed/routed inference, network egress policy, and lifecycle management — overlapping much of this PRD. It reached early preview in March 2026 (Apache 2.0).

**Why BLAID still has a wedge.** BLAID and NemoClaw sit at the same layer (opinionated launcher on OpenShell) but aim at opposite ends of the agent/model/hardware spectrum:

| | **NemoClaw** | **BLAID (this PRD)** |
|---|---|---|
| Default agent | OpenClaw / Hermes | Claude Code |
| Default inference | NVIDIA NIM / Nemotron | Anthropic API |
| Model stance | NVIDIA-stack first | Architecturally vendor-neutral; **v1 ships Anthropic cloud + local Ollama**, more providers on the roadmap |
| Hardware floor | NVIDIA GPU (RTX / DGX) for the managed path | Plain laptop; no GPU required |
| Primary user | Enterprise deploying always-on agents on NVIDIA infra | Individual developer sandboxing a coding agent |
| Surface | Full stack (onboarding, observability, lifecycle) | Thin, fast, one-command launcher |

**What we borrow vs. where we diverge.** NemoClaw is Apache 2.0, so its hardened policy blueprint and managed-inference routing are reference designs to study rather than reinvent. We diverge deliberately on three axes: (1) **Claude Code on a Mac with no GPU** as the default experience, (2) **vendor-neutral inference** as a first-class feature (§6.1) rather than NVIDIA-stack gravity, and (3) **minimal surface** — a launcher, not a platform.

**Strategic read.** The launcher itself is the *wedge*, not the moat. If NVIDIA (or anyone) ships an equivalent generic launcher, we adopt it under our adapter and our value moves up-stack: per-project policy conventions, the Phase 2 Magic Folder, and Mosaia platform integration (platform agents running safely on local files). NemoClaw existing is evidence the problem is real and the architecture is sound — it validates the bet more than it threatens it.

## 3. Target user

**Primary (the wedge): the developer who can't safely run an agent today.** Regulated codebases (health, finance, gov), client-owned IP under NDA, or repos sitting next to secrets on disk. For this user autonomous agents are currently off-limits or a policy violation, so containment isn't a convenience, it's the thing that unlocks using agents at all. The zero-egress local mode (§6.1) is aimed squarely here: the code never leaves the machine, and the sandbox enforces it rather than the user trusting a vendor's data policy.

**Secondary: the general CLI-agent developer** who feels permission fatigue or unease about unsupervised runs and wants `--dangerously-skip-permissions`-level autonomy without the danger.

Both have Docker/Podman installed (or run Linux) and are comfortable with a CLI tool and a YAML file. v1 messaging and the default feature set lead with the primary wedge; the secondary user gets the same product with a cloud-default profile.

## 4. User stories

1. As a developer, I run `blaid claude` in a repo and get a Claude Code session that can only see that repo, so I can let it run unattended.
2. As a developer, I run `blaid init` to generate a reviewable `.blaid.yaml` policy for my project, so my team can audit agent permissions in code review.
3. As a developer, when the agent needs a new API mid-session, I run `blaid allow api.example.com` and the running sandbox picks it up without restart.
4. As a developer, I run `blaid log` after a session to see every access the agent attempted that was denied.
5. As a developer, I run `blaid claude` in a repo with a committed `.blaid.yaml` written by a teammate, and it Just Works with their reviewed policy.
6. As a developer, I run `blaid <any-command>` to sandbox a different agent or an untrusted script with the same guarantees.
7. As a privacy-conscious developer, I run `blaid --provider ollama openclaw` to drive an open-source agent with a local open-source model, so that no code or prompt ever leaves my machine — and the sandbox network policy enforces it, not just my trust.
8. As a developer, I choose between the two v1 paths — Claude Code on Anthropic (cloud, best quality) or OpenClaw on local Ollama (private, zero-egress) — per project via `.blaid.yaml`, without learning OpenShell or sandbox-networking internals.

*(Post-v1 stories — additional providers, Google ADK, and other agents — are tracked in Non-goals / the "more providers" milestone.)*

## 5. UX — CLI surface

| Command | Behavior |
|---|---|
| `blaid <cmd> [args…]` | Resolve policy (see §6) → create sandbox → inject credentials → exec `<cmd>` inside, attached to the terminal. Sandbox is destroyed on exit. |
| `blaid --provider <p> <cmd>` | Override the inference provider for this run (`anthropic`/`openai`/`ollama`/`vllm`/`openai-compatible`). E.g. `blaid --provider ollama openclaw`. Derives egress + credentials per §6.1. |
| `blaid init` | Inspect the project (lockfiles, toolchain, git remotes) and write a commented `.blaid.yaml`. **Prompts for agent + inference provider** (detects a running Ollama/vLLM on the host and offers it). Interactive confirm for anything beyond defaults. |
| `blaid providers` | List available inference providers, which are reachable right now (e.g. detects host Ollama/vLLM, checks which API keys are present), and the agent×provider compatibility matrix. |
| `blaid verify [--ci]` | **Dry run.** Resolve the policy and print exactly what it permits — every filesystem path (with rw/ro), every reachable egress host, which credentials inject, and the agent×provider validity — WITHOUT launching the agent. Exits non-zero on an invalid or over-broad policy (e.g. wildcard egress, home-dir access). `--ci` makes it a commit gate for `.blaid.yaml`. Reuses the launch-summary engine (FR5). |
| `blaid allow <domain>` | Append to the network allowlist and hot-reload the running sandbox's network policy. |
| `blaid log [--follow]` | Show policy-denial events for the current/most recent session. |
| `blaid doctor` | Check prerequisites (OpenShell installed, Docker/Podman reachable, version compatibility) and print fixes. |

**Zero-config path:** with no `.blaid.yaml` present, `blaid claude` uses the built-in default profile (see §6) and prints a one-line summary of the granted permissions at launch. `init` is recommended, never required.

## 6. Policy model

### Resolution order
1. `.blaid.yaml` in the project root (committed, reviewed)
2. `~/.config/blaid/default.yaml` (user defaults)
3. Built-in default profile

### `.blaid.yaml` (draft schema)

```yaml
version: 1
agent:
  command: claude          # which agent runs in the sandbox: claude | openclaw | hermes | aider | <custom>
inference:
  provider: anthropic      # anthropic | openai | ollama | vllm | openai-compatible
  model: claude-opus-4-8   # provider-specific model id
  # endpoint: …            # required for local/openai-compatible; see §6.1
filesystem:
  allow:
    - .                    # project root (always implied)
    - ~/.gitconfig:ro      # extra paths, optional :ro suffix
network:
  allow:
    - registry.npmjs.org   # the inference provider's host is added AUTOMATICALLY (see §6.1)
credentials:
  - ANTHROPIC_API_KEY      # injected from host keychain/env at launch; never written to disk in-sandbox
```

> **Key principle:** the `inference.provider` choice *drives* the network and credential rules. The user picks a provider; BLAID derives the egress allow-rule and required credential automatically, so users never hand-edit `host.docker.internal` plumbing or remember which domain a provider lives at. The `network.allow` list is for *additional* destinations the agent needs (registries, APIs), not the model endpoint.

### Built-in default profile
- **Agent:** `claude` (Claude Code).
- **Inference:** `anthropic` (cloud) — best quality, the default.
- **Filesystem:** project root (rw); nothing else.
- **Network:** provider host (auto), plus the package registry inferred from lockfiles present (npm/PyPI/crates.io/Go proxy).
- **Process:** OpenShell defaults (seccomp, unprivileged).
- **Credentials:** the provider's key (`ANTHROPIC_API_KEY`) from host env; none for local providers.

`blaid init` materializes this inference into a commented file rather than leaving it implicit.

## 6.1 Inference backends — agent × provider

BLAID separates **two orthogonal choices**, so the user can mix and match:

1. **Agent** — the CLI that runs inside the sandbox (`agent.command`): Claude Code, OpenClaw, Hermes, aider, or any custom command.
2. **Inference provider** — where the model actually runs (`inference.provider`): a cloud API or a local server.

The provider model is the *architecture* — the abstraction that makes "any agent + any model" possible. But **v1 ships only two validated paths** (CEO review, scope decision). The architecture is built to extend; the supported surface is deliberately narrow so every shipped cell is tested, not theoretical.

**v1 supported paths (the only two QA'd and supported at launch):**

| Agent | Provider | Why it's in v1 | Egress / credential |
|---|---|---|---|
| `claude` (Claude Code) | `anthropic` | The "it just works," best-quality demo. | allow `api.anthropic.com` · `ANTHROPIC_API_KEY` |
| `openclaw` | `ollama` (local) | **The wedge:** zero-egress, fully local, for the sensitive-codebase user. | host model socket only · no credential |

**Deferred to a post-v1 "more providers" milestone** (architecture supports them; they are NOT supported/tested in v1 — see Non-goals):

| `provider` | Where the model runs | Why deferred |
|---|---|---|
| `openai` | OpenAI cloud | Trivial via openai-compatible, but adds a QA cell without serving the wedge. |
| `gemini` | Google AI Studio | Serves ADK, which is itself deferred. |
| `vertex` | Google Vertex AI | ADC is file-based — **contradicts the no-disk claim** until open-Q #11 is resolved. Explicitly out of v1. |
| `vllm` | Host machine | Ollama covers the local wedge; vLLM is a throughput optimization for later. |
| `openai-compatible` | Any URL | Useful escape hatch, but unbounded QA surface; add once the core is proven. |

**Agent ↔ provider compatibility (for when the deferred paths land):** OpenClaw/Hermes natively support local + OpenAI-compatible providers (OpenClaw uses native `/api/chat` for reliable tool-calling). Claude Code is built for the Anthropic API; pairing it with non-Anthropic providers needs a shim (FR16, deferred). Google **ADK** agents (a *framework*, not a finished agent — you'd sandbox your own `adk run ./my_agent`) map onto the provider list via LiteLLM, with the `adk web` port-exposure wrinkle (open-Q #10). **All of ADK and the multi-provider matrix are post-v1.** `blaid` validates the agent×provider pair at launch and errors early on any unsupported combination.

**The host-bridge detail (local providers).** Ollama/vLLM run on the *host*; the agent runs *inside* the sandbox, where `localhost` is the sandbox's own loopback. BLAID's adapter resolves the host gateway (`host.docker.internal` on Docker Desktop, the bridge gateway IP on Linux) and injects the correct `baseUrl` into the agent's config **and** the matching single egress allow-rule. The user just writes `provider: ollama`; the plumbing is BLAID's job. For OpenClaw specifically, the adapter uses the native `/api/chat` provider (reliable streaming + tool-calling) rather than the OpenAI-compatible mode, whose tool-calling is documented as unreliable.

**Fully-local / zero-egress profile.** `provider: ollama` + an empty `network.allow` yields a configuration where the *only* permitted network path is the host model socket — no internet, no cloud API. The agent can read the project and reason about it, but there is no route for code or data to leave the machine. This is the strongest expression of the privacy promise and the recommended setup for sensitive codebases (the primary wedge, §3). Honest trade-off, to be stated plainly in docs: open-source models are weaker on long, tool-heavy agentic loops, so expect more retries and lower task-completion than cloud Claude.

## 6.2 Threat model — what BLAID does and does NOT protect against

A security tool that overstates its guarantees is worse than none — users relax exactly where they shouldn't. So the boundary is explicit. *(Added per CEO review.)*

**In scope (what containment buys you):**
- An agent — even one hijacked by prompt injection in a file, dependency, or model output — cannot read files outside the declared paths (Landlock), cannot reach network destinations outside the allowlist (egress policy), and cannot escalate privilege (seccomp + unprivileged identity).
- With the zero-egress profile, there is no network path for code/prompts/secrets to leave the machine, regardless of what the agent is tricked into attempting.
- Failed attempts are denied **and logged** (FR8), so exfiltration attempts are visible events, not silent breaches.

**Out of scope (explicitly NOT protected) — and the mitigation:**
- **Exfiltration through an *allowed* destination.** If egress to `api.anthropic.com` (or any allowed host) is open, a determined agent can encode data into requests to it. Mitigation: zero-egress profile for sensitive work; keep allowlists minimal; `verify` (FR17) flags broad allowlists.
- **The host model socket is itself a trusted exception (corrects the "zero-egress" framing).** In "zero-egress" local mode the sandbox still reaches the host Ollama/vLLM process — and *that* process has unrestricted host internet. So zero-egress means "no *direct* egress from the sandbox," not "no possible exfil": a hijacked agent could encode data into prompts the host model process (or a compromised/instrumented model) then forwards. The honest guarantee is that exfil now requires compromising or abusing the host model path, not a free outbound socket. Mitigation: run the host model process itself under firewall/egress restriction for true air-gap; document this exception in the user-facing security model. **Do not market local mode as kernel-enforced zero-exfil.**
- **The policy file is writable by the agent.** With project root rw, the agent can edit `.blaid.yaml` itself — loosening *its next run's* sandbox, or poisoning a policy a teammate later pulls. Mitigation: **BLAID mounts the resolved `.blaid.yaml` read-only inside the sandbox (or reads it out-of-tree before sandbox creation), so the running agent cannot alter the policy that governs it.** This is a P0 invariant, not an option.
- **A malicious or compromised model endpoint.** If you point inference at a hostile server, it sees your prompts (which include code). Mitigation: local providers, or trusted endpoints only.
- **Credential exposure within the sandbox.** Injected credentials are env vars — readable by any process *inside* the box and capable of leaking into logs/crash dumps/child processes. Containment stops them leaving the box (no egress) but does not hide them from the agent. The "never written to disk" claim is accurate but narrow; it is **not** "the agent can't see the key." Mitigation: scope/short-life credentials; zero-egress; prefer local providers that need no key.
- **Kernel or container-runtime escapes.** BLAID inherits OpenShell/Landlock/seccomp/Docker's isolation; a 0-day below that line is out of scope. Mitigation: keep host patched; `doctor` warns on outdated runtimes.
- **The guarantee is strongest on Linux and weaker on macOS/Windows — state this plainly.** Landlock + seccomp are Linux-kernel features. On Linux the enforcement is against the host kernel directly. On macOS/Windows the sandbox runs inside a Linux VM (Docker Desktop/Podman), so: (a) Landlock/seccomp constrain the *guest* kernel, and (b) the host files we promise to protect (`~/.ssh`, browser cookies, other projects) sit *outside* the VM, protected by the VM/bind-mount boundary — i.e. ordinary container isolation, not the differentiated kernel enforcement the pitch leans on. This is honest and material: **the flagship "Claude Code on a Mac" demo gets the weaker guarantee.** Mitigation/strategy: see the Linux-first question in §11; `doctor` reports which enforcement tier is actually active so the user knows what they're getting.
- **Supply-chain code that runs within policy.** A malicious npm/PyPI package the agent installs runs inside the sandbox with the sandbox's permissions (npm postinstall scripts run arbitrary code) — contained, but not stopped. Note the registry being the only allowed host is *weak* reassurance: any open model-API egress is a perfectly good encode-into-prompts exfil channel, and the registry endpoint itself serves agent-chosen packages. Mitigation: zero-egress local mode is the only configuration that meaningfully contains this; otherwise the package shares whatever egress the agent has.
- **OpenShell alpha defects.** The enforcement layer is alpha. The fail-closed invariant (FR0) ensures a *known* enforcement failure aborts launch; it cannot defend against an enforcement bug that silently under-applies a policy. Mitigation: version pinning (§11), CI against OpenShell, deny-log spot-checks.

This section ships in user-facing docs (a "Security model" page), not just the PRD.

## 7. Architecture

```
blaid CLI  (Rust — single static binary)
  ├── policy/        # schema, resolution, project inference (init); compiles .blaid.yaml
  │                  #   ON THE HOST before sandbox creation (policy never enters the box → FR0a)
  ├── inference/     # provider interface — v1: anthropic | ollama (flat, NOT a plugin system)
  │                  #   → derives egress rule + credential + injected baseUrl
  ├── core/sandbox   # ADAPTER: the ONLY module that imports/talks to OpenShell (see contract below)
  ├── credentials/   # host env lookup → env-var injection (cloud path only; wedge is keyless)
  └── ui/            # terminal passthrough, launch summary, deny-log rendering
            │
            ▼
   NVIDIA OpenShell (gateway + sandbox)         ┌──────────────────────────┐
            │                                   │ Host: ollama (local only)│
            ▼                                   │  keyless — no credential │
   Linux: native Landlock+seccomp (full     ◀──┤  reached via host bridge │
   guarantee) · macOS/Win: Docker/Podman    eg │  (see Linux-native note)  │
   VM (container-grade, labeled tier)       ↑  └──────────────────────────┘
                                  only egress rule in zero-egress mode
```

**Language (locked, eng review):** **Rust** for the v1 core/CLI — matches OpenShell (shared types/FFI possible), ships one trustworthy static binary with no runtime dependency, memory-safe (it's a security tool). The Phase-2 Magic Folder UI will be **React/TS via Tauri** (shares the Rust core) or Electron (shells out to the binary) — choosing Rust now does not block a JS/React frontend later; the UI is a separate frontend over the Rust engine. *(Resolves open-Q #1.)*

**Design rule:** OpenShell is alpha; its CLI and policy format will churn. All OpenShell interaction is confined to the `core/sandbox` adapter behind a fixed, OpenShell-agnostic contract:

```
SandboxAdapter  — the ENTIRE OpenShell surface; nothing else imports openshell
  create(compiledPolicy)        -> SandboxHandle | EnforcementError   # fail-closed origin (FR0)
  probe(handle)                 -> Ok | EnforcementViolation          # FR0 active check (below)
  exec(handle, argv, env)       -> exitCode                           # terminal attached
  tailDenials(handle)           -> stream<DenyEvent>                  # FR8
  hotReloadNetwork(handle, rules) -> Ok | Err                         # FR9
  destroy(handle)
```

Everything *above* this line — policy compilation, provider derivation, credential brokering — is ours, pure, and unit-testable with **zero OpenShell**. Everything *below* is mockable, which is what makes both the alpha-churn risk survivable and the test strategy (§13) possible. `core/sandbox` + `policy/` is exactly the core Phase 2 (Magic Folder) reuses.

**FR0 active probe — domains & placement.** The probe runs *inside the fresh sandbox in the agent's exact context* (not on the host) and exercises **all three independently-failing enforcement domains**: a denied filesystem **read**, a denied filesystem **write** (separate Landlock rule), and a denied **network connect**. If *any* succeeds → `EnforcementViolation` → abort. Target <100ms so it's imperceptible per launch.

**Linux-native host-bridge — eng unknown to verify (Q4).** The host-bridge note assumes Docker semantics (`host.docker.internal`). But Linux-first means OpenShell may run namespace-native (Landlock/seccomp + a network namespace), where that hostname does not exist and reaching host Ollama depends on OpenShell's actual egress model (likely netns + an allowlist proxy). **Verify OpenShell's network model before implementing the bridge; do not assume the Docker path.** Tracked as an eng risk (§12).

## 8. Functional requirements

**P0 (MVP cut line)**
- FR1: `blaid <cmd>` launches `<cmd>` in an OpenShell sandbox with the resolved policy, terminal attached, cleanup on exit.
- **FR0 (fail-closed invariant — security-critical):** BLAID MUST NOT launch the agent unless enforcement is confirmed active. Any failure to establish the sandbox (OpenShell unavailable/incompatible, Docker/Podman down, Landlock/seccomp unsupported on this kernel, policy compile error) aborts the launch with a loud, specific error. **There is no "run anyway" path** — a degraded launch would silently void the entire safety guarantee and manufacture false confidence. `doctor` (FR6) pre-checks the same conditions. **Confirmation must be active, not trust-the-self-report:** because OpenShell is alpha, trusting its "enforcement active" status is insufficient — a silently under-applied policy is the *likely* alpha failure mode. BLAID runs a fast startup probe inside the fresh sandbox (attempt a denied file read + a denied network connect from the declared policy) and aborts if either *succeeds*. This converts "fail-closed" from a hope into a test. *(Added per outside-voice review.)*
- **FR0a (policy file immutable to the agent — P0):** The policy is **compiled on the host before the sandbox exists** (eng review: cleaner than a read-only mount — runtime-agnostic, and the agent never sees the governing file at all). The running agent cannot read or edit the `.blaid.yaml` that governs it, so it cannot loosen its own next run. *(Added per outside-voice review; mechanism locked in eng review.)*
- FR2: Built-in default profile with registry inference from lockfiles.
- FR3: `.blaid.yaml` parsing + validation with actionable error messages.
- FR4: **Credential model (eng review).** The wedge path (OpenClaw + local Ollama) is **keyless** — no credential enters the sandbox at all, zero exposure. The cloud path (Claude + Anthropic) injects `ANTHROPIC_API_KEY` as a session env var, with the §6.2 exposure caveat documented. The host-side **egress-proxy** that would remove the key from the sandbox entirely (open-Q #12) is a deferred fast-follow, *not* v1 — justified because the privacy-critical user is already on the keyless path; the env-var exposure only touches the cloud-convenience path.
- FR5: Launch summary line (what's allowed, **which agent, which inference provider/model**) printed before the agent starts.
- FR6: `blaid doctor`.
- **FR8 (deny-log — promoted to P0):** `blaid log` shows policy-denial events (timestamp + attempted resource) for the session, human-readable. Promoted from P1 because the deny-log *is the evidence* that containment works — it's the product's core trust artifact, not a debugging nicety. Without it the safety claim is unfalsifiable.
- **FR13 (inference providers):** The provider abstraction (`inference.provider` / `--provider`) deterministically derives (a) the egress allow-rule, (b) the required credential, and (c) the `baseUrl` injected into the agent's config — including host-loopback bridging for local providers. **v1 implements and supports exactly two providers: `anthropic` and `ollama`** (the two validated paths above). The registry is built so additional providers are config, not core changes, but they are out of v1 scope (Non-goals). `blaid` rejects any unsupported provider with a clear "supported in v1: anthropic, ollama" message.
- **FR14 (agent×provider validation):** Validate the agent/provider pairing at launch; on an unsupported combination (e.g. Claude Code + Ollama without a shim), fail fast with a clear, actionable message and a suggested working pairing.

**P1**
- FR7: `blaid init` (project inspection → commented policy file; **prompts for agent + provider, auto-detecting a running host Ollama/vLLM**).
- FR9: `blaid allow <domain>` with network-policy hot-reload. **Must warn on never-before-seen domains and show a diff against the committed policy** — a prompt-injected agent can emit a plausible "I need access to X to finish" error to socially-engineer its own egress, so widening egress is a deliberate, audited action, never a reflex. Each grant is recorded in the deny/allow log (FR8).
- FR10: Keychain-backed credential lookup on macOS.
- **FR11a (local-mode profiles — promoted from P2):** Ship the `local-ollama` built-in profile (host model socket only, zero external egress) and the host-bridge that makes it work, in the first release. This is the painkiller for the primary wedge (§3) — the zero-egress privacy story must be a working demo at launch, not a roadmap promise. *(CEO review, accepted expansion #1.)*
- **FR15:** `blaid providers` — list providers, live reachability (host Ollama/vLLM detection, present API keys), and the compatibility matrix.
- **FR17 (`blaid verify` — dry run):** Resolve and print the effective policy (fs paths with rw/ro, egress hosts, injected credentials, agent×provider validity) without launching; exit non-zero on an invalid or over-broad policy. `--ci` form gates committed `.blaid.yaml` in CI. *(CEO review, accepted expansion #3.)* Reuses the FR5 launch-summary engine.

**P2**
- FR11: `--profile <name>` flag + remaining named built-ins (node-dev, python-dev, no-network). (The `local-ollama` profile ships in P1 — see FR11a.)
- FR12: JSON output mode for `log` (machine-readable; Phase 2 watcher and any UI build on this).
- **FR16:** OpenAI-/Anthropic-compatible shim so Claude Code can target local/non-Anthropic providers (lifts the §6.1 compatibility limitation if there's demand).

## 9. Success metrics

- **Activation:** % of installs that complete a first sandboxed session (target: >60%).
- **Primary:** weekly active sandboxed sessions.
- **Thesis proxy:** median session duration + % of sessions where the agent runs >10 min without user input (containment → autonomy).
- **Quality:** sandbox launch overhead p50 < 5 s (warm), policy-related failures requiring manual OpenShell knowledge ≈ 0.
- **Inference-mix signal:** share of sessions on the local zero-egress path (`ollama`) vs the cloud path (`anthropic`). A meaningful local share validates the privacy wedge. *(Caveat: see open-Q #6 — for a privacy tool, telemetry opt-in will be low, so §9 is measured by installs, issues, and opt-in surveys more than by a live dashboard. Don't pretend otherwise.)*
- **Phase-2 signal:** # of users with policies for non-code directories.

## 10. Roadmap — Phase 2: Magic Folder (AI Dropbox)

Built entirely on this product's `core/sandbox` + `policy/` modules:

- A watcher daemon triggers a sandboxed agent when files land in a designated folder (summarize PDFs, OCR + rename screenshots, organize, index for search).
- Policy: that folder only; network limited to the model endpoint (or none with local inference).
- New work is the watcher, processing pipeline, and results UX — **zero new security architecture.**
- Key design fork inherited from v1 decisions: ephemeral per-file sandboxes vs. a long-running daemon sandbox (hot-reload and lifecycle requirements differ).

v1 deliberately ships nothing Phase 2 doesn't need, and everything it does.

## 11. Open questions

1. **~~Implementation language~~ — RESOLVED (eng review):** **Rust** core/CLI for v1; React/TS UI (Tauri or Electron) in Phase 2 as a separate frontend over the Rust binary. See §7.
2. **Naming** — name is **BLAID**; still run a trademark/collision check before public release.
3. **Credential UX** — env-var only in MVP, or is macOS keychain (FR10) needed for credible "never on disk" claims at launch?
4. **OpenShell version pinning** — pin a known-good release and vendor the install, or track latest? (Alpha churn vs. security fixes.)
5. **~~Default network allowlist breadth~~ — RESOLVED (CEO review):** `github.com` is **removed** from default allowlists (it's an exfil channel via gist/repo push, unacceptable for a security tool's default). Replaced by inferring allowed git remotes from `.git/config`. The default network profile is now provider-host + inferred package registry only.
6. **Telemetry** — PR/FAQ promises none; do we want opt-in anonymous metrics to measure §9 at all, or rely on installs/issues?
7. **Claude Code × local providers** — ship the OpenAI-compatible shim (FR16) in v1, or scope v1 to "Claude Code = Anthropic; OpenClaw/Hermes = everything else" and add the shim only on demand? (Leaning the latter — keeps v1 small.)
8. **Local-provider detection scope** — how hard does `init`/`providers` probe the host? Just `localhost:11434`/`:8000`, or also remote Ollama hosts and Docker-network vLLM? (Start with the two default ports.)
9. **Bundling open-source models** — out of scope to ship models, but should `doctor`/`init` offer to `ollama pull <recommended-model>` for a one-command local setup, or stay hands-off?
10. **`adk web` (and other agent web UIs) port-exposure** — should the adapter support forwarding a sandbox port *out* to the host browser, or is v1 headless-only (`adk run`) with web UIs deferred? Generalizes beyond ADK to any agent that serves a local UI.
11. **Vertex credentials** — Application Default Credentials are file-based by nature; how do we inject them scoped without violating the "no secrets on disk in-sandbox" claim (mount read-only and ephemeral, exchange for a short-lived token at launch, or document as a known exception)? **Until resolved, `vertex` should NOT be in the v1 P0 provider list** — it currently contradicts the core claim. *(Flagged by outside-voice review.)*
12. **~~Credential egress-proxy~~ — DEFERRED to fast-follow (eng review):** the host-side proxy (no key in sandbox, auditable model-egress chokepoint) is the right long-term posture, but out of v1 because the privacy wedge is already keyless and only the cloud-convenience path carries a key (FR4). Build when a keyed provider needs hardening or the cloud path's exposure becomes a real complaint.
13. **~~Linux-first vs all-platforms~~ — RESOLVED (CEO review):** Linux-first with full kernel guarantee; macOS/Windows ship as labeled best-effort container-grade isolation (§6.2, Non-goals).
14. **OpenShell network model for the host-bridge** — verify whether Linux-native OpenShell reaches host Ollama via a network namespace + allowlist proxy (likely) vs a Docker-style host gateway, before implementing `inference/` host-bridge resolution. Implementation-blocking unknown (§7, §12).

## 12. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Enforcement silently fails → agent runs unsandboxed while user feels safe** | Low | **Critical** | **Fail-closed invariant (FR0): no confirmed enforcement → no launch.** `doctor` pre-checks; deny-log (FR8) lets users verify containment is live. The worst outcome for a security tool, so it gets the hardest guarantee. |
| OpenShell alpha churn breaks us | High | Medium | Adapter isolation (§7); pin version; CI against OpenShell main |
| Docker prereq kills macOS onboarding | Medium | Medium | Dev-audience v1; `doctor` gives exact fix; bundled runtime explored for Phase 2 |
| NVIDIA ships an equivalent launcher | Medium | Low | Wedge strategy — value moves up-stack (policies, Magic Folder, platform integration) |
| Sandbox friction degrades agent success rate (denied ops break tasks) | Medium | High | Good defaults + `allow` hot-reload + clear deny errors the agent can read and adapt to |
| False sense of security (policy too broad, user assumes safety) | Low | High | Launch summary line (FR5); `verify` (FR17) flags over-broad policies and exits non-zero; explicit threat model (§6.2) states the boundaries; `init` writes commented, explicit policies |
| Open-source model quality breaks long agentic loops → users blame BLAID | Medium | Medium | Docs state the trade-off plainly (§6.1); `providers` recommends capable local models; cloud remains the default |
| Local provider unreachable from sandbox (host-bridge misconfig across Docker/Podman/Linux) | Medium | Medium | Bridge resolution centralized in adapter; `doctor` tests sandbox→host model reachability and prints the exact fix |
| **Host-bridge design wrong because Linux-native OpenShell egress model ≠ Docker** | Medium | Medium | Spike OpenShell's actual network model first (open-Q #14); don't write `inference/` bridge code until verified |
| Building a credential egress-proxy we don't need yet (premature) | Low | Low | Deferred (FR4); wedge is keyless, so v1 carries no proxy |

## 13. Test strategy (eng review)

For a security tool, "well-tested" means something specific: **the tests must prove the thing it's denied is actually denied.** A green unit suite that never asserts a real escape attempt fails is theater. The adapter boundary (§7) is what makes this tractable — the pure layer tests without OpenShell; the enforcement layer tests against real sandboxes in CI.

```
        Few   ┌─────────────────────────────────────────────┐
              │ E2E / ADVERSARIAL (real OpenShell, Linux CI) │  ← the ones that matter most
              │  • escape attempts MUST fail (red-team set)  │
              │  • fail-closed: inject runtime breakage,     │
              │    assert NO launch                          │
        Some  ├─────────────────────────────────────────────┤
              │ INTEGRATION (real sandbox, per enforcement   │
              │  domain): denied read/write/connect actually │
              │  denied; deny-log emits; hot-reload works    │
        Many  ├─────────────────────────────────────────────┤
              │ UNIT (no OpenShell — pure, fast):            │
              │  policy compile, provider derivation,        │
              │  agent×provider validation, summary/verify   │
              └─────────────────────────────────────────────┘
```

**Must-have suites (P0):**
1. **Policy-compilation golden tests** — `.blaid.yaml` → compiled OpenShell policy, table-driven. Catches the highest-leverage bug class: a policy that compiles but permits more than intended. Includes adversarial inputs (wildcard egress, `..` path traversal, home-dir requests, empty/nil fields → must reject or fail-closed, never silently widen).
2. **Enforcement integration tests** (real sandbox, Linux CI) — for each domain, assert the denied operation *fails*: read outside policy → denied, write outside policy → denied, connect to non-allowlisted host → denied. These are the spec, executable.
3. **Fail-closed tests (FR0/FR0a)** — inject every failure mode (OpenShell missing, version-mismatch, Docker down, policy compile error, probe-detects-leak) and assert the agent **never launches**. Plus: assert the agent cannot read or write `.blaid.yaml` from inside.
4. **Adversarial / red-team set** — a maintained corpus of escape attempts (env-dump exfil over allowed egress, `blaid allow` social-engineering string in agent output, symlink-out-of-sandbox, policy-file rewrite). Each must be contained or denied. Grows whenever a new vector is found (loop-until-dry, never silently capped).
5. **Adapter contract tests with a mock** — every `SandboxAdapter` method against an in-memory fake, so the pure layer runs in milliseconds and OpenShell churn only breaks the one module.

**Flakiness guard:** enforcement tests touch real kernels/containers — pin the CI image, pin the OpenShell version, and treat a flaky enforcement test as a P0 (a sometimes-passing security assertion is worse than a failing one). **CI gates on the Linux enforcement suite;** macOS/Windows run the container-tier subset and are labeled accordingly.
