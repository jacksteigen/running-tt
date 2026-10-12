import type { Metadata } from "next";
import type { Outcome } from "@/lib/outcomes";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { parsePrizes } from "@/lib/racetime";
import { formatEventDate } from "@/lib/dates";
import { displayStatus } from "@/lib/events";
import { HOLD_MINUTES, getHeatAvailability, hasHeats, heatWindow } from "@/lib/heats";
import { EVENT_BOOKING_COLUMNS, bookingClosedReason, type BookableEvent } from "@/lib/bookings";
import EntriesManager, { type StartListEntry } from "@/components/EntriesManager";
import ResultsEditor, { type Standing } from "@/components/ResultsEditor";
import ChangeRequestsPanel, { type ChangeRequest } from "@/components/ChangeRequestsPanel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manage event · Running TT",
  robots: { index: false, follow: false },
};

interface EntryRow {
  id: string;
  user_id: string;
  status: string;
  age_group: string | null;
  heat_number: number | null;
  created_at: string;
  stripe_payment_id: string | null;
  outcome: Outcome | null;
  holding: number;
  name: string;
  email: string;
  time_display: string | null;
  result_heat: number | null;
  rank: number | null;
  age_group_rank: number | null;
  prize_amount_cents: number | null;
  result_age_group: string | null;
}

interface RequestRow {
  id: string;
  entry_id: string;
  user_id: string;
  requested_heat: number | null;
  note: string | null;
  created_at: string;
  entry_heat: number | null;
  name: string;
  email: string;
}

/** SQLite's datetime('now') is UTC without a zone marker. */
function fromSqlite(ts: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(ts) ? ts : `${ts.replace(" ", "T")}Z`);
}

