import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { parsePrizes } from "@/lib/racetime";
import EntriesManager from "@/components/EntriesManager";
import ResultsEditor from "@/components/ResultsEditor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manage event · Running TT",
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

  const entries = await db
    .prepare(
      `SELECT e.id, e.user_id, e.status, e.age_group, u.name, u.email,
              r.time_display, r.heat_number, r.rank, r.age_group_rank, r.prize_amount_cents
       FROM entries e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN results r ON r.event_id = e.event_id AND r.user_id = e.user_id
       WHERE e.event_id = ?
       ORDER BY u.name`
    )
    .bind(event.id)
    .all() as unknown as {
    results: {
      id: string;
      user_id: string;
      status: string;
      age_group: string | null;
      name: string;
      email: string;
      time_display: string | null;
      heat_number: number | null;
      rank: number | null;
      age_group_rank: number | null;
      prize_amount_cents: number | null;
    }[];
  };

  const enteredIds = new Set(entries.results.map((e) => e.user_id));
  const allUsers = await db
    .prepare("SELECT id, name, email FROM users ORDER BY name")
    .all() as unknown as { results: { id: string; name: string; email: string }[] };
  const candidates = allUsers.results.filter((u) => !enteredIds.has(u.id));

  const confirmed = entries.results.filter((e) => e.status === "confirmed");
  const prizes = parsePrizes(event.prizes);

  const initialStandings = confirmed
    .filter((e) => e.time_display && e.rank)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .map((e) => ({
      userId: e.user_id,
      rank: e.rank as number,
      ageGroup: e.age_group,
      ageGroupRank: e.age_group_rank,
      timeDisplay: e.time_display as string,
      heat: e.heat_number ?? 1,
      prizeCents: e.prize_amount_cents ?? 0,
    }));

  return (
    <>
      <section className="bg-midnight text-white">
        <div className="mx-auto max-w-4xl px-6 py-10 md:py-14">
          <Link href="/admin" className="text-xs text-stone/60 hover:text-stone/80 transition-colors mb-4 inline-block">
            &larr; Admin
          </Link>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-2">
            {event.distance} · Manage event
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{event.name}</h1>
          <p className="mt-2 text-stone/70 text-sm">
            {event.date} · {event.time} · {event.venue}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={`/events/${event.slug}`} className="text-xs font-medium text-white border border-white/20 px-4 py-2 hover:border-white/50 transition-colors">
              Public page
            </Link>
            <Link href={`/events/${event.slug}/qr`} className="text-xs font-medium text-white border border-white/20 px-4 py-2 hover:border-white/50 transition-colors">
              QR code
            </Link>
          </div>
          {prizes.length > 0 && (
            <p className="mt-5 font-mono text-xs text-stone/70">
              Prizes: {prizes.map((p) => `${p.label} ${p.amount}`).join("  ·  ")}
            </p>
          )}
        </div>
      </section>

      <section className="bg-bone min-h-[60vh]">
        <div className="mx-auto max-w-4xl px-6 py-10 md:py-14 space-y-10">
          <ResultsEditor
            eventId={event.id}
            eventSlug={event.slug}
            entrants={confirmed.map((e) => ({
              userId: e.user_id,
              name: e.name,
              email: e.email,
              ageGroup: e.age_group,
              time: e.time_display ?? "",
              heat: e.heat_number ?? 1,
            }))}
            initialStandings={initialStandings}
            prizes={prizes}
          />

          <EntriesManager
            eventId={event.id}
            entries={entries.results.map((e) => ({
              id: e.id,
              userId: e.user_id,
              name: e.name,
              email: e.email,
              ageGroup: e.age_group,
              status: e.status,
              hasResult: !!e.time_display,
            }))}
            candidates={candidates}
          />
        </div>
      </section>
    </>
  );
}
