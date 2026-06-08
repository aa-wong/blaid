const steps = [
  {
    num: "01",
    title: "Audit",
    body: "We map your workflows and pinpoint where AI saves the most time or unlocks new revenue.",
  },
  {
    num: "02",
    title: "Implement",
    body: "We set up and integrate the right tools — securely — and wire them into how you already work.",
  },
  {
    num: "03",
    title: "Enable",
    body: "We train your team with plain-language playbooks so the wins stick long after we leave.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">How it works</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            A clear path from curious to AI-enabled.
          </h2>
          <p className="mt-4 text-lg text-ink-500">
            No big-bang transformation. We start small, prove value, then expand.
          </p>
        </div>

        <ol className="mt-14 grid gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.num} className="relative rounded-2xl border border-slate-200 bg-white p-7">
              <span className="text-sm font-bold text-brand-300">{s.num}</span>
              <h3 className="mt-2 text-xl font-bold text-ink-900">{s.title}</h3>
              <p className="mt-2 text-ink-500">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
