"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import WalkUpForm, {
  HeatSelect,
  firstOpenHeat,
  heatName,
  sendWithHeatCheck,
  type HeatOption,
} from "@/components/WalkUpForm";
import { CategoryTag } from "@/components/ResultsEditor";
import type { RaceCategory } from "@/lib/categories";

export interface StartListEntry {
  id: string;
  userId: string;
  name: string;
  email: string;
  ageGroup: string | null;
  status: "confirmed" | "pending";
  /** An unpaid checkout still inside its hold, so it is taking a spot. */
  holding: boolean;
  holdMinutesLeft: number | null;
  heatNumber: number | null;
  hasResult: boolean;
  /** Paid through Stripe, rather than added by an admin. */
  paidOnline: boolean;
  /** The category on their profile now. */
  raceCategory: RaceCategory | null;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
}

const fieldCls =
  "h-11 border border-stone/40 px-3 text-base sm:text-sm bg-bone/50 focus:outline-none focus:border-terracotta transition-colors";

/**
 * The start list, grouped by heat, with moves, removals and race-day adds
 * for athletes with or without an account.
 */
export default function EntriesManager({
  eventId,
  heats,
  entries,
  candidates,
  paidEvent,
  byCategory = false,
}: {
  eventId: string;
  /** Empty for events without heat booking. */
  heats: HeatOption[];
  entries: StartListEntry[];
  candidates: Candidate[];
  paidEvent: boolean;
  /** The event pays women and men separately, so a missing category matters. */
  byCategory?: boolean;
}) {
  const router = useRouter();
  const withHeats = heats.length > 0;
  const [panel, setPanel] = useState<"existing" | "walkup" | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const active = entries.filter((e) => e.status === "confirmed" || e.holding);
  const lapsed = entries.filter((e) => e.status === "pending" && !e.holding);
  const confirmedCount = entries.filter((e) => e.status === "confirmed").length;
  const payingCount = entries.filter((e) => e.status === "pending" && e.holding).length;
  const totalSpots = heats.reduce((n, h) => n + h.capacity, 0);
  const bookedSpots = heats.reduce((n, h) => n + h.booked, 0);

  const enteredHeats = Object.fromEntries(active.map((e) => [e.userId, e.heatNumber]));

  const groups = withHeats
    ? [
        ...heats.map((h) => ({
          key: `heat-${h.number}`,
          title: heatName(heats, h.number),
          sub: h.startTime ? null : h.label,
          count: `${h.booked}/${h.capacity}`,
          full: h.full,
          rows: active.filter((e) => e.heatNumber === h.number),
        })),
        {
          key: "unassigned",
          title: "Unassigned",
          sub: "Entered before heats were set, or by hand",
          count: "",
          full: false,
          rows: active.filter(
            (e) => !e.heatNumber || !heats.some((h) => h.number === e.heatNumber)
          ),
        },
      ].filter((g) => g.key !== "unassigned" || g.rows.length > 0)
    : [];

  async function moveEntry(e: StartListEntry) {
    const heat = Number(drafts[e.id]);
    if (!heat) return;
    setBusy(e.id);
    setError("");
    setNotice("");
    try {
      const data = await sendWithHeatCheck<{ success?: boolean; error?: string; code?: string }>(
        `/api/admin/entries/${e.id}`,
        "PATCH",
        { heatNumber: heat, notify: true },
        "Move"
      );
      if (data === "cancelled") return;
      if (data.success) {
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[e.id];
          return next;
        });
        setNotice(
          `${e.name} moved to ${heatName(heats, heat)}.${
            e.status === "confirmed" ? " They have been emailed." : ""
          }`
        );
        router.refresh();
      } else {
        setError(data.error || "Could not move them");
      }
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(e: StartListEntry) {
    // A pending entry's checkout id is not a payment, so only a confirmed
    // entry with one was paid online.
    const extra =
      e.status === "confirmed"
        ? e.paidOnline
          ? " Any refund is done separately in Stripe."
          : ""
        : e.holding
          ? " Their checkout is closed first, so they cannot pay after this."
          : "";
    if (!window.confirm(`Remove ${e.name} from this event?${extra}`)) return;
    setBusy(e.id);
    setError("");
    setNotice("");
    try {
      // The confirm above already covered the Stripe refund for paid rows.
      const res = await fetch(`/api/admin/entries/${e.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmPaid: e.status === "confirmed" && e.paidOnline }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        code?: string;
      };
      if (data.success) {
        setNotice(`${e.name} removed from the start list.`);
        router.refresh();
      } else if (res.status === 409 && data.code === "PAID") {
        // They paid while this was going on, so they are in, not removed.
        setError(data.error || `${e.name} has just paid, so they are still entered.`);
        router.refresh();
      } else {
        setError(
          data.error ||
            (res.status === 502
              ? "Could not reach Stripe to close their checkout. Try again in a minute."
              : "Could not remove")
        );
      }
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      setBusy(null);
    }
  }

  function row(e: StartListEntry) {
    const draft = drafts[e.id] ?? (e.heatNumber ? String(e.heatNumber) : "");
    // A lapsed checkout holds nothing, so there is nothing to move.
    const movable = withHeats && (e.status === "confirmed" || e.holding);
    const changed = movable && draft !== "" && draft !== String(e.heatNumber ?? "");
    const working = busy === e.id;
    const meta = [
      e.email,
      e.ageGroup ?? "No age group yet",
      e.status === "pending" && e.holdMinutesLeft !== null
        ? `hold ends in ${e.holdMinutesLeft} min`
        : null,
      paidEvent && e.status === "confirmed" && !e.paidOnline ? "added by admin" : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <li key={e.id} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href={`/admin/athletes/${e.userId}`}
              className="t-headline text-[1.1rem] truncate hover:text-terracotta transition-colors"
            >
              {e.name}
            </Link>
            {(e.raceCategory || byCategory) && (
              <CategoryTag category={e.raceCategory} flag={byCategory} />
            )}
            <StatusBadge entry={e} />
          </div>
          <p className="text-[11px] text-midnight/50 truncate">{meta}</p>
        </div>
        <div className="flex items-center gap-2">
          {movable && (
            <HeatSelect
              heats={heats}
              value={draft}
              onChange={(v) => setDrafts((prev) => ({ ...prev, [e.id]: v }))}
              compact
              placeholder={e.heatNumber ? undefined : "Pick a heat"}
              ariaLabel={`Heat for ${e.name}`}
              className={`${fieldCls} min-w-0 flex-1 sm:flex-none sm:w-52`}
            />
          )}
          {changed && (
            <button
              type="button"
              onClick={() => moveEntry(e)}
              disabled={working}
              className="btn btn-sm btn-ink"
            >
              {working ? "Moving..." : "Move"}
            </button>
          )}
          <button
            type="button"
            onClick={() => remove(e)}
            disabled={e.hasResult || working}
            title={e.hasResult ? "Clear their time first" : "Remove from event"}
            aria-label={
              e.hasResult
                ? `Remove ${e.name} (clear their time first)`
                : `Remove ${e.name} from this event`
            }
            className="h-11 px-2 text-xs text-dust hover:text-terracotta transition-colors disabled:opacity-30 disabled:hover:text-dust"
          >
            Remove
          </button>
        </div>
      </li>
    );
  }

  return (
    <div className="bg-white border border-stone/40">
      <div className="px-4 sm:px-5 py-4 border-b border-stone/30 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="t-headline text-[1.6rem] md:text-[1.8rem]">Start list</h2>
          <p className="mt-1.5 text-sm text-midnight/60">
            <span className="t-numeral text-[1.2rem] text-midnight">{confirmedCount}</span> entered
            {payingCount > 0 && <> · {payingCount} paying</>}
            {withHeats && (
              <>
                {" · "}
                <span className="font-mono">
                  {bookedSpots}/{totalSpots}
                </span>{" "}
                spots across {heats.length} heats
              </>
            )}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setPanel(panel === "existing" ? null : "existing")}
            aria-expanded={panel === "existing"}
            aria-controls="add-athlete-panel"
            className={`btn btn-sm ${panel === "existing" ? "btn-ink" : "btn-ghost"}`}
          >
            Add athlete
          </button>
          <button
            type="button"
            onClick={() => setPanel(panel === "walkup" ? null : "walkup")}
            aria-expanded={panel === "walkup"}
            aria-controls="add-athlete-panel"
            className={`btn btn-sm ${panel === "walkup" ? "btn-ink" : "btn-ghost"}`}
          >
            Walk-up, no account
          </button>
        </div>
      </div>

      {panel && (
        <div id="add-athlete-panel" className="px-4 sm:px-5 py-5 border-b border-stone/30 bg-bone/40">
          {panel === "existing" ? (
            <AddExisting
              eventId={eventId}
              heats={heats}
              candidates={candidates}
              onAdded={(message) => {
                setError("");
                setNotice(message);
                router.refresh();
              }}
            />
          ) : (
            <>
              <p className="text-sm text-midnight/70 mb-4">
                For someone without an account. They can claim it later by
                signing in with the same email.
              </p>
              <WalkUpForm eventId={eventId} heats={heats} enteredHeats={enteredHeats} />
            </>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="px-4 sm:px-5 py-3 text-sm text-terracotta border-b border-stone/30">
          {error}
        </p>
      )}
      <p
        aria-live="polite"
        className={
          notice
            ? "px-4 sm:px-5 py-3 text-sm text-trail font-medium bg-trail/5 border-b border-stone/30"
            : "sr-only"
        }
      >
        {notice}
      </p>

      {entries.length === 0 ? (
        <p className="px-4 sm:px-5 py-6 text-[0.95rem] text-midnight/60 max-w-lg leading-relaxed">
          {withHeats
            ? "No entries yet. Bookings land here by heat as athletes pay. Add someone by hand with the buttons above."
            : "No entries yet. Entries land here as athletes sign up. Add someone by hand with the buttons above."}
        </p>
      ) : withHeats ? (
        <div className="-mt-px">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.title}>
              <div className="px-4 sm:px-5 py-2.5 bg-bone/70 border-y border-stone/30 flex items-center justify-between gap-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-midnight/80 truncate">
                  {g.title}
                  {g.sub && <span className="text-dust normal-case tracking-normal"> · {g.sub}</span>}
                </p>
                {g.count && (
                  <p
                    className={`shrink-0 font-mono text-[11px] tabular-nums ${
                      g.full ? "text-terracotta font-semibold" : "text-dust"
                    }`}
                  >
                    {g.full ? `Full · ${g.count}` : g.count}
                  </p>
                )}
              </div>
              {g.rows.length > 0 && (
                <ul className="divide-y divide-stone/30">{g.rows.map(row)}</ul>
              )}
            </section>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-stone/30">{active.map(row)}</ul>
      )}

      {lapsed.length > 0 && (
        <details className="border-t border-stone/30 group">
          <summary className="px-4 sm:px-5 py-3 min-h-11 cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-3 text-xs text-dust hover:text-midnight transition-colors">
            <span>
              {lapsed.length} unfinished checkout{lapsed.length === 1 ? "" : "s"}, spot released
            </span>
            <span aria-hidden className="font-mono group-open:rotate-45 transition-transform">+</span>
          </summary>
          <p className="px-4 sm:px-5 pb-2 text-xs text-midnight/50">
            They started paying but did not finish, so their spot is free again. They can book
            again themselves, or add them with Add athlete.
          </p>
          <ul className="divide-y divide-stone/30 border-t border-stone/30">{lapsed.map(row)}</ul>
        </details>
      )}
    </div>
  );
}

function StatusBadge({ entry }: { entry: StartListEntry }) {
  if (entry.status === "confirmed") {
    return (
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 bg-trail/10 text-trail">
        Entered
      </span>
    );
  }
  return entry.holding ? (
    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 bg-gold/20 text-midnight">
      Paying
    </span>
  ) : (
    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 bg-stone/60 text-midnight/60">
      Unpaid
    </span>
  );
}

/** Pick someone who already has an account and put them in a heat. */
function AddExisting({
  eventId,
  heats,
  candidates,
  onAdded,
}: {
  eventId: string;
  heats: HeatOption[];
  candidates: Candidate[];
  onAdded: (message: string) => void;
}) {
  const withHeats = heats.length > 0;
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Candidate | null>(null);
  const [heat, setHeat] = useState(() => String(firstOpenHeat(heats) ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? candidates.filter(
        (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
      )
    : candidates;
  const matches = filtered.slice(0, 8);

  async function add() {
    if (!picked) return setError("Pick an athlete first.");
    if (withHeats && !heat) return setError("Pick a heat.");
    setBusy(true);
    setError("");
    try {
      const heatNumber = withHeats ? Number(heat) : null;
      const data = await sendWithHeatCheck<{
        success?: boolean;
        error?: string;
        code?: string;
        note?: string;
        /** Added, but with no race category on a women-and-men event. */
        warning?: string;
      }>(
        "/api/admin/entries",
        "POST",
        { eventId, userId: picked.id, heatNumber, notify: true },
        "Add"
      );
      if (data === "cancelled") return;
      if (data.success) {
        onAdded(
          (data.note
            ? // They paid online while this was going on, so they keep the heat they booked.
              `${picked.name} is on the start list${withHeats ? " in the heat they booked" : ""}. ${data.note}`
            : `${picked.name} added${withHeats ? ` to ${heatName(heats, heatNumber)}` : ""}. Their confirmation email is on its way.`) +
            (data.warning ? ` ${data.warning}` : "")
        );
        setPicked(null);
        setQuery("");
      } else {
        setError(data.error || "Could not add them");
      }
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-midnight/60">
        Everyone with an account is already on the start list. Use Walk-up for
        someone new.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {picked ? (
        <div className="flex items-center justify-between gap-3 bg-white border border-terracotta px-4 py-3">
          <div className="min-w-0">
            <p className="t-headline text-[1.1rem] truncate">{picked.name}</p>
            <p className="text-[11px] text-midnight/50 truncate">{picked.email}</p>
          </div>
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="h-11 px-2 text-xs text-dust hover:text-terracotta transition-colors"
          >
            Change
          </button>
        </div>
      ) : (
        <div>
          <label
            htmlFor="add-athlete-search"
            className="block text-xs font-medium text-dust mb-1.5"
          >
            Athlete
          </label>
          <input
            id="add-athlete-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
            autoComplete="off"
            className={`${fieldCls} w-full`}
          />
          {matches.length === 0 ? (
            <p className="mt-2 text-xs text-midnight/50">
              Nobody matches. If they have no account, use Walk-up.
            </p>
          ) : (
            <ul className="mt-2 bg-white border border-stone/40 divide-y divide-stone/30">
              {matches.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPicked(c);
                      setError("");
                    }}
                    className="w-full min-h-11 px-4 py-2 text-left hover:bg-bone transition-colors"
                  >
                    <span className="block text-sm font-medium truncate">{c.name}</span>
                    <span className="block text-[11px] text-midnight/50 truncate">{c.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {filtered.length > matches.length && (
            <p className="mt-1.5 text-[11px] text-midnight/50">
              Showing {matches.length} of {filtered.length}. Type to narrow it down.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        {withHeats && (
          <div className="sm:w-72">
            <label
              htmlFor="add-athlete-heat"
              className="block text-xs font-medium text-dust mb-1.5"
            >
              Heat
            </label>
            <HeatSelect
              id="add-athlete-heat"
              heats={heats}
              value={heat}
              onChange={setHeat}
              placeholder="Pick a heat"
              className={`${fieldCls} w-full`}
            />
          </div>
        )}
        <button
          type="button"
          onClick={add}
          disabled={busy || !picked}
          className="btn btn-sm btn-primary"
        >
          {busy ? "Adding..." : "Add to start list"}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-terracotta">
          {error}
        </p>
      )}
    </div>
  );
}
