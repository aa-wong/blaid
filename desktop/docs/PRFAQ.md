# PR/FAQ — BLAID

> **Status:** Draft v0.1 · 2026-06-04
> **Phase 1 of 2.** Phase 2 ("Magic Folder" / AI Dropbox) is described in the roadmap section of the [PRD](./PRD.md).

---

## Press Release

**FOR RELEASE: Q3 2026**

### BLAID: Run Claude Code with full autonomy — without giving it your whole machine

*One command launches your coding agent inside a kernel-isolated sandbox that can only touch the current project. No permission fatigue, no leaked credentials, no surprises.*

Developers love letting coding agents like Claude Code run autonomously — and dread what that means. An agent that can read your repo can also read `~/.ssh`. An agent that can `npm install` can also POST your `.env` to anywhere on the internet. Today developers choose between two bad options: babysit every permission prompt, or run `--dangerously-skip-permissions` and hope.

BLAID eliminates the trade-off. Run `blaid claude` in any project directory and Claude Code launches inside an NVIDIA OpenShell sandbox with a policy generated for that project: filesystem access to **this repo only**, network access to **your model API and package registries only**, and credentials injected as scoped environment variables the agent can use but never read off disk. Everything else — your SSH keys, your browser cookies, your other projects, the rest of the internet — simply doesn't exist from inside the box.

The policy is a plain YAML file checked into your repo, so your team can review agent permissions the same way they review code. When the agent tries something outside policy, the attempt is denied and logged — a visible event instead of a silent breach.

This matters most for the developers who can't run agents at all today: people working on regulated codebases, client IP under NDA, or repos sitting next to secrets. For them BLAID isn't a convenience, it's the thing that makes autonomous agents usable in the first place. Point inference at a local Ollama model and run with no direct network egress from the sandbox — the agent reasons over your code without a free outbound socket to ship it anywhere. (For a true air-gap, restrict the host model process too; see the security model for exactly where the boundary is. We'd rather tell you precisely than overpromise.)

"Before BLAID, 'autonomous agent' meant 'agent I have to watch,'" said an early user. "Now I kick off long refactors, walk away, and read the denial log with my coffee."

BLAID is free and open source. Getting started takes under a minute:

```bash
curl -LsSf https://blaid.dev/install.sh | sh   # Linux: full kernel enforcement
cd my-project
blaid claude              # Claude Code on Anthropic, fully autonomous, fully contained
# or, for a fully-private local run with zero direct egress:
blaid --provider ollama openclaw
```

