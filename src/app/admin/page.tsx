import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin · Running TT",
  robots: { index: false, follow: false },
};

interface EventRow {
  id: string;
  slug: string;
  name: string;
  distance: string;
  date: string;
  time: string;
  venue: string;
  status: string;
  entries: number;
  results: number;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminPage() {
  const db = await getDB();
  const session = await getSession(db);

  if (!session) redirect("/login");
  if (!session.user.isAdmin) redirect("/dashboard");

  const events = await db
    .prepare(
      `SELECT e.id, e.slug, e.name, e.distance, e.date, e.time, e.venue, e.status,
              (SELECT COUNT(*) FROM entries WHERE event_id = e.id AND status = 'confirmed') as entries,
              (SELECT COUNT(*) FROM results WHERE event_id = e.id) as results
       FROM events e
       ORDER BY e.date DESC`
    )
    .all() as unknown as { results: EventRow[] };

  const athletes = await db
    .prepare("SELECT COUNT(*) as n FROM users")
    .first<{ n: number }>();

  return (
    <>
      <section className="bg-midnight text-white">
        <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-3">
            Running TT
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Admin
          </h1>
          <p className="mt-3 text-stone/70 text-sm">
            Signed in as {session.user.email}. {athletes?.n ?? 0} athlete
            {athletes?.n === 1 ? "" : "s"} registered.
          </p>
        </div>
      </section>

      <section className="bg-bone min-h-[60vh]">
        <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
          <h2 className="text-xl font-semibold tracking-tight mb-6">Events</h2>

          {events.results.length === 0 ? (
            <div className="bg-white border border-stone/40 p-10 text-center">
              <p className="text-sm text-midnight/60">No events yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.results.map((event) => (
                <div
                  key={event.id}
                  className="bg-white border border-stone/40 p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta mb-1">
                      {event.distance} · {event.status}
                    </p>
                    <p className="font-semibold tracking-tight">{event.name}</p>
                    <p className="text-xs text-midnight/60 mt-0.5">
                      {formatDate(event.date)} · {event.time} · {event.venue}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 sm:gap-8 shrink-0">
                    <div className="text-center">
                      <p className="font-mono text-lg font-semibold">
                        {event.entries}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-dust">
                        entered
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="font-mono text-lg font-semibold">
                        {event.results}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-dust">
                        results
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Link
                        href={`/admin/events/${event.slug}`}
                        className="text-xs font-medium bg-midnight text-white px-4 py-2 hover:bg-midnight/90 transition-colors text-center"
                      >
                        Results
                      </Link>
                      <Link
                        href={`/events/${event.slug}/qr`}
                        className="text-xs font-medium text-terracotta border border-terracotta/30 px-4 py-2 hover:bg-terracotta/5 transition-colors text-center"
                      >
                        QR code
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-10">
            <Link
              href="/dashboard"
              className="text-sm text-terracotta hover:text-terracotta/80 transition-colors"
            >
              Back to your dashboard
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
