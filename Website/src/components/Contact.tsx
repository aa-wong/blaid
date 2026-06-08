"use client";

import { useState } from "react";

// Forwarder on the blaid.ai domain (Namecheap) → delivers to aaron@blaid.ai.
const CONTACT_EMAIL = "hello@blaid.ai";

export default function Contact() {
  const [status, setStatus] = useState<"idle" | "success">("idle");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Static site, no backend: hand the submission off to the visitor's mail
    // client via a mailto: link. CONTACT_EMAIL is a forwarder on the blaid.ai
    // domain (set up in Namecheap) that delivers to aaron@blaid.ai.
    const data = new FormData(e.currentTarget);
    const name = ((data.get("name") as string) ?? "").trim();
    const email = ((data.get("email") as string) ?? "").trim();
    const company = ((data.get("company") as string) ?? "").trim();

    const subject = `AI audit request${name ? ` — ${name}` : ""}`;
    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      company ? `Business: ${company}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
    setStatus("success");
    e.currentTarget.reset();
  }

  return (
    <section id="contact" className="scroll-mt-20 bg-ink-900">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center">
        <div className="text-white">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Ready to find your first AI win?
          </h2>
          <p className="mt-4 text-lg text-slate-300">
            Book a 30-minute AI audit. We&apos;ll show you two or three opportunities you can
            act on right away — no obligation.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white p-7 shadow-xl"
          noValidate
        >
          <div className="space-y-4">
            <Field id="name" label="Name" autoComplete="name" placeholder="Jane Smith" required />
            <Field
              id="email"
              label="Work email"
              type="email"
              autoComplete="email"
              placeholder="jane@yourbusiness.com"
              required
            />
            <Field
              id="company"
              label="Business"
              autoComplete="organization"
              placeholder="Your business name"
            />
          </div>
          <button
            type="submit"
            className="mt-6 w-full rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Book my audit
          </button>
          {status === "success" && (
            <p className="mt-4 text-center text-sm font-medium text-emerald-600" role="status">
              Thanks! Your email app should open with your details — just hit send and
              we&apos;ll be in touch within one business day.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}

function Field({
  id,
  label,
  type = "text",
  ...rest
}: {
  id: string;
  label: string;
  type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink-700">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-ink-900 outline-none transition placeholder:text-ink-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        {...rest}
      />
    </div>
  );
}
