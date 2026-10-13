import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDB } from "@/lib/db";
import { peekMagicLink } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Complete sign in · Running TT",
  robots: { index: false, follow: false },
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    redirect("/login?error=missing_token");
  }

  const db = await getDB();
  const link = await peekMagicLink(db, token);

  return (
    <section className="bg-bone lg:grid lg:grid-cols-12 lg:min-h-[calc(100svh-4rem)]">
      {/* The photograph, desktop only. On a phone the button comes first. */}
      <div className="relative hidden lg:flex lg:col-span-5 bg-midnight text-bone overflow-hidden items-end lg:sticky lg:top-16 lg:self-start lg:h-[calc(100svh-4rem)]">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 79px, #F5F2EC 79px 80px)" }}
        />
        <p className="relative t-caption px-12 pb-14 max-w-sm text-bone/70">
          One tap, and you are in.
        </p>
      </div>

      <div className="lg:col-span-7 lg:flex lg:items-center">
        <div className="w-full max-w-md mx-auto px-6 py-16 md:py-24 motion-safe:animate-fade-up">
          <h1 className="t-display text-[2.8rem] md:text-[3.4rem]">
            {link ? (
              <>
                One tap <em>to go.</em>
              </>
            ) : (
              <>
                Link <em>expired.</em>
              </>
            )}
          </h1>
          <p className="t-lede mt-5 text-midnight/80 text-pretty">
            {link
              ? "Press the button below to finish signing in."
              : "Sign-in links work once and expire after 15 minutes."}
          </p>

          {link ? (
            <form action="/api/auth/verify" method="POST" className="mt-10 border-t rule pt-8">
              <input type="hidden" name="token" value={token} />
              <p className="t-eyebrow text-dust">Signing in as</p>
              <p className="t-headline mt-2 text-[1.5rem] md:text-[1.7rem] break-all">
                {link.email}
              </p>
              <button type="submit" className="btn btn-primary btn-lg w-full mt-8">
                Complete sign in
              </button>
            </form>
          ) : (
            <div className="mt-10 border-t rule pt-8">
              <p className="text-[0.98rem] text-midnight/70 leading-relaxed">
                This sign-in link has already been used or has expired.
                Request a fresh one and try again.
              </p>
              <Link href="/login" className="btn btn-primary btn-lg w-full mt-7">
                Request a new link
              </Link>
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
