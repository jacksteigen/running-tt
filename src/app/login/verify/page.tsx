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
            {link ? "One tap to go" : "Link expired"}
          </h1>
          <p className="mt-3 text-stone/70 max-w-md">
            {link
              ? "Press the button below to finish signing in."
              : "Sign-in links work once and expire after 15 minutes."}
          </p>
        </div>
      </section>

      <section className="bg-bone">
        <div className="mx-auto max-w-md px-6 py-16 md:py-24">
          {link ? (
            <form
              action="/api/auth/verify"
              method="POST"
              className="bg-white border border-stone/40 p-8 text-center"
            >
              <input type="hidden" name="token" value={token} />
              <p className="text-sm text-midnight/70 leading-relaxed mb-6">
                You are signing in as{" "}
                <span className="font-medium text-midnight">{link.email}</span>.
              </p>
              <button
                type="submit"
                className="w-full bg-terracotta text-white text-sm font-medium py-3.5 hover:bg-terracotta/90 transition-colors"
              >
                Complete sign in
              </button>
            </form>
          ) : (
            <div className="bg-white border border-stone/40 p-8 text-center">
              <p className="text-sm text-midnight/70 leading-relaxed mb-6">
                This sign-in link has already been used or has expired.
                Request a fresh one and try again.
              </p>
              <Link
                href="/login"
                className="inline-block w-full bg-terracotta text-white text-sm font-medium py-3.5 hover:bg-terracotta/90 transition-colors"
              >
                Request a new link
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
