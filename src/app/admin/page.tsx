import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { displayStatus } from "@/lib/events";
import { formatEventDate } from "@/lib/dates";
import { HOLD_MINUTES, hasHeats, heatWindow, type HeatConfig } from "@/lib/heats";
import { isStripeTestMode } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin · Running TT",
  robots: { index: false, follow: false },
};

interface EventRow extends HeatConfig {
  id: string;
  slug: string;
  name: string;
  distance: string;
  date: string;
  time: string;
  venue: string;
  status: string;
  entries: number;
  holding: number;
  results: number;
  requests: number;
}

interface RequestRow {
  id: string;
  current_heat: number | null;
  requested_heat: number | null;
  note: string | null;
  created_at: string;
  athlete_name: string;
  event_name: string;
  slug: string;
}

/** "12 min ago" from a SQLite UTC timestamp. */
function timeAgo(sqlDate: string): string {
  const iso = sqlDate.includes("T") ? sqlDate : sqlDate.replace(" ", "T") + "Z";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function heatMove(r: RequestRow): string {
  const from = r.current_heat ? `Heat ${r.current_heat}` : "No heat";
  return r.requested_heat ? `${from} to Heat ${r.requested_heat}` : `${from} to any heat`;
}

const statusDot: Record<string, string> = {
  Open: "bg-trail",
  "Sold Out": "bg-terracotta",
  "Coming Soon": "bg-dust",
  Completed: "bg-stone",
};

export default async function AdminPage() {
  const db = await getDB();
  const session = await getSession(db);

  if (!session) redirect("/login");
  if (!session.user.isAdmin) redirect("/dashboard");

  const events = await db
    .prepare(
      `SELECT e.id, e.slug, e.name, e.distance, e.date, e.time, e.venue, e.status,
              e.first_heat_time, e.heat_interval_minutes, e.heat_count, e.heat_capacity,
              (SELECT COUNT(*) FROM entries WHERE event_id = e.id AND status = 'confirmed') as entries,
              (SELECT COUNT(*) FROM entries WHERE event_id = e.id AND status = 'pending'
                 AND created_at > datetime('now', '-${HOLD_MINUTES} minutes')) as holding,
              (SELECT COUNT(*) FROM results WHERE event_id = e.id) as results,
              (SELECT COUNT(*) FROM heat_change_requests WHERE event_id = e.id AND status = 'open') as requests
       FROM events e
       ORDER BY e.date DESC`
    )
    .all() as unknown as { results: EventRow[] };

  const requests = await db
    .prepare(
      `SELECT r.id, r.current_heat, r.requested_heat, r.note, r.created_at,
              u.name as athlete_name, ev.name as event_name, ev.slug
       FROM heat_change_requests r
       JOIN users u ON u.id = r.user_id
       JOIN events ev ON ev.id = r.event_id
       WHERE r.status = 'open'
       ORDER BY r.created_at ASC
       LIMIT 50`
    )
    .all() as unknown as { results: RequestRow[] };

  const counts = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM users) as athletes,
         (SELECT COUNT(*) FROM users WHERE profile_completed = 1) as completed,
         (SELECT COUNT(*) FROM entries WHERE status = 'confirmed') as entries,
         (SELECT COUNT(*) FROM results) as results`
    )
    .first<{ athletes: number; completed: number; entries: number; results: number }>();

  const stripeTestMode = await isStripeTestMode();
  const openRequests = requests.results;

  return (
    <>
      <section className="bg-midnight text-white">
        <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-3">
            Running TT
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Admin
            </h1>
            {stripeTestMode && (
              <span
                className="inline-flex items-center gap-2 border border-gold/50 bg-gold/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-gold"
                title="Paid bookings cannot take real money until live Stripe keys are added"
              >
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />
                Stripe test mode
              </span>
            )}
          </div>
          <p className="mt-3 text-stone/70 text-sm">
            Signed in as {session.user.email}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10 pt-8 border-t border-white/10">
            {[
              { value: counts?.athletes ?? 0, label: "Athletes", href: "/admin/athletes" },
              { value: counts?.completed ?? 0, label: "Profiles done", href: "/admin/athletes" },
              { value: counts?.entries ?? 0, label: "Entries", href: "#events" },
              { value: counts?.results ?? 0, label: "Results", href: "#events" },
            ].map((s) => (
              <Link key={s.label} href={s.href} className="group">
                <p className="font-mono text-2xl md:text-3xl font-semibold tabular-nums group-hover:text-terracotta transition-colors">
                  {s.value}
                </p>
                <p className="text-xs uppercase tracking-[0.2em] text-stone/50 mt-1">
                  {s.label}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-bone min-h-[60vh]">
        <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
          {/* Heat change requests */}
          <div id="requests" className="scroll-mt-24">
            <div className="mb-4">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-1.5">
                Needs a reply
              </p>
              <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2.5">
                Heat change requests
                {openRequests.length > 0 && (
                  <span className="font-mono text-xs font-medium bg-terracotta text-white px-2 py-0.5 tabular-nums">
                    {openRequests.length}
                  </span>
                )}
              </h2>
            </div>

            {openRequests.length === 0 ? (
              <div className="bg-white border border-stone/40 px-6 py-8 text-center">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-2">
                  All clear
                </p>
                <p className="text-sm text-midnight/60 max-w-sm mx-auto leading-relaxed">
                  When an athlete asks to change heats, it lands here and in your
                  inbox. Move them from the event page.
                </p>
              </div>
            ) : (
              <ul className="bg-white border border-stone/40 divide-y divide-stone/30">
                {openRequests.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/admin/events/${r.slug}#requests`}
                      className="group flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 px-5 py-4 hover:bg-bone/60 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-semibold">{r.athlete_name}</span>
                          <span className="text-midnight/50"> · {r.event_name}</span>
                        </p>
                        {r.note && (
                          <p className="text-sm text-midnight/65 mt-1 leading-relaxed break-words">
                            &ldquo;{r.note}&rdquo;
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                        <p className="font-mono text-xs tabular-nums text-midnight">{heatMove(r)}</p>
                        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-dust whitespace-nowrap">
                          {timeAgo(r.created_at)}
                        </p>
                        <span
                          aria-hidden
                          className="hidden sm:inline text-terracotta group-hover:translate-x-0.5 motion-safe:transition-transform"
                        >
                          →
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-end justify-between mb-6 mt-12">
            <h2 className="text-xl font-semibold tracking-tight">Athletes</h2>
            <Link
              href="/admin/athletes"
              className="text-sm text-terracotta hover:text-terracotta/80 transition-colors"
            >
              Manage all →
            </Link>
          </div>

          <div className="flex items-center justify-between gap-4 mb-6 mt-12">
            <h2 id="events" className="text-xl font-semibold tracking-tight scroll-mt-24">
              Events
            </h2>
            <Link
              href="/admin/events/new"
              className="inline-flex items-center gap-2 min-h-11 bg-terracotta text-white text-sm font-medium px-5 hover:bg-terracotta/90 transition-colors"
            >
              <span aria-hidden className="text-base leading-none">+</span>
              New event
            </Link>
          </div>

          {events.results.length === 0 ? (
            <div className="bg-white border border-stone/40 p-10 text-center">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-2">
                No events yet
              </p>
              <p className="text-sm text-midnight/60 mb-5">
                Create the first one. It can sit as Coming Soon with the date TBC.
              </p>
              <Link
                href="/admin/events/new"
                className="inline-flex items-center min-h-11 bg-midnight text-white text-sm font-medium px-5 hover:bg-midnight/90 transition-colors"
              >
                Create an event
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {events.results.map((event) => {
                const status = displayStatus(event.status, event.date);
                const heats = hasHeats(event);
                const spots = heats ? (event.heat_count ?? 0) * (event.heat_capacity ?? 0) : 0;
                const when = (heats && heatWindow(event)) || event.time;
                return (
                  <div
                    key={event.id}
                    className="bg-white border border-stone/40 p-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="inline-flex items-center gap-1.5">
                          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${statusDot[status] ?? "bg-stone"}`} />
                          {event.distance} · {status}
                        </span>
                        {heats && (
                          <span className="text-dust">
                            · {event.heat_count} {event.heat_count === 1 ? "heat" : "heats"}
                          </span>
                        )}
                        {event.requests > 0 && (
                          <Link
                            href={`/admin/events/${event.slug}#requests`}
                            className="bg-terracotta/10 text-terracotta px-1.5 py-0.5 hover:bg-terracotta/20 transition-colors"
                          >
                            {event.requests} change {event.requests === 1 ? "request" : "requests"}
                          </Link>
                        )}
                      </p>
                      <p className="font-semibold tracking-tight">{event.name}</p>
                      <p className="text-xs text-midnight/60 mt-0.5">
                        {formatEventDate(event.date, "short")} · {when} · {event.venue}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 sm:gap-8 shrink-0">
                      <div className="text-center">
                        {heats ? (
                          <>
                            <p className="font-mono text-lg font-semibold tabular-nums">
                              {event.entries}
                              <span className="text-midnight/35 font-normal"> / {spots}</span>
                            </p>
                            <p className="text-[10px] uppercase tracking-wider text-dust">
                              booked{event.holding > 0 ? ` · ${event.holding} paying` : ""}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-mono text-lg font-semibold tabular-nums">{event.entries}</p>
                            <p className="text-[10px] uppercase tracking-wider text-dust">entered</p>
                          </>
                        )}
                      </div>
                      <div className="text-center">
                        <p className="font-mono text-lg font-semibold tabular-nums">{event.results}</p>
                        <p className="text-[10px] uppercase tracking-wider text-dust">timed</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 sm:flex sm:flex-col gap-2 shrink-0 sm:w-28">
                      <Link
                        href={`/admin/events/${event.slug}`}
                        className="min-h-11 sm:min-h-0 flex items-center justify-center text-xs font-medium bg-midnight text-white px-4 py-2 hover:bg-midnight/90 transition-colors text-center"
                      >
                        Manage
                      </Link>
                      <Link
                        href={`/admin/events/${event.slug}/edit`}
                        className="min-h-11 sm:min-h-0 flex items-center justify-center text-xs font-medium text-midnight border border-stone px-4 py-2 hover:border-midnight/40 transition-colors text-center"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/events/${event.slug}/qr`}
                        className="min-h-11 sm:min-h-0 flex items-center justify-center text-xs font-medium text-terracotta border border-terracotta/30 px-4 py-2 hover:bg-terracotta/5 transition-colors text-center"
                      >
                        QR code
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-10">
            <Link href="/dashboard" className="text-sm text-terracotta hover:text-terracotta/80 transition-colors">
              Back to your dashboard
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
