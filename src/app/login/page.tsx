"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import DeclarationBox from "@/components/DeclarationBox";
import { fieldInputCls, fieldLabelCls } from "@/components/fieldStyles";

const LINK_ERRORS: Record<string, string> = {
  invalid_or_expired:
    "That sign-in link has already been used or has expired. Request a fresh one below.",
  missing_token: "That sign-in link was incomplete. Request a fresh one below.",
};

/** /events/<slug>/book, with or without a query. Not /booked. */
const BOOKING_PATH = /\/events\/[^/]+\/book(\?|$)/;
/** /events/<slug>/booked, the ticket page linked from confirmation emails. */
const BOOKED_PATH = /\/events\/[^/]+\/booked(\?|$)/;

/** Only same-site paths travel through sign-in; the server checks again. */
function readNext(search: string): string {
  const value = new URLSearchParams(search).get("next") ?? "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "";
}

/* Paper fields on bone. The focus frame tightens the global focus outline
   onto the border so it reads as one clear 2px terracotta edge. */
const labelCls = fieldLabelCls;
const inputCls = fieldInputCls;

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
  const [next, setNext] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("error");
    if (code && LINK_ERRORS[code]) setLinkError(LINK_ERRORS[code]);
    setNext(readNext(window.location.search));
  }, []);

  const toBooking = BOOKING_PATH.test(next);
  const toBooked = BOOKED_PATH.test(next);

  async function handleLinkSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, declared, next: next || undefined }),
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
        body: JSON.stringify({ email, password, next: next || undefined }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        next?: string;
        error?: string;
      };
      if (data.success) {
        window.location.href = data.next || "/dashboard";
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
    <section className="bg-bone lg:grid lg:grid-cols-12 lg:min-h-[calc(100svh-4rem)]">
      {/* The photograph. A band above the form on phones, the left page
          of a spread on desktop. */}
      <div className="relative lg:col-span-5 bg-midnight text-bone overflow-hidden flex items-end min-h-[15rem] sm:min-h-[20rem] lg:min-h-0 lg:sticky lg:top-16 lg:self-start lg:h-[calc(100svh-4rem)]">
        <Image
          src="/images/athlete-sock-bench.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 42vw, 100vw"
          className="object-cover object-[50%_60%] opacity-75 motion-safe:animate-slow-zoom"
          aria-hidden
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/35 to-midnight/0"
        />
        <div className="relative w-full px-6 pt-20 pb-8 lg:px-12 lg:pb-14 motion-safe:animate-fade-up">
          <p className="t-display text-[2.7rem] sm:text-[3.4rem] lg:text-[4.4rem]">
            On your <em className="text-bone/75">marks.</em>
          </p>
          <p className="t-caption mt-4 max-w-xs text-bone/65">
            Sign in once and every time you run with us is kept on your
            athlete page.
          </p>
        </div>
      </div>

      {/* The form, open on the page */}
      <div className="lg:col-span-7 lg:flex lg:items-center">
        <div className="w-full max-w-md mx-auto px-6 pt-12 pb-16 md:pt-16 lg:py-24 motion-safe:animate-fade-up [animation-delay:120ms]">
          <h1 className="t-display text-[2.6rem] md:text-[3.2rem]">
            Sign in, <em>or sign up.</em>
          </h1>
          {(toBooking || toBooked) && (
            <p className="t-lede mt-4 text-midnight">
              {toBooking ? "Sign in to book your heat." : "Sign in to see your booking."}
            </p>
          )}
          <p className="mt-4 text-[0.98rem] text-midnight/65 leading-relaxed text-pretty">
            One field for both. First time here? Your account is created when
            you confirm the link.
          </p>

          {linkError && (
            <div
              role="alert"
              className="mt-7 border-l-2 border-terracotta pl-4 py-1 text-[0.95rem] text-midnight leading-relaxed"
            >
              {linkError}
            </div>
          )}

          {submitted ? (
            <div className="mt-10 border-t rule pt-8">
              <h2 className="t-headline text-[2rem]">
                Check your <em>email.</em>
              </h2>
              <p className="mt-4 text-[0.98rem] text-midnight/70 leading-relaxed">
                We sent a sign-in link to{" "}
                <span className="font-medium text-midnight break-all">{email}</span>. Open the
                email and press <span className="font-medium text-midnight">Complete sign in</span>.
                The link expires in 15 minutes.
              </p>
              {resent && (
                <p className="t-caption mt-4 text-trail">
                  A new link is on its way. Only the newest link works.
                </p>
              )}
              {error && (
                <p role="alert" className="mt-4 text-[0.95rem] text-terracotta">{error}</p>
              )}
              <button
                onClick={() => handleLinkSubmit()}
                disabled={loading}
                className="mt-5 inline-flex items-center min-h-11 link-quiet text-[0.95rem] text-midnight disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send it again"}
              </button>
            </div>
          ) : (
            <div className="mt-10">
              <div className="flex border-b rule mb-8">
                {(["link", "password"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => {
                      setMode(m);
                      setError("");
                    }}
                    className={`t-eyebrow min-h-11 mr-7 -mb-px border-b-2 transition-colors ${
                      mode === m
                        ? "border-terracotta text-midnight"
                        : "border-transparent text-midnight/45 hover:text-midnight"
                    }`}
                  >
                    {m === "link" ? "Email me a link" : "Use a password"}
                  </button>
                ))}
              </div>

              {mode === "link" ? (
                <form onSubmit={handleLinkSubmit}>
                  <label htmlFor="email" className={labelCls}>
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
                    className={inputCls}
                  />
                  <div className="mt-8">
                    <DeclarationBox declared={declared} onDeclaredChange={setDeclared} />
                  </div>
                  {error && (
                    <p role="alert" className="mt-3 text-[0.95rem] text-terracotta">{error}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loading || !declared}
                    className="btn btn-primary btn-lg w-full mt-6"
                  >
                    {loading ? "Sending..." : "Send sign-in link"}
                  </button>
                  <p className="t-caption mt-4 text-midnight/55">
                    No password to remember. Sign the declaration once and it covers every event.
                  </p>
                </form>
              ) : (
                <form onSubmit={handlePasswordSubmit}>
                  <label htmlFor="pw-email" className={labelCls}>
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
                    className={inputCls}
                  />
                  <label htmlFor="pw-password" className={`${labelCls} mt-6`}>
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
                    className={inputCls}
                  />
                  {error && (
                    <p role="alert" className="mt-3 text-[0.95rem] text-terracotta">{error}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loading || !email || !password}
                    className="btn btn-primary btn-lg w-full mt-7"
                  >
                    {loading ? "Signing in..." : "Sign in"}
                  </button>
                  <p className="t-caption mt-4 text-midnight/55">
                    Passwords are optional. Set yours from the dashboard after
                    signing in with an email link. Forgot it? Use an email link instead.
                  </p>
                </form>
              )}
            </div>
          )}

          <Link
            href="/"
            className="mt-10 inline-flex items-center min-h-11 link-quiet text-[0.92rem] text-midnight/60"
          >
            Back to the home page
          </Link>
        </div>
      </div>
    </section>
  );
}
