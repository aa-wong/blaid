const services = [
  {
    icon: "⚡",
    title: "Workflow automation",
    body: "Cut the busywork — invoicing, scheduling, data entry, and follow-ups handled automatically.",
  },
  {
    icon: "💬",
    title: "Customer support AI",
    body: "Faster, on-brand replies and 24/7 answers that feel human and reduce your support load.",
  },
  {
    icon: "📊",
    title: "Insights & reporting",
    body: "Turn scattered data into clear weekly summaries and decisions you can actually act on.",
  },
  {
    icon: "🎓",
    title: "Team training",
    body: "Hands-on sessions and playbooks that turn AI-curious staff into confident power users.",
  },
  {
    icon: "🔒",
    title: "Safe & compliant",
    body: "Data handling, access, and tooling set up with privacy and security from day one.",
  },
  {
    icon: "🚀",
    title: "Custom AI tools",
    body: "When off-the-shelf won't cut it, we build lightweight tools tailored to your business.",
  },
];

export default function Services() {
  return (
    <section id="services" className="scroll-mt-20 bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Services</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            Everything you need to put AI to work.
          </h2>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <article
              key={s.title}
              className="rounded-2xl border border-slate-200 bg-white p-7 transition hover:-translate-y-1 hover:shadow-lg hover:shadow-brand-900/5"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-xl">
                {s.icon}
              </div>
              <h3 className="mt-4 text-lg font-bold text-ink-900">{s.title}</h3>
              <p className="mt-2 text-ink-500">{s.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
