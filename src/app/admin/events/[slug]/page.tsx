import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { parsePrizes } from "@/lib/racetime";
import ResultsEditor from "@/components/ResultsEditor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Enter results · Running TT",
  robots: { index: false, follow: false },
};

export default async function AdminEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = await getDB();
  const session = await getSession(db);

  if (!session) redirect("/login");
  if (!session.user.isAdmin) redirect("/dashboard");

  const event = await db
    .prepare(
      "SELECT id, slug, name, distance, date, time, venue, prizes FROM events WHERE slug = ?"
    )
    .bind(slug)
    .first<{
      id: string;
      slug: string;
      name: string;
      distance: string;
      date: string;
      time: string;
      venue: string;
      prizes: string | null;
    }>();

  if (!event) notFound();

  const entrants = await db
    .prepare(
      `SELECT u.id as user_id, u.name, u.email,
              r.time_display, r.time_seconds, r.rank, r.prize_amount_cents
       FROM entries e
       JOIN users u ON e.user_id = u.id
       LEFT JOIN results r ON r.event_id = e.event_id AND r.user_id = u.id
       WHERE e.event_id = ? AND e.status = 'confirmed'
       ORDER BY COALESCE(r.time_seconds, 999999), u.name`
    )
    .bind(event.id)
    .all() as unknown as {
    results: {
      user_id: string;
      name: string;
      email: string;
      time_display: string | null;
      time_seconds: number | null;
      rank: number | null;
      prize_amount_cents: number | null;
    }[];
  };

  const prizes = parsePrizes(event.prizes);

  return (
    <>
      <section className="bg-midnight text-white">
        <div className="mx-auto max-w-4xl px-6 py-10 md:py-14">
          <Link
            href="/admin"
            className="text-xs text-stone/60 hover:text-stone/80 transition-colors mb-4 inline-block"
          >
            &larr; Admin
          </Link>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-2">
            {event.distance} · Enter results
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            {event.name}
          </h1>
          <p className="mt-2 text-stone/70 text-sm">
            {event.venue} · {event.time}
          </p>
          {prizes.length > 0 && (
            <p className="mt-4 font-mono text-xs text-stone/70">
              Prizes:{" "}
              {prizes.map((p) => `${p.label} ${p.amount}`).join("  ·  ")}
            </p>
          )}
        </div>
      </section>

      <section className="bg-bone min-h-[60vh]">
        <div className="mx-auto max-w-4xl px-6 py-10 md:py-14">
          <ResultsEditor
            eventId={event.id}
            entrants={entrants.results.map((e) => ({
              userId: e.user_id,
              name: e.name,
              email: e.email,
              time: e.time_display ?? "",
              rank: e.rank,
              prizeCents: e.prize_amount_cents ?? 0,
            }))}
            prizes={prizes}
          />
        </div>
      </section>
    </>
  );
}