*(macOS/Windows supported via Docker at a clearly-labeled, container-grade isolation tier — Linux gets the strongest guarantee. `blaid doctor` tells you which tier you're on.)*

---

## External FAQ

**Q: What exactly is sandboxed?**
Filesystem (only the current project directory and declared paths are visible), network (only allowlisted destinations — by default your model provider's API and common package registries), processes (no privilege escalation), and credentials (injected as env vars per-session, never readable from disk inside the sandbox).

**Q: How is this different from just running Claude Code in Docker myself?**
Three things you'd otherwise hand-roll: (1) per-project **policy generation** — BLAID inspects your project and writes a least-privilege YAML policy, (2) **credential brokering** — keys are injected scoped to the session rather than baked into an image or mounted from your shell profile, and (3) **deny logging** — every blocked access attempt is recorded, so you can see what the agent *tried* to do. Under the hood it uses NVIDIA OpenShell, which on **Linux** adds Landlock + seccomp kernel enforcement beyond plain container isolation. Straight talk on platforms: that extra kernel enforcement is a Linux feature. On macOS/Windows the sandbox runs in a Linux VM, so you get strong container-grade isolation but not host-kernel enforcement, and your non-project host files are protected by the VM boundary rather than Landlock. `blaid doctor` tells you which tier you're actually running. Linux gets the strongest guarantee.

**Q: Does it only work with Claude Code?**
v1 supports **two validated paths**: Claude Code on Anthropic (the fast, high-quality default) and OpenClaw on a local model (the private, zero-egress wedge). The architecture is built to extend — `blaid <command>` can sandbox any CLI, and more agents/frameworks (Hermes, aider, Google ADK, etc.) are on the roadmap — but we ship the two paths we can fully test rather than a matrix we can't. We'd rather two paths that always work than seven that sometimes do.

**Q: Can I use my own model instead of Claude — like a local open-source model?**
Yes, that's the wedge. Pair **OpenClaw with a local Ollama** model: `blaid --provider ollama openclaw`. BLAID handles the sandbox-to-host networking. With an otherwise-empty allowlist you get the **zero-egress** setup — the agent reasons over your code with no *direct* outbound socket to ship it anywhere (see the security model for the precise boundary, including the host model process). More providers (OpenAI, Gemini, vLLM, any OpenAI-compatible endpoint) are roadmap, not v1. Trade-off, stated honestly: open-source models are weaker on long, tool-heavy agent loops than cloud Claude, so the local path trades some capability for total privacy.

**Q: What platforms are supported?**
**Linux-first.** On Linux you get the full guarantee (Landlock + seccomp against the host kernel). macOS and Windows (WSL 2) work via Docker/Podman but at a clearly-labeled, container-grade isolation tier — the differentiated kernel enforcement is a Linux feature, and your non-project host files are protected by the VM boundary rather than Landlock there. `blaid doctor` reports which tier is active. v1 targets developers, who typically have a container runtime installed.

**Q: Does this slow the agent down?**
Sandbox creation adds a few seconds at launch. Once running, file and network operations inside the sandbox are near-native (container overhead).

**Q: Can the agent ask for more access mid-session?**
Network policy can be hot-reloaded: edit the YAML (or use `blaid allow <domain>`) and the running sandbox picks it up. Filesystem and process policy are locked at sandbox creation by OpenShell's design — restart the sandbox to change them. This is a security feature, not a limitation.

**Q: What happens when the agent hits a wall?**
The operation fails inside the sandbox (e.g., connection refused, permission denied), the agent sees an ordinary error and can adapt, and BLAID logs the denial with a timestamp and the attempted resource. `blaid log` shows the session's denials.

**Q: Is my code sent anywhere?**
Only where the agent itself sends it — i.e., to your model provider's API, which is in the allowlist. BLAID adds no telemetry. The whole point is that *nothing else* is reachable. For zero exposure, use a local model with zero egress.

**Q: What does BLAID NOT protect against?**
We're explicit about the boundary, because a security tool that overstates itself is dangerous. Containment stops an agent from reaching files or networks outside policy, even if it's hijacked by prompt injection. It does **not** stop: exfiltration through a destination you *did* allow (use zero-egress for sensitive work), a malicious model endpoint you point it at (use local/trusted models), an injected credential being *seen* by the agent inside the box (the key can't leave with no egress, but it's not hidden from the agent), or kernel/runtime 0-days below the isolation layer (keep your host patched). The full security model ships in the docs. Short version: minimal allowlists plus local inference is the strong configuration, and `blaid verify` flags policies that are looser than you think.

**Q: How do I know the sandbox is actually on?**
Two ways. BLAID is fail-closed: if it can't confirm the sandbox is enforcing, it refuses to launch — it never silently runs your agent unprotected. And `blaid log` shows every blocked attempt, so containment is something you can watch working, not just trust.

**Q: What does it cost?**
Free, open source (Apache 2.0, matching OpenShell).

---

## Internal FAQ

**Q: Why build this now?**
(1) Agent autonomy is rising faster than agent trust — permission fatigue is the #1 UX complaint with agentic coding tools. (2) NVIDIA OpenShell just made kernel-grade agent sandboxing free and scriptable, but it's raw infrastructure with real friction (policy authoring, sandbox lifecycle). We're productizing the last mile while the gap exists.

**Q: Why is this Phase 1 and not the AI Dropbox / Magic Folder product?**
The launcher is the smallest shippable wrapper around OpenShell — but "smallest" is not "small." A bare `blaid claude` proof-of-concept against OpenShell is a day or two; the full P0 (fail-closed enforcement handshake against an alpha runtime, the inference-provider derivation, host-bridge across Docker/Podman/Linux, deny-log, registry inference, the dry-run compiler) is a multi-week build, and more if OpenShell's API churns under us. The point of shipping it first isn't that it's trivial — it's that it forces the core API (policy templating, sandbox lifecycle, credential brokering) into shape with the least *surrounding* machinery before the Magic Folder reuses that exact core. Right-size the estimate; don't let "thin wrapper" hide the real cost.

**Q: What's the moat? Couldn't NVIDIA ship this themselves?**
They already partly have — **NemoClaw** is NVIDIA's own launcher-on-OpenShell (see PRD §2.5 for the full comparison). But it's NVIDIA-stack-first: OpenClaw/Hermes agents, NIM/Nemotron inference, NVIDIA GPU hardware floor. BLAID aims at the opposite end — Claude Code on a plain Mac, vendor-neutral inference, thin surface. The launcher itself is the *wedge*, not the moat. Defensibility accrues at the layers above: per-project policy conventions, the policy template gallery, the consumer-facing Magic Folder, and eventual platform integration (Mosaia agents running safely on local files). If NVIDIA ships an equivalent generic launcher, we adopt it under our adapter and our value moves up the stack.

**Q: Biggest risk?**
OpenShell is alpha — CLI and policy format will churn. Mitigation: a thin internal adapter layer (`core/sandbox.ts` or equivalent) is the only code that talks to OpenShell directly; everything else talks to our adapter. Second risk: Docker dependency on macOS hurts onboarding — acceptable for the dev audience in v1, must be solved (bundled runtime or MicroVM) before any prosumer push.

**Q: How do we measure success?**
Primary: weekly active sandboxed sessions. Proxy for the thesis ("containment enables autonomy"): median session duration and % of sessions run unattended. Leading indicator for Phase 2: how many users create policies for non-code folders.

**Q: What are we explicitly NOT doing in v1?**
No GUI, no daemon/watcher, no policy marketplace, no multi-sandbox orchestration, no providers beyond Anthropic + local Ollama, no agents beyond Claude Code + OpenClaw (more are roadmap), full kernel guarantee on Linux only (Mac/Win best-effort, labeled), no sandboxing of GUI apps. See PRD non-goals.
