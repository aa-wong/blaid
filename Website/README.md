# BLAID

Marketing site for **BLAID** — AI enablement for small & medium businesses.

Built with [Next.js](https://nextjs.org) (App Router) + [Tailwind CSS v4](https://tailwindcss.com). The landing page is a single static route, so it deploys anywhere (Vercel, Netlify, static export).

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm start` — serve the production build
- `npm run lint` — run ESLint

## Structure

```
src/
  app/
    layout.tsx      # root layout, fonts, metadata
    page.tsx        # composes the landing-page sections
    globals.css     # Tailwind + brand theme tokens
  components/
    Header.tsx      # sticky nav (mobile menu)
    Hero.tsx        # headline + sample "this week with BLAID" dashboard
    Stats.tsx       # stat strip
    HowItWorks.tsx  # Audit → Implement → Enable
    Services.tsx    # 6 service cards
    WhyBlaid.tsx    # value props
    Contact.tsx     # free-audit lead form
    Footer.tsx
```

## TODO

- **Wire up the contact form.** `Contact.tsx` currently shows a local success
  message and does nothing with the data. Hook it to an API route + an email
  service (Resend, Formspree, etc.) before launch.
- Replace placeholder stats/copy with real numbers and case studies.
- Add real OG/favicon assets.
