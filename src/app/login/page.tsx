"use client";

import { useState } from "react";
import Link from "next/link";
import { CLEAN_SPORT_DECLARATION } from "@/lib/declaration";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [declared, setDeclared] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, declared }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error || "Something went wrong");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="bg-midnight text-white">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <Link
            href="/"
            className="text-xs text-stone/40 hover:text-stone/60 transition-colors mb-4 inline-block"
          >
            &larr; Home
          </Link>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Sign in or sign up
          </h1>
          <p className="mt-3 text-stone/60 max-w-md">
            One field for both. Enter your email and we will send you a
            sign-in link. First time here? Your account gets created
            automatically.
          </p>
        </div>
      </section>

      <section className="bg-bone">
        <div className="mx-auto max-w-md px-6 py-16 md:py-24">
          {submitted ? (
            <div className="bg-white border border-stone/40 p-8 text-center">
              <div className="w-12 h-12 bg-trail/10 text-trail mx-auto mb-4 flex items-center justify-center">
                <svg
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold tracking-tight mb-2">
                Check your email
              </h2>
              <p className="text-sm text-midnight/60 leading-relaxed">
                We sent a sign-in link to{" "}
                <span className="font-medium text-midnight">{email}</span>.
                Click the link to sign in. It expires in 15 minutes.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="bg-white border border-stone/40 p-8"
            >
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-2"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full border border-stone/40 px-4 py-3 text-sm bg-bone/50 focus:outline-none focus:border-terracotta transition-colors"
              />

              {/* Clean sport declaration */}
              <label className="flex items-start gap-3 cursor-pointer select-none mt-5">
                <input
                  type="checkbox"
                  checked={declared}
                  onChange={(e) => setDeclared(e.target.checked)}
                  required
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#C4593A]"
                />
                <span className="text-xs text-midnight/70 leading-relaxed">
                  {CLEAN_SPORT_DECLARATION}
                </span>
              </label>

              {error && (
                <p className="mt-3 text-sm text-terracotta">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-5 bg-terracotta text-white text-sm font-medium py-3 hover:bg-terracotta/90 transition-colors disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send sign-in link"}
              </button>

              <p className="mt-4 text-xs text-dust text-center">
                No password to remember. New here? We create your account when
                you click the link.
              </p>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
