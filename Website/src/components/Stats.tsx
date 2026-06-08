const stats = [
  { value: "9 / 10", label: "SMBs say AI feels overwhelming to adopt" },
  { value: "2–4 wks", label: "From first call to first automation live" },
  { value: "10+ hrs", label: "Typical weekly time saved per team" },
];

export default function Stats() {
  return (
    <section className="border-y border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="text-center sm:text-left">
            <div className="text-3xl font-extrabold tracking-tight text-brand-700">{s.value}</div>
            <p className="mt-1 text-sm text-ink-500">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
