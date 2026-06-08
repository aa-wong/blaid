"use client";

import { useState } from "react";

const links = [
  { href: "#how", label: "How it works" },
  { href: "#services", label: "Services" },
  { href: "#why", label: "Why BLAID" },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#top" className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink-900">
          <span className="h-6 w-6 rounded-lg bg-gradient-to-br from-brand-400 to-brand-700" />
          BLAID
        </a>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-ink-700 transition hover:text-brand-600">
              {l.label}
            </a>
          ))}
          <a
            href="#contact"
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Get started
          </a>
        </nav>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-700 md:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <div className="space-y-1.5">
            <span className={`block h-0.5 w-6 bg-current transition ${open ? "translate-y-2 rotate-45" : ""}`} />
            <span className={`block h-0.5 w-6 bg-current transition ${open ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 w-6 bg-current transition ${open ? "-translate-y-2 -rotate-45" : ""}`} />
          </div>
        </button>
      </div>

      {open && (
        <nav className="border-t border-slate-200 bg-white px-6 py-4 md:hidden" aria-label="Mobile">
          <div className="flex flex-col gap-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-ink-700"
              >
                {l.label}
              </a>
            ))}
            <a
              href="#contact"
              onClick={() => setOpen(false)}
              className="rounded-full bg-brand-600 px-4 py-2 text-center text-sm font-semibold text-white"
            >
              Get started
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}
