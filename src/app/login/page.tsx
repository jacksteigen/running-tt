"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DeclarationBox from "@/components/DeclarationBox";

const LINK_ERRORS: Record<string, string> = {
  invalid_or_expired:
    "That sign-in link has already been used or has expired. Request a fresh one below.",
  missing_token:
    "That sign-in link was incomplete. Request a fresh one below.",
};

export default function LoginPage() {
  const [mode, setMode] = useState<"link" | "password">("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [declared, setDeclared] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [linkError, setLinkError] = useState("");
  const [resent, setResent] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("error");
    if (code && LINK_ERRORS[code]) {
      setLinkError(LINK_ERRORS[code]);
    }
  }, []);

  async function handleLinkSubmit(e?: React.FormEvent) {
    e?.preventDefault();
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

      if (submitted) setResent(true);
      setSubmitted(true);
      setLinkError("");
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string };

      if (data.success) {
        window.location.href = "/dashboard";
        return;
      }
      setError(data.error || "Something went wrong");
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
            className="text-xs text-stone/60 hover:text-stone/80 transition-colors mb-4 inline-block"
          >
            &larr; Home
          </Link>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Sign in or sign up
          </h1>
          <p className="mt-3 text-stone/70 max-w-md">
            One field for both. Enter your email and we will send you a
            sign-in link. First time here? Your account gets created
            automatically.
          </p>
        </div>
      </section>

      <section className="bg-bone">
        <div className="mx-auto max-w-md px-6 py-16 md:py-24">
          {linkError && (
            <div
              role="alert"
              className="mb-5 border border-terracotta/40 bg-terracotta/5 px-4 py-3 text-sm text-terracotta"
            >
              {linkError}
            </div>
          )}

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
                Open the email and press{" "}
                <span className="font-medium text-midnight">
                  Complete sign in
                </span>
                . The link expires in 15 minutes.
              </p>
              {resent && (
                <p className="mt-3 text-xs text-trail">
                  A new link is on its way. Only the newest link works.
                </p>
              )}
              {error && (
                <p role="alert" className="mt-3 text-sm text-terracotta">
                  {error}
                </p>
              )}
              <button
                onClick={() => handleLinkSubmit()}
                disabled={loading}
                className="mt-6 text-sm text-terracotta hover:text-terracotta/80 transition-colors disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send it again"}
              </button>
            </div>
          ) : (
            <div className="bg-white border border-stone/40 p-8">
              <div className="flex gap-1 mb-6 border border-stone/40 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("link");
                    setError("");
                  }}
                  className={`flex-1 text-xs font-medium py-2 transition-colors ${
                    mode === "link"
                      ? "bg-midnight text-white"
                      : "text-midnight/60 hover:text-midnight"
                  }`}
                >
                  Email me a link
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("password");
                    setError("");
                  }}
                  className={`flex-1 text-xs font-medium py-2 transition-colors ${
                    mode === "password"
                      ? "bg-midnight text-white"
                      : "text-midnight/60 hover:text-midnight"
                  }`}
                >
                  Use a password
                </button>
              </div>

              {mode === "link" ? (
                <form onSubmit={handleLinkSubmit}>
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
                    autoComplete="email"
                    className="w-full border border-stone/40 px-4 py-3 text-sm bg-bone/50 focus:outline-none focus:border-terracotta transition-colors"
                  />

                  {/* Clean sport declaration */}
                  <div className="mt-5">
                    <DeclarationBox
                      declared={declared}
                      onDeclaredChange={setDeclared}
                    />
                  </div>

                  {error && (
                    <p role="alert" className="mt-3 text-sm text-terracotta">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !declared}
                    className="w-full mt-5 bg-terracotta text-white text-sm font-medium py-3 hover:bg-terracotta/90 transition-colors disabled:opacity-50"
                  >
                    {loading ? "Sending..." : "Send sign-in link"}
                  </button>

                  <p className="mt-4 text-xs text-dust text-center">
                    No password to remember. New here? We create your account
                    when you confirm the link.
                  </p>
                </form>
              ) : (
                <form onSubmit={handlePasswordSubmit}>
                  <label
                    htmlFor="pw-email"
                    className="block text-sm font-medium mb-2"
                  >
                    Email address
                  </label>
                  <input
                    id="pw-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    className="w-full border border-stone/40 px-4 py-3 text-sm bg-bone/50 focus:outline-none focus:border-terracotta transition-colors"
                  />

                  <label
                    htmlFor="pw-password"
                    className="block text-sm font-medium mb-2 mt-4"
                  >
                    Password
                  </label>
                  <input
                    id="pw-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    required
                    autoComplete="current-password"
                    className="w-full border border-stone/40 px-4 py-3 text-sm bg-bone/50 focus:outline-none focus:border-terracotta transition-colors"
                  />

                  {error && (
                    <p role="alert" className="mt-3 text-sm text-terracotta">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !email || !password}
                    className="w-full mt-5 bg-terracotta text-white text-sm font-medium py-3 hover:bg-terracotta/90 transition-colors disabled:opacity-50"
                  >
                    {loading ? "Signing in..." : "Sign in"}
                  </button>

                  <p className="mt-4 text-xs text-dust text-center">
                    Passwords are optional. Set yours from the dashboard after
                    signing in with an email link. Forgot it? Use an email
                    link instead.
                  </p>
                </form>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
