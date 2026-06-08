const reasons = [
  {
    title: "Outcome-first.",
    body: "We measure success in hours saved and revenue gained — not slide decks.",
  },
  {
    title: "You stay in control.",
    body: "Your data, your tools, your accounts. We set it up to outlast us.",
  },
  {
    title: "Plain language.",
    body: "No buzzwords. If we can't explain it simply, we won't ship it.",
  },
  {
    title: "Right-sized pricing.",
    body: "Transparent, fixed scopes that fit an SMB budget.",
  },
];

export default function WhyBlaid() {
  return (
    <section id="why" className="scroll-mt-20">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Why BLAID</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            Built for the way small businesses actually run.
          </h2>
          <p className="mt-4 text-lg text-ink-500">
            Most AI consulting is priced and paced for the Fortune 500. We&apos;re the opposite:
            fast, practical, and obsessed with real outcomes for teams like yours.
          </p>
        </div>

        <ul className="space-y-5">
          {reasons.map((r) => (
            <li key={r.title} className="flex gap-4">
              <span className="mt-1 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                ✓
              </span>
              <p className="text-ink-700">
                <strong className="font-semibold text-ink-900">{r.title}</strong> {r.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
