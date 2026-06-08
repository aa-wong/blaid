# BLAID — project notes for Claude Code

Snapshot as of 2026-06-01. Update this when the project state changes.

## What this is

Marketing/landing site for **BLAID** — a company that helps **small & medium
businesses (SMBs) become AI-enabled** (AI adoption, workflow automation, team
training). This repo is currently just the public site, not the product.

Positioning to keep consistent in copy: practical, plain-language, fast results
(weeks not quarters), SMB-priced — the opposite of enterprise/Fortune-500 AI
consulting. No jargon.

## Stack

- **Next.js 16.2.7**, App Router, **TypeScript**, **React 19**
- **Tailwind CSS v4** (config-less; theme tokens live in `src/app/globals.css`
  under `@theme inline`, not a `tailwind.config.js`)
- ESLint (`eslint-config-next`)
- Import alias: `@/*` → `src/*`
- The landing page is a single **static** route (`/`), prerendered at build.
  Deploys anywhere (Vercel/Netlify/static).

## Layout

```
src/
  app/
    layout.tsx      # root layout, Inter font (--font-inter), site metadata/OG
    page.tsx        # composes the section components below, in order
    globals.css     # Tailwind import + brand theme tokens
  components/
    Header.tsx      # "use client" — sticky nav + mobile hamburger menu
    Hero.tsx        # headline + sample "this week with BLAID" dashboard card
    Stats.tsx       # 3-up stat strip
    HowItWorks.tsx  # Audit -> Implement -> Enable (steps 01/02/03)
    Services.tsx    # 6 service cards
    WhyBlaid.tsx    # 4 value props
    Contact.tsx     # "use client" — free-audit lead form
    Footer.tsx
```

Most components are server components with local data arrays at the top of the
file. Only `Header.tsx` and `Contact.tsx` are client components (they use state).

## Brand theme

Defined as CSS custom properties in `src/app/globals.css`:
- `brand-50..900` — blue scale, primary is `brand-600` (#2348d6), CTAs use it
- `ink-900/700/500/300` — text grays (`ink-900` headings, `ink-500` body)
- Font: **Inter** via `next/font/google`, exposed as `--font-inter` / `font-sans`

Use these tokens (e.g. `text-brand-600`, `bg-ink-900`) rather than hardcoding hex.

## Commands

- `npm run dev` — dev server (defaults to :3000, falls back to :3001 if taken)
- `npm run build` — production build (verifies TS + prerender)
- `npm start` — serve prod build
- `npm run lint`

## Known TODOs / gotchas

- **Contact form uses `mailto:`.** `Contact.tsx` builds a `mailto:` link from the
  form fields (Name/Work email/Business) and hands off to the visitor's mail client
  on submit — no backend, site stays static. Target address is the `CONTACT_EMAIL`
  constant at the top of the file (`hello@blaid.ai`). For this to work, `hello@blaid.ai`
  must exist as an **email forwarder on the blaid.ai domain in Namecheap**, forwarding
  to `aaron@blaid.ai` (Domain List → Manage → Email Forwarding; confirm MX records).
  Caveat: `mailto:` depends on the visitor having a mail client and clicking send —
  revisit with a server-side submission if drop-off shows up.
- Stats and copy are **placeholders** — swap for real numbers/case studies.
- No real favicon/OG image yet (default `app/favicon.ico` only).
- Default `public/*.svg` assets from create-next-app are unused; safe to delete.
- **npm cache gotcha:** the global npm cache (`~/.npm/_cacache`) had a stale/perm
  entry that broke installs. Workaround used: `npm install --cache /tmp/npm-cache-blaid`.
  If installs fail with EACCES/EEXIST, use a fresh `--cache` dir or `npm cache verify`.
- **Browse/visual QA:** the gstack `browse` tool pins Chromium build 1208;
  `npx playwright install` here pulled 1223 — mismatch, so headless screenshots
  failed. Build + curl checks were used to verify instead.

## Not a git repo yet

`git init` hasn't been run. Do it before committing.
