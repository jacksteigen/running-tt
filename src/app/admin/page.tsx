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

  const tally = [
    { value: counts?.athletes ?? 0, label: "athletes", href: "/admin/athletes" },
    { value: counts?.completed ?? 0, label: "profiles complete", href: "/admin/athletes" },
    { value: counts?.entries ?? 0, label: "entries", href: "#events" },
    { value: counts?.results ?? 0, label: "results", href: "#events" },
  ];

  return (
    <>
      <section className="bg-midnight text-bone">
        <div className="mx-auto max-w-5xl px-6 pt-12 pb-10 md:pt-16 md:pb-12">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            <h1 className="t-display text-[2.8rem] md:text-[4rem]">Admin</h1>
            {stripeTestMode && (
              <span
                className="mb-2 inline-flex items-center gap-2 border border-gold/50 px-2.5 py-1 t-eyebrow text-gold"
                title="Paid bookings cannot take real money until live Stripe keys are added"
              >
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />
                Stripe test mode
              </span>
            )}
          </div>
          <p className="t-caption mt-3 text-bone/55">Signed in as {session.user.email}</p>

          <ul className="mt-10 pt-6 border-t rule-light flex flex-wrap gap-x-9 gap-y-4">
            {tally.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="group inline-flex items-baseline gap-2">
                  <span className="t-numeral text-[2rem] md:text-[2.4rem] group-hover:text-terracotta transition-colors">
                    {s.value}
                  </span>
                  <span className="text-[0.9rem] text-bone/60">{s.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-bone min-h-[60vh]">
        <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
          {/* Heat change requests */}
          <div id="requests" className="scroll-mt-24">
            <h2 className="t-headline text-[1.7rem] md:text-[2rem] flex items-center gap-3 mb-5">
              Heat change requests
              {openRequests.length > 0 && (
                <span className="t-numeral text-[1rem] bg-terracotta text-bone px-2 py-1">
                  {openRequests.length}
                </span>
              )}
            </h2>

            {openRequests.length === 0 ? (
              <p className="border-t rule pt-4 text-[0.95rem] text-midnight/60 max-w-lg leading-relaxed">
                All clear. When an athlete asks to change heats, it lands here and
                in your inbox, and you move them from the event page.
              </p>
            ) : (
              <ul className="bg-white border border-stone/40 divide-y divide-stone/30">
                {openRequests.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/admin/events/${r.slug}#requests`}
                      className="group flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 px-5 py-4 hover:bg-bone/60 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p>
                          <span className="t-headline text-[1.15rem]">{r.athlete_name}</span>
                          <span className="text-sm text-midnight/50"> · {r.event_name}</span>
                        </p>
                        {r.note && (
                          <p className="t-caption text-midnight/65 mt-1 break-words">
                            &ldquo;{r.note}&rdquo;
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                        <p className="font-mono text-sm text-midnight">{heatMove(r)}</p>
                        <p className="text-xs text-dust whitespace-nowrap">{timeAgo(r.created_at)}</p>
                        <span className="hidden sm:inline text-sm text-terracotta link-draw">Open</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-4 mt-14 border-t rule pt-6">
            <h2 className="t-headline text-[1.7rem] md:text-[2rem]">Athletes</h2>
            <Link href="/admin/athletes" className="link-quiet text-[0.95rem] text-midnight">
              Manage athletes
            </Link>
          </div>

          <div className="flex items-center justify-between gap-4 mb-6 mt-14 border-t rule pt-6">
            <h2 id="events" className="t-headline text-[1.7rem] md:text-[2rem] scroll-mt-24">
              Events
            </h2>
            <Link href="/admin/events/new" className="btn btn-primary btn-sm">
              New event
            </Link>
          </div>

          {events.results.length === 0 ? (
            <div className="border-t rule pt-5">
              <p className="text-[0.95rem] text-midnight/65 max-w-md leading-relaxed">
                No events yet. Create the first one. It can sit on the site as
                Coming Soon with the date TBC.
              </p>
              <Link href="/admin/events/new" className="btn btn-ink btn-sm mt-5">
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
                      <p className="t-eyebrow text-terracotta mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
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
                      <p className="t-headline text-[1.4rem] md:text-[1.55rem]">{event.name}</p>
                      <p className="text-[0.82rem] text-midnight/60 mt-1">
                        {formatEventDate(event.date, "short")} · {when} · {event.venue}
                      </p>
                    </div>
                    <div className="flex items-center gap-7 sm:gap-8 shrink-0">
                      <div>
                        {heats ? (
                          <>
                            <p className="t-numeral text-[1.7rem]">
                              {event.entries}
                              <span className="text-midnight/35"> / {spots}</span>
                            </p>
                            <p className="text-xs text-midnight/55 mt-1">
                              booked{event.holding > 0 ? ` · ${event.holding} paying` : ""}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="t-numeral text-[1.7rem]">{event.entries}</p>
                            <p className="text-xs text-midnight/55 mt-1">entered</p>
                          </>
                        )}
                      </div>
                      <div>
                        <p className="t-numeral text-[1.7rem]">{event.results}</p>
                        <p className="text-xs text-midnight/55 mt-1">timed</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 sm:flex sm:flex-col gap-2 shrink-0 sm:w-32">
                      <Link href={`/admin/events/${event.slug}`} className="btn btn-sm btn-ink">
                        Manage
                      </Link>
                      <Link href={`/admin/events/${event.slug}/edit`} className="btn btn-sm btn-ghost">
                        Edit
                      </Link>
                      <Link href={`/events/${event.slug}/qr`} className="btn btn-sm btn-ghost">
                        QR code
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-12">
            <Link href="/dashboard" className="link-quiet text-[0.95rem] text-midnight">
              Back to your dashboard
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
