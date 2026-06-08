# BLAID — Contact form & email routing

Snapshot as of 2026-06-02. Update this when the email/DNS setup changes.

## How the contact form works (code)

- The "Get started" / audit form is `src/components/Contact.tsx`. The Header and
  Footer "Get started" links and the Hero CTA all point at `#contact`, i.e. this
  one form.
- **No backend.** On submit, `handleSubmit` reads the fields (Name / Work email /
  Business) and opens the visitor's mail client via a `mailto:` link. The site
  stays fully static.
- Destination address is a single constant at the top of `Contact.tsx`:
  ```ts
  const CONTACT_EMAIL = "hello@blaid.ai";
  ```
  Change that one line to retarget where submissions go (e.g. straight to
  `aaron@blaid.ai`).
- The `mailto:` builds: subject `AI audit request — {name}`, body with
  Name/Email/Business lines.
- **Caveat:** `mailto:` depends on the visitor having a mail client configured and
  clicking send — it is not a true server-side submission. Revisit with an API
  route + email service only if drop-off becomes a problem. (Chosen deliberately to
  avoid paying for a forwarding service.)

## Copy note

All "free" wording was removed (Hero, Contact heading, Contact button) — BLAID does
not offer a free service. Don't reintroduce "free" in CTAs/copy.

## Email / DNS routing (the part that bit us)

The domain `blaid.ai` is registered at **Namecheap**. Mail uses Namecheap
**Private Email** (privateemail.com), 5 mailbox slots, started 2026-05-27. The real
inbox is `aaron@blaid.ai`.

Two Namecheap features were in conflict:

- **Redirect Email** (registrar-level forwarding) — requires MX →
  `eforward*.registrar-servers.com`. A `hello → aaron@blaid.ai` redirect was added
  here (correctly: alias field takes just `hello`, not the full address).
- **Private Email** (the actual mailbox) — requires MX →
  `mx1.privateemail.com` / `mx2.privateemail.com`.

**Root cause of "test email never arrived":** MX pointed at `eforward` (registrar
forwarding), but `aaron@blaid.ai` is a Private Email mailbox whose mail is only
delivered when MX points at privateemail. So `hello@` was caught by eforward, tried
to forward to `aaron@blaid.ai`, re-looked-up MX = eforward again (no `aaron`
mailbox there) → mail died. Net effect: the Private Email mailbox was receiving
nothing at all.

### The fix (recommended path: use Private Email properly)

1. **Repoint MX to Private Email.** Namecheap → Domain → Advanced DNS → Mail
   Settings dropdown → choose **Private Email** (sets these automatically; also
   clears the conflicting Redirect Email):

   | Type | Host | Value | Priority |
   |------|------|-------|----------|
   | MX | @ | `mx1.privateemail.com` | 10 |
   | MX | @ | `mx2.privateemail.com` | 10 |
   | TXT | @ | `v=spf1 include:spf.privateemail.com ~all` | — |

2. **Add `hello@blaid.ai` as an ALIAS** (not a new mailbox) on the existing
   `aaron@blaid.ai` mailbox: Namecheap → Private Email → Manage mailbox → Aliases,
   or webmail at privateemail.com → Settings → Aliases. Aliases are free and don't
   consume a mailbox slot. Mail to `hello@` then lands in the aaron inbox.

3. **Wait for MX propagation** (~30 min to a few hours for Private Email), then test
   by emailing `hello@blaid.ai` from an external account (e.g. Gmail) and confirm it
   arrives in `aaron@blaid.ai`.

### Key facts / gotchas

- **It's NOT cPanel.** Namecheap showed a "create redirects from cPanel" alert, but
  this domain uses BasicDNS + Private Email + registrar Email Forwarding — all
  managed in the Namecheap dashboard, no cPanel.
- Registrar **Redirect Email** and **Private Email** are mutually exclusive on the
  same domain — MX can only point one way.
- Use an **alias**, not a second mailbox, for `hello@` — free, no extra inbox, no
  slot used.
- In Namecheap's "Redirect Email" / cPanel forwarder UI the alias field takes the
  local part only (`hello`), not `hello@blaid.ai` (that creates the invalid
  `hello@blaid.ai@blaid.ai`).
- Alternative: skip the alias and set `CONTACT_EMAIL = "aaron@blaid.ai"` in
  `Contact.tsx`. Works, but exposes the personal address in the static page source.

### Useful checks

```sh
dig +short MX blaid.ai @8.8.8.8   # where mail routes
dig +short NS blaid.ai @8.8.8.8   # nameservers
```