function timeAgo(then: Date, now: number): string {
  const mins = Math.max(0, Math.round((now - then.getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const statusStyles: Record<string, string> = {
  Open: "bg-trail text-white",
  "Sold Out": "bg-terracotta text-white",
  Completed: "bg-white/15 text-white",
  "Coming Soon": "bg-stone text-midnight/70",
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
    .prepare(`SELECT ${EVENT_BOOKING_COLUMNS}, prizes FROM events WHERE slug = ?`)
    .bind(slug)
    .first<BookableEvent & { prizes: string | null }>();

  if (!event) notFound();

  const withHeats = hasHeats(event);
  const heats = withHeats ? await getHeatAvailability(db, event) : [];

  const entries = (await db
    .prepare(
      `SELECT e.id, e.user_id, e.status, e.age_group, e.heat_number, e.created_at, e.stripe_payment_id, e.outcome,
              CASE WHEN e.status = 'pending' AND e.created_at > datetime('now', '-${HOLD_MINUTES} minutes')
                   THEN 1 ELSE 0 END AS holding,
              u.name, u.email,
              r.time_display, r.heat_number AS result_heat, r.rank, r.age_group_rank,
              r.prize_amount_cents, r.age_group AS result_age_group
       FROM entries e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN results r ON r.event_id = e.event_id AND r.user_id = e.user_id
       WHERE e.event_id = ?
       ORDER BY u.name COLLATE NOCASE`
    )
    .bind(event.id)
    .all()) as unknown as { results: EntryRow[] };

  const requests = (await db
    .prepare(
      `SELECT h.id, h.entry_id, h.user_id, h.requested_heat, h.note, h.created_at,
              e.heat_number AS entry_heat, u.name, u.email
       FROM heat_change_requests h
       JOIN entries e ON e.id = h.entry_id
       JOIN users u ON u.id = h.user_id
       WHERE h.event_id = ? AND h.status = 'open'
       ORDER BY h.created_at ASC`
    )
    .bind(event.id)
    .all()) as unknown as { results: RequestRow[] };

  // Anyone holding a spot is already on the list; a lapsed checkout can be added.
  const activeIds = new Set(
    entries.results.filter((e) => e.status === "confirmed" || e.holding).map((e) => e.user_id)
  );
  const allUsers = (await db
    .prepare("SELECT id, name, email FROM users ORDER BY name COLLATE NOCASE")
    .all()) as unknown as { results: { id: string; name: string; email: string }[] };
  const candidates = allUsers.results.filter((u) => !activeIds.has(u.id));

  const now = Date.now();
  const confirmed = entries.results.filter((e) => e.status === "confirmed");
  const holding = entries.results.filter((e) => e.status === "pending" && e.holding);
  const prizes = parsePrizes(event.prizes);
  const status = displayStatus(event.status, event.date);
  const closedReason = bookingClosedReason(event);
  const when = (withHeats && heatWindow(event)) || event.time;

  const initialStandings: Standing[] = confirmed
    .filter((e) => e.time_display && e.rank)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .map((e) => ({
      userId: e.user_id,
      rank: e.rank as number,
      ageGroup: e.result_age_group ?? e.age_group,
      ageGroupRank: e.age_group_rank,
      timeDisplay: e.time_display as string,
      heat: e.result_heat ?? e.heat_number ?? 1,
      prizeCents: e.prize_amount_cents ?? 0,
    }));

  const startList: StartListEntry[] = entries.results.map((e) => {
    const holdLeft = e.holding
      ? Math.max(1, HOLD_MINUTES - Math.floor((now - fromSqlite(e.created_at).getTime()) / 60000))
      : null;
    return {
      id: e.id,
      userId: e.user_id,
      name: e.name,
      email: e.email,
      ageGroup: e.age_group,
      status: e.status === "confirmed" ? "confirmed" : "pending",
      holding: !!e.holding,
      holdMinutesLeft: holdLeft,
      heatNumber: e.heat_number,
      hasResult: !!e.time_display,
      paidOnline: !!e.stripe_payment_id,
    };
  });

  const changeRequests: ChangeRequest[] = requests.results.map((r) => {
    const made = fromSqlite(r.created_at);
    return {
      id: r.id,
      entryId: r.entry_id,
      userId: r.user_id,
      name: r.name,
      email: r.email,
      currentHeat: r.entry_heat,
      requestedHeat: r.requested_heat,
      note: r.note,
      madeAgo: timeAgo(made, now),
      madeAt: made.toLocaleString("en-AU", {
        timeZone: "Australia/Melbourne",
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      }),
    };
  });

  const spots = heats.reduce((n, h) => n + h.capacity, 0);
  const booked = heats.reduce((n, h) => n + h.booked, 0);
  const stats = [
    withHeats
      ? { value: `${booked}/${spots}`, label: "Booked", href: "#start-list" }
      : { value: String(confirmed.length), label: "Entered", href: "#start-list" },
    { value: String(holding.length), label: "Paying now", href: "#start-list" },
    { value: `${initialStandings.length}/${confirmed.length}`, label: "Timed", href: "#results" },
    {
      value: String(changeRequests.length),
      label: "Change requests",
      href: changeRequests.length ? "#requests" : "#start-list",
    },
  ];

  const linkCls =
    "inline-flex items-center min-h-11 text-xs font-medium text-white border border-white/20 px-4 hover:border-white/50 transition-colors";

  return (
    <>
      <section className="bg-midnight text-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-8 pb-10 md:pt-12 md:pb-14">
          <Link
            href="/admin"
            className="text-xs text-stone/60 hover:text-white transition-colors mb-6 inline-block font-mono uppercase tracking-[0.2em]"
          >
            &larr; Admin
          </Link>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-3">
            {event.distance} · Manage event
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{event.name}</h1>
            <span
              className={`text-[10px] font-medium uppercase tracking-wider px-2.5 py-1 ${statusStyles[status] || "bg-white/15 text-white"}`}
            >
              {status}
            </span>
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-stone/80">
            <span>{formatEventDate(event.date, "long")}</span>
            <span className="text-stone/30">·</span>
            <span className="font-mono">{when}</span>
            <span className="text-stone/30">·</span>
            <span>{event.venue}</span>
          </p>
          {withHeats && (
            <p className="mt-1.5 font-mono text-xs text-stone/50">
              {event.heat_count} heats · every {event.heat_interval_minutes || 15} min ·{" "}
              {event.heat_capacity || 10} per heat
              {!event.first_heat_time && " · first heat time not set"}
            </p>
          )}
          <p className="mt-4 inline-flex items-center gap-2 text-xs text-stone/70">
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${closedReason ? "bg-stone/40" : "bg-trail"}`}
            />
            {closedReason ? `Not taking bookings. ${closedReason}` : "Taking bookings now."}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href={`/admin/events/${event.slug}/edit`}
              className="inline-flex items-center min-h-11 text-xs font-medium bg-terracotta text-white px-5 hover:bg-terracotta/90 transition-colors"
            >
              Edit event
            </Link>
            <Link href={`/events/${event.slug}`} className={linkCls}>
              Public page
            </Link>
            <Link href={`/events/${event.slug}/qr`} className={linkCls}>
              QR code
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-6 mt-8 pt-7 border-t border-white/10">
            {stats.map((s) => (
              <Link key={s.label} href={s.href} className="group">
                <p
                  className={`font-mono text-2xl md:text-3xl font-semibold tabular-nums transition-colors group-hover:text-terracotta ${
                    s.label === "Change requests" && changeRequests.length ? "text-terracotta" : ""
                  }`}
                >
                  {s.value}
                </p>
                <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-stone/50 mt-1">
                  {s.label}
                </p>
              </Link>
            ))}
          </div>

          {prizes.length > 0 && (
            <p className="mt-6 font-mono text-xs text-stone/60">
              Prizes: {prizes.map((p) => `${p.label} ${p.amount}`).join("  ·  ")}
            </p>
          )}
        </div>
      </section>

      <section className="bg-bone min-h-[60vh]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 md:py-14 space-y-8 md:space-y-10">
          {changeRequests.length > 0 && (
            <div id="requests" className="scroll-mt-24">
              <ChangeRequestsPanel
                requests={changeRequests}
                heats={heats}
                changeFeeCents={event.change_fee_cents}
              />
            </div>
          )}

          <div id="results" className="scroll-mt-24">
            <ResultsEditor
              eventId={event.id}
              eventSlug={event.slug}
              heats={heats}
              entrants={confirmed.map((e) => ({
                userId: e.user_id,
                name: e.name,
                email: e.email,
                ageGroup: e.age_group,
                heat: e.heat_number,
              }))}
              initialStandings={initialStandings}
              initialOutcomes={confirmed
                .filter((e) => e.outcome)
                .map((e) => ({ userId: e.user_id, outcome: e.outcome as Outcome }))}
              prizes={prizes}
            />
          </div>

          <div id="start-list" className="scroll-mt-24">
            <EntriesManager
              eventId={event.id}
              heats={heats}
              entries={startList}
              candidates={candidates}
              paidEvent={event.entry_fee_cents > 0}
            />
          </div>
        </div>
      </section>
    </>
  );
}
