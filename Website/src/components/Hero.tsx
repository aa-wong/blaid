const dashboardRows = [
  { label: "Invoice processing", tag: "Automated", status: "green" },
  { label: "Customer support replies", tag: "−68% time", status: "green" },
  { label: "Lead follow-up", tag: "In progress", status: "amber" },
  { label: "Weekly reporting", tag: "Automated", status: "green" },
];

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-50 to-white" />
      <div className="pointer-events-none absolute -top-24 right-0 -z-10 h-96 w-96 rounded-full bg-brand-200/40 blur-3xl" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
        <div>
          <p className="mb-4 inline-flex rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
            AI enablement for small &amp; medium businesses
          </p>
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl">
            Make your business{" "}
            <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">
              AI-ready
            </span>{" "}
            — without the enterprise overhead.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-500">
            BLAID helps SMBs adopt AI that actually moves the needle. We find the highest-leverage
            opportunities, set up the right tools, and train your team — so AI becomes a quiet
            advantage, not another thing on your plate.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#contact"
              className="rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              Book an AI audit
            </a>
            <a
              href="#how"
              className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-ink-700 transition hover:border-brand-400 hover:text-brand-600"
            >
              See how it works
            </a>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-500">
            {["No jargon", "Fixed, transparent pricing", "Results in weeks, not quarters"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="text-brand-600">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-brand-900/5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-300">
              This week with BLAID
            </p>
            <div className="space-y-3">
              {dashboardRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                >
                  <span className="flex items-center gap-3 text-sm font-medium text-ink-700">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        row.status === "green" ? "bg-emerald-500" : "bg-amber-400"
                      }`}
                    />
                    {row.label}
                  </span>
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                    {row.tag}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl bg-ink-900 px-4 py-3 text-sm text-white">
              <strong className="font-bold">~11 hrs/week</strong> given back to the team
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
