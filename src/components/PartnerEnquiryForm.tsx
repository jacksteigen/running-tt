"use client";

import { useState } from "react";
import { fieldInputCls, fieldLabelCls, fieldTextareaCls } from "@/components/fieldStyles";

const INTERESTS = [
  "Backing the prize purse",
  "Sponsoring athletes",
  "Product at races",
  "Something else",
];

/** For brands: reaches the Running TT team directly. */
export default function PartnerEnquiryForm() {
  const [form, setForm] = useState({ name: "", brand: "", email: "", interest: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/partner-enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (data.success) setSent(true);
      else setError(data.error || "Something went wrong");
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="border-t rule pt-8" aria-live="polite">
        <p className="t-headline text-[1.8rem]">Thank you.</p>
        <p className="mt-3 max-w-md text-midnight/70 leading-relaxed">
          Your note is with the Running TT team. We will reply to {form.email} soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="border-t rule pt-8 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-6">
      <div>
        <label htmlFor="pe-name" className={fieldLabelCls}>Your name</label>
        <input id="pe-name" required value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" className={fieldInputCls} />
      </div>
      <div>
        <label htmlFor="pe-brand" className={fieldLabelCls}>Brand</label>
        <input id="pe-brand" required value={form.brand} onChange={(e) => set("brand", e.target.value)} autoComplete="organization" className={fieldInputCls} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="pe-email" className={fieldLabelCls}>Email</label>
        <input id="pe-email" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" className={fieldInputCls} />
      </div>
      <fieldset className="sm:col-span-2">
        <legend className={fieldLabelCls}>What interests you</legend>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => (
            <button
              key={i}
              type="button"
              aria-pressed={form.interest === i}
              onClick={() => set("interest", form.interest === i ? "" : i)}
              className={`btn btn-sm normal-case tracking-normal ${form.interest === i ? "btn-ink" : "btn-ghost"}`}
            >
              {i}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        <label htmlFor="pe-message" className={fieldLabelCls}>Anything else (optional)</label>
        <textarea id="pe-message" rows={4} maxLength={2000} value={form.message} onChange={(e) => set("message", e.target.value)} className={fieldTextareaCls} />
      </div>
      {/* Hidden from people; bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="pe-website">Website</label>
        <input id="pe-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website", e.target.value)} />
      </div>
      {error && (
        <p role="alert" className="sm:col-span-2 text-[0.95rem] text-terracotta">{error}</p>
      )}
      <div className="sm:col-span-2">
        <button type="submit" disabled={busy} className="btn btn-primary btn-lg">
          {busy ? "Sending..." : "Talk to us"}
        </button>
      </div>
    </form>
  );
}
