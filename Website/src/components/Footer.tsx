const links = [
  { href: "#how", label: "How it works" },
  { href: "#services", label: "Services" },
  { href: "#why", label: "Why BLAID" },
  { href: "#contact", label: "Get started" },
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-10 md:flex-row md:justify-between">
        <div className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-lg bg-gradient-to-br from-brand-400 to-brand-700" />
          <span className="text-lg font-extrabold tracking-tight text-ink-900">BLAID</span>
          <span className="ml-2 hidden text-sm text-ink-500 sm:inline">
            AI enablement for small &amp; medium businesses.
          </span>
        </div>

        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2" aria-label="Footer">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-ink-500 transition hover:text-brand-600">
              {l.label}
            </a>
          ))}
        </nav>

        <p className="text-sm text-ink-300">
          © {new Date().getFullYear()} BLAID. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
