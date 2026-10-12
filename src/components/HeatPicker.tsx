"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HOLD_MINUTES } from "@/lib/heats";
import { formatFee } from "@/lib/money";

export interface PickerHeat {
  number: number;
  /** "5:45pm", or "First heat" / "Start + 45 min" while times are not set. */
  label: string;
  offsetMinutes: number | null;
  capacity: number;
  booked: number;
  remaining: number;
  full: boolean;
  /** Already started on race day, so it can never be booked. */
  closed: boolean;
  /** Has space and has not started. */
  bookable: boolean;
}

type ApiHeat = Omit<PickerHeat, "offsetMinutes" | "closed" | "bookable"> & {
  offsetMinutes?: number | null;
  closed?: boolean;
  bookable?: boolean;
};

/** guest: signed out. incomplete: signed in, profile not finished. */
export type PickerViewer = "guest" | "incomplete" | "ready";

/**
 * soon: TBC date or Coming Soon, so bookings will open later.
 * final: sold out, finished, or the last heat has started.
 */
export type PickerClosedKind = "soon" | "final";

type Message = { text: string; href?: string; linkText?: string; tone?: "info" };

const POLL_MS = 15000;
const CLOCK = /^(\d{1,2}:\d{2})(am|pm)$/;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * The athlete's own unpaid checkout still holds a spot. Booking again
 * releases it, so it should not count against them while they choose.
 */
function releaseHold(heats: PickerHeat[], held: number | null): PickerHeat[] {
  if (!held) return heats;
  return heats.map((h) => {
    if (h.number !== held || h.booked === 0) return h;
    const booked = h.booked - 1;
    const remaining = Math.max(0, h.capacity - booked);
    return { ...h, booked, remaining, full: remaining === 0, bookable: remaining > 0 && !h.closed };
  });
}

/**
 * When a hold lapses, in epoch ms. `since` is the entry's created_at, which
 * SQLite stores in UTC as "YYYY-MM-DD HH:MM:SS".
 */
function holdEndsAt(since: string | null): number | null {
  if (!since) return null;
  const iso = since.includes("T") ? since : since.replace(" ", "T");
  const t = Date.parse(/(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`);
  return Number.isFinite(t) ? t + HOLD_MINUTES * 60_000 : null;
}

function toPickerHeat(h: ApiHeat, offsets: Map<number, number | null>): PickerHeat {
  const closed = !!h.closed;
  return {
    number: h.number,
    label: h.label,
    offsetMinutes: h.offsetMinutes ?? offsets.get(h.number) ?? null,
    capacity: h.capacity,
    booked: h.booked,
    remaining: h.remaining,
    full: h.full,
    closed,
    bookable: h.bookable ?? (!h.full && !closed),
  };
}

/** Big time on the card: "5:45" + "pm", or "+0:45" from the first gun. */
function timeParts(h: PickerHeat): { main: string; suffix: string; caption: string | null } {
  const clock = h.label.match(CLOCK);
  if (clock) return { main: clock[1], suffix: clock[2], caption: null };
  if (h.offsetMinutes !== null) {
    const hours = Math.floor(h.offsetMinutes / 60);
    const mins = pad(h.offsetMinutes % 60);
    return h.offsetMinutes === 0
      ? { main: "0:00", suffix: "", caption: "First heat" }
      : { main: `+${hours}:${mins}`, suffix: "", caption: "After first heat" };
  }
  return { main: h.label, suffix: "", caption: null };
}

function spotsText(h: PickerHeat, preview: boolean) {
  if (h.closed) return "Started";
  if (h.full || h.remaining <= 0) return "Full";
  if (preview && h.remaining === h.capacity) return `${h.capacity} spots`;
  if (h.remaining === 1) return "Last spot";
  if (h.remaining <= 3) return `Last ${h.remaining} spots`;
  return `${h.remaining} spots left`;
}

/** Seat-map meter: one segment per spot, or a bar for big heats. */
function Meter({ heat, selected }: { heat: PickerHeat; selected: boolean }) {
  const low = heat.bookable && heat.remaining <= 3;
  if (heat.capacity > 16) {
    const pct = Math.min(100, ((heat.booked + (selected ? 1 : 0)) / heat.capacity) * 100);
    return (
      <div aria-hidden className="h-1.5 bg-stone/70">
        <div
          className={`h-full transition-[width] duration-500 ${selected ? "bg-terracotta" : "bg-midnight/70"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  }
  return (
    <div aria-hidden className="flex gap-[3px]">
      {Array.from({ length: heat.capacity }, (_, i) => {
        const taken = i < heat.booked;
        const yours = selected && i === heat.booked;
        return (
          <span
            key={i}
            className={`h-1.5 flex-1 transition-colors duration-300 ${
              taken
                ? "bg-midnight/70"
                : yours
                  ? "bg-terracotta"
                  : low
                    ? "bg-gold/70"
                    : "bg-stone"
            }`}
          />
        );
      })}
    </div>
  );
}

function Check() {
  return (
    <span className="flex h-5 w-5 items-center justify-center bg-terracotta text-white motion-safe:animate-page-in">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M2 6.5 4.8 9 10 3" />
      </svg>
    </span>
  );
}

/**
 * Pick a heat like picking a seat on a flight. Spots left stay live while
 * the page is open, and the chosen heat is held through to payment.
 */
export default function HeatPicker({
  eventId,
  eventSlug,
  eventName,
  entryFeeCents,
  initialHeats,
  initialHeat,
  heldHeat,
  heldSince,
  viewer,
  closedReason,
  closedKind,
  closedCta,
  timesConfirmed,
  intervalMinutes,
  changeFeeText,
  cancelled,
}: {
  eventId: string;
  eventSlug: string;
  eventName: string;
  entryFeeCents: number;
  initialHeats: PickerHeat[];
  /** From ?heat=, so a chosen heat survives sign-in and onboarding. */
  initialHeat: number | null;
  /** The heat an unpaid checkout of theirs is holding, if any. */
  heldHeat: number | null;
  /** When that checkout started (entries.created_at), so the hold can lapse here too. */
  heldSince: string | null;
  viewer: PickerViewer;
  /** Why bookings are not open, or null when they are. */
  closedReason: string | null;
  /** Whether a closed booking will open later or is closed for good. */
  closedKind: PickerClosedKind;
  /** Short label for the disabled button while closed. */
  closedCta: string;
  timesConfirmed: boolean;
  intervalMinutes: number;
  /** From changeFeeText(): " and carry a $5 admin fee". */
  changeFeeText: string;
  /** Back from Stripe without paying. */
  cancelled: boolean;
}) {
  const router = useRouter();
  const preview = !!closedReason;
  const paid = entryFeeCents > 0;
  const price = paid ? formatFee(entryFeeCents) : "Free";
  const bookedHref = `/events/${eventSlug}/booked`;

  // Counts as the server reports them; the athlete's own hold is taken off below.
  const [serverHeats, setServerHeats] = useState<PickerHeat[]>(initialHeats);
  // Their own unfinished checkout, only for as long as the server still keeps it.
  const [hold, setHold] = useState<number | null>(heldHeat);

  // Fresh props from the server (router.refresh after coming back from
  // Stripe) replace the live counts and the hold.
  const [synced, setSynced] = useState({ initialHeats, heldHeat, heldSince });
  if (
    synced.initialHeats !== initialHeats ||
    synced.heldHeat !== heldHeat ||
    synced.heldSince !== heldSince
  ) {
    setSynced({ initialHeats, heldHeat, heldSince });
    setServerHeats(initialHeats);
    setHold(heldHeat);
  }

  const heats = useMemo(() => releaseHold(serverHeats, hold), [serverHeats, hold]);

  const [selected, setSelected] = useState<number | null>(() => {
    if (preview) return null;
    const wanted = initialHeat ?? heldHeat;
    const h = releaseHold(initialHeats, heldHeat).find((x) => x.number === wanted);
    return h && h.bookable ? h.number : null;
  });
  const [notice, setNotice] = useState(() => {
    if (preview || !initialHeat) return "";
    const h = releaseHold(initialHeats, heldHeat).find((x) => x.number === initialHeat);
    if (!h || h.bookable) return "";
    return h.closed
      ? `Heat ${initialHeat} has already started. Pick a later heat.`
      : `Heat ${initialHeat} has filled up. Pick another heat.`;
  });
  const [error, setError] = useState<Message | null>(null);
  const [busy, setBusy] = useState<null | "holding" | "redirecting" | "booked">(null);

  const selectedRef = useRef(selected);
  const holdRef = useRef(hold);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    holdRef.current = hold;
  }, [hold]);

  // Fallback start offsets from the event config, in case the live feed leaves them out.
  const [offsets] = useState(() => new Map(initialHeats.map((h) => [h.number, h.offsetMinutes])));

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/heats`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { heats?: ApiHeat[] };
      if (!data.heats) return;
      const fresh = data.heats.map((h) => toPickerHeat(h, offsets));
      setServerHeats(fresh);
      const current = selectedRef.current;
      const now = current ? releaseHold(fresh, holdRef.current).find((h) => h.number === current) : null;
      if (current && now && !now.bookable) {
        selectedRef.current = null;
        setSelected(null);
        setNotice(
          now.closed
            ? `Heat ${current} has started. Pick a later heat.`
            : `Heat ${current} just filled up. Pick another heat.`
        );
      }
    } catch {
      // Offline for a moment: keep showing the last counts.
    }
  }, [eventId, offsets]);

  // The server stops holding an unpaid checkout after HOLD_MINUTES. Stop
  // counting it as theirs at the same moment, then pick up the real counts.
  useEffect(() => {
    if (hold === null) return;
    const ends = holdEndsAt(heldSince);
    if (ends === null) return;
    const id = setTimeout(() => {
      holdRef.current = null;
      setHold(null);
      refresh();
    }, Math.max(0, ends - Date.now()));
    return () => clearTimeout(id);
  }, [hold, heldSince, refresh]);

  // Live spots left, paused while the tab is in the background.
  useEffect(() => {
    if (preview) return;
    const tick = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [preview, refresh]);

  // Back from Stripe via the browser's back button restores this page from
  // cache mid-redirect. Let them book again, and pick up their new hold.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      setBusy(null);
      router.refresh();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [router]);

  const bookPath = selected ? `/events/${eventSlug}/book?heat=${selected}` : `/events/${eventSlug}/book`;
  const loginHref = `/login?next=${encodeURIComponent(bookPath)}`;
  const welcomeHref = `/welcome?next=${encodeURIComponent(bookPath)}`;

  function choose(n: number) {
    if (preview || busy) return;
    const h = heats.find((x) => x.number === n);
    if (!h || !h.bookable) return;
    setSelected(n);
    setNotice("");
    setError(null);
    window.history.replaceState(null, "", `/events/${eventSlug}/book?heat=${n}`);
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const open = heats.map((h, i) => (h.bookable ? i : -1)).filter((i) => i >= 0);
    if (!open.length) return;
    const pos = open.indexOf(index);
    let target: number;
    if (e.key === "Home") target = open[0];
    else if (e.key === "End") target = open[open.length - 1];
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") target = open[(pos + 1) % open.length];
    else target = open[(pos - 1 + open.length) % open.length];
    choose(heats[target].number);
    buttons.current[target]?.focus();
  }

  async function book() {
    if (!selected || busy) return;
    setBusy("holding");
    setError(null);
    setNotice("");
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, heatNumber: selected }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        checkoutUrl?: string;
        next?: string;
        error?: string;
        code?: string;
        holdReleased?: boolean;
      };
      // Forget their old hold only when the server says it gave it up (a
      // booking went through, or it cleared the old checkout first). Errors
      // raised before that leave the hold, and its spot, in place.
      if (res.ok || data.holdReleased) {
        holdRef.current = null;
        setHold(null);
      }

      if (data.checkoutUrl) {
        setBusy("redirecting");
        window.location.href = data.checkoutUrl;
        return;
      }
      if (data.success) {
        setBusy("redirecting");
        router.push(data.next || `/events/${eventSlug}/booked`);
        return;
      }

      switch (data.code) {
        case "HEAT_FULL":
          selectedRef.current = null;
          setSelected(null);
          await refresh();
          setError({ text: data.error || "That heat has just filled up. Pick another one." });
          break;
        case "HEAT_STARTED":
          selectedRef.current = null;
          setSelected(null);
          await refresh();
          setError({ text: data.error || "That heat has already started. Pick a later one." });
          break;
        case "IN_PROGRESS":
          // Another tab is setting up a checkout. Keep their pick so they can retry.
          setError({
            text: data.error || "Your booking is already being set up. Give it a moment, then try again.",
          });
          break;
        case "ALREADY_BOOKED":
          // Booked already, or the payment from an earlier checkout went through.
          setBusy("booked");
          setError({
            tone: "info",
            text: data.error || "You already have a heat booked.",
            href: bookedHref,
            linkText: "View your booking",
          });
          router.push(bookedHref);
          return;
        case "CLOSED":
          selectedRef.current = null;
          setSelected(null);
          setError({ text: data.error || "Bookings have closed." });
          router.refresh();
          break;
        case "PROFILE": {
          setBusy("redirecting");
          const to = data.next || "/welcome";
          router.push(to.includes("?") ? to : `${to}?next=${encodeURIComponent(bookPath)}`);
          return;
        }
        case "AUTH":
          setError({
            text: "Your session has ended. Sign in again and your heat will be waiting.",
            href: loginHref,
            linkText: "Sign in",
          });
          break;
        default:
          setError({ text: data.error || "Something went wrong. Try again." });
      }
    } catch {
      setError({ text: "Could not connect. Check your signal and try again." });
    }
    setBusy(null);
  }

  const chosen = heats.find((h) => h.number === selected) ?? null;
  // Nothing left to book: every heat is full or has already started.
  const allFull = !preview && heats.length > 0 && heats.every((h) => !h.bookable);
  const allStarted = heats.length > 0 && heats.every((h) => h.closed);
  const someStarted = heats.some((h) => h.closed);
  const focusIndex = Math.max(
    0,
    chosen ? heats.indexOf(chosen) : heats.findIndex((h) => h.bookable)
  );

  /* ---------- CTA, shared by the side panel and the phone bar ---------- */

  const ctaBase =
    "flex w-full items-center justify-center gap-2 text-sm font-medium px-5 min-h-12 transition-colors";
  const ctaPrimary = `${ctaBase} bg-terracotta text-white hover:bg-terracotta/90`;

  function renderCta(dark: boolean) {
    const ctaDisabled = `${ctaBase} cursor-not-allowed ${
      dark ? "bg-white/10 text-stone/50" : "bg-midnight/15 text-midnight/50"
    }`;
    if (preview || allFull) {
      return (
        <button type="button" disabled className={ctaDisabled}>
          {preview ? closedCta : allStarted ? "Bookings closed" : "Every heat is full"}
        </button>
      );
    }
    if (viewer === "guest") {
      return (
        <Link href={loginHref} className={ctaPrimary}>
          Sign in to book
        </Link>
      );
    }
    if (viewer === "incomplete") {
      return (
        <Link href={welcomeHref} className={ctaPrimary}>
          Finish your profile to book
        </Link>
      );
    }
    if (!chosen) {
      return (
        <button type="button" disabled className={ctaDisabled}>
          Choose a heat
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={book}
        disabled={!!busy}
        aria-busy={!!busy}
        className={`${ctaPrimary} disabled:cursor-wait disabled:bg-terracotta/80`}
      >
        {busy && (
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white motion-safe:animate-pulse" />
        )}
        {busy === "holding"
          ? "Holding your spot..."
          : busy === "booked"
            ? "Opening your booking..."
            : busy === "redirecting"
              ? paid
                ? "Opening secure checkout..."
                : "Confirming..."
              : `Book Heat ${chosen.number} · ${price}`}
      </button>
    );
  }

  const errorBox = (dark: boolean) => {
    if (!error) return null;
    const info = error.tone === "info";
    return (
      <p
        role={info ? "status" : "alert"}
        className={`text-sm leading-snug ${dark ? "text-white" : info ? "text-trail" : "text-terracotta"}`}
      >
        {dark && (
          <span
            aria-hidden
            className={`inline-block h-1.5 w-1.5 rounded-full mr-2 align-middle ${info ? "bg-trail" : "bg-terracotta"}`}
          />
        )}
        {error.text}
        {error.href && (
          <>
            {" "}
            <Link
              href={error.href}
              className={`inline-flex min-h-11 items-center underline underline-offset-2 font-medium ${
                dark ? "text-terracotta" : "hover:text-midnight"
              }`}
            >
              {error.linkText}
            </Link>
          </>
        )}
      </p>
    );
  };

  const finePrint = paid
    ? `Secure payment by Stripe, in AUD. Your spot is held while you check out. Need to move later? Heat changes are made by our team${changeFeeText}.`
    : `Free entry, confirmed straight away. Need to move later? Heat changes are made by our team${changeFeeText}.`;

  /* ---------- Heat cards ---------- */

  const card = (h: PickerHeat, i: number) => {
    const isSelected = selected === h.number;
    const t = timeParts(h);
    const low = h.bookable && h.remaining <= 3;
    const unavailable = !h.bookable;
    const status = spotsText(h, preview);

    const inner = (
      <>
        <div className="flex items-start justify-between gap-2">
          <span
            className={`font-mono text-[10px] uppercase tracking-[0.25em] ${
              isSelected ? "text-terracotta" : "text-dust"
            }`}
          >
            Heat {pad(h.number)}
          </span>
          {isSelected ? <Check /> : <span aria-hidden className="h-5" />}
        </div>
        <p
          className={`mt-3 font-mono font-semibold tracking-tight tabular-nums leading-none ${
            t.main.length > 7 ? "text-base" : "text-2xl md:text-[1.75rem]"
          }`}
        >
          <span
            className={
              h.closed
                ? "text-midnight/50"
                : h.full
                  ? "line-through decoration-1 decoration-midnight/50"
                  : undefined
            }
          >
            {t.main}
          </span>
          {t.suffix && <span className="ml-0.5 text-sm font-medium text-midnight/50">{t.suffix}</span>}
        </p>
        <p className="mt-1.5 h-4 font-mono text-[10px] uppercase tracking-[0.15em] text-midnight/40 truncate">
          {t.caption ?? ""}
        </p>
        <div className="mt-4">
          <Meter heat={h} selected={isSelected} />
        </div>
        <p className="mt-2.5 flex items-center gap-1.5 text-xs">
          {low && !preview && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold shrink-0" />}
          <span
            className={
              unavailable
                ? "font-mono uppercase tracking-[0.15em] text-[10px] text-midnight/50"
                : low && !preview
                  ? "font-medium text-midnight"
                  : "text-midnight/60"
            }
          >
            {status}
          </span>
        </p>
      </>
    );

    if (preview) {
      return (
        <li key={h.number} className="bg-white border border-stone/40 p-4 md:p-5">
          {inner}
        </li>
      );
    }

    return (
      <button
        key={h.number}
        ref={(el) => {
          buttons.current[i] = el;
        }}
        type="button"
        role="radio"
        aria-checked={isSelected}
        aria-disabled={unavailable || undefined}
        aria-label={`Heat ${h.number}, ${h.label}, ${status.toLowerCase()}`}
        disabled={unavailable}
        tabIndex={i === focusIndex ? 0 : -1}
        onClick={() => choose(h.number)}
        onKeyDown={(e) => onKeyDown(e, i)}
        className={`relative text-left p-4 md:p-5 border transition-[border-color,background-color,transform,box-shadow] duration-200 ${
          unavailable
            ? "bg-bone/70 border-stone/40 opacity-60 cursor-not-allowed"
            : isSelected
              ? "bg-terracotta/[0.06] border-terracotta ring-1 ring-inset ring-terracotta"
              : "bg-white border-stone/50 hover:border-midnight/40 motion-safe:hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-16px_rgba(26,26,24,0.35)]"
        }`}
      >
        {inner}
      </button>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-12">
      <div className="lg:col-span-2 min-w-0">
        {/* Banners */}
        {preview && (
          <div
            className={`mb-8 border-l-2 bg-white border-y border-r border-y-stone/40 border-r-stone/40 px-5 py-4 ${
              closedKind === "soon" ? "border-terracotta" : "border-dust"
            }`}
          >
            <p
              className={`font-mono text-[10px] uppercase tracking-[0.25em] mb-1 ${
                closedKind === "soon" ? "text-terracotta" : "text-dust"
              }`}
            >
              {closedKind === "soon" ? "Preview" : "Bookings closed"}
            </p>
            <p className="text-sm text-midnight/80">
              {closedKind === "soon" ? `${closedReason} Have a look at the heats in the meantime.` : closedReason}
            </p>
          </div>
        )}
        {!preview && cancelled && (
          <div className="mb-8 border-l-2 border-dust bg-white border-y border-r border-y-stone/40 border-r-stone/40 px-5 py-4 motion-safe:animate-page-in">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-dust mb-1">Checkout closed</p>
            <p className="text-sm text-midnight/80">Payment not finished. Pick your heat again to continue.</p>
          </div>
        )}
        {!preview && !cancelled && hold && (
          <div className="mb-8 border-l-2 border-dust bg-white border-y border-r border-y-stone/40 border-r-stone/40 px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-dust mb-1">Unfinished checkout</p>
            <p className="text-sm text-midnight/80">
              You started booking Heat {hold}. Book again to pick up where you left off.
            </p>
          </div>
        )}
        {allFull && (
          <div className="mb-8 border-l-2 border-terracotta bg-white border-y border-r border-y-stone/40 border-r-stone/40 px-5 py-4">
            <p className="text-sm text-midnight/80">
              {allStarted
                ? "Bookings have closed. The last heat has started."
                : someStarted
                  ? "Every heat still to run is full right now. Spots can free up as unfinished checkouts expire, so check back soon."
                  : "Every heat is full right now. Spots can free up as unfinished checkouts expire, so check back soon."}
            </p>
          </div>
        )}

        {/* Heading */}
        <div className="mb-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-2">
              {heats.length} heats · {intervalMinutes} min apart
            </p>
            <h2 id="heat-picker-heading" className="text-2xl md:text-3xl font-semibold tracking-tight">
              Choose your heat
            </h2>
            <p className="mt-2 text-sm text-midnight/60">
              {heats[0]?.capacity ?? 10} athletes per heat. Same course, same clock, your choice of start.
            </p>
            {!timesConfirmed && (
              <p className="mt-1 text-sm text-midnight/60">
                Heat times are confirmed with the date. Until then, times show from the first gun.
              </p>
            )}
          </div>
        </div>

        {/* Legend, and a pulse to show the counts are live */}
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 mb-5 font-mono text-[10px] uppercase tracking-[0.2em] text-midnight/50">
          <div aria-hidden className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-4 bg-midnight/70" /> Booked
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-4 bg-stone" /> Open
            </span>
            {!preview && (
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-4 bg-terracotta" /> Yours
              </span>
            )}
          </div>
          {!preview && (
            <span className="inline-flex items-center gap-2 text-dust">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-trail opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-trail" />
              </span>
              Live
            </span>
          )}
        </div>

        <p aria-live="polite" className={notice ? "mb-5 border-l-2 border-gold bg-gold/10 px-4 py-3 text-sm text-midnight" : "sr-only"}>
          {notice}
        </p>

        {/* Grid */}
        {preview ? (
          <ul aria-labelledby="heat-picker-heading" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {heats.map(card)}
          </ul>
        ) : (
          <div
            role="radiogroup"
            aria-labelledby="heat-picker-heading"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
          >
            {heats.map(card)}
          </div>
        )}

        <p className="mt-6 text-xs text-midnight/50 leading-relaxed lg:hidden">{finePrint}</p>

        {/* Phone and tablet: summary bar pinned above the tab bar while the heats are on screen */}
        <div className="lg:hidden sticky z-40 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] md:bottom-0 -mx-6 mt-6">
          <div className="bg-midnight/95 backdrop-blur-md text-white border-t border-white/10 px-6 py-3 md:pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-12px_30px_-12px_rgba(0,0,0,0.5)]">
            {error && <div className="mb-3">{errorBox(true)}</div>}
            <div className="flex items-center gap-4">
              <div className="min-w-0 shrink-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone/50">
                  {chosen ? `Heat ${pad(chosen.number)}` : preview ? "Heats" : "No heat yet"}
                </p>
                <p className="font-mono text-base font-semibold tabular-nums mt-0.5" key={chosen?.number ?? 0}>
                  {chosen ? (CLOCK.test(chosen.label) ? chosen.label : timeParts(chosen).main) : price === "Free" ? "Free" : `${price} AUD`}
                </p>
              </div>
              <div className="flex-1 min-w-0">{renderCta(true)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: booking summary */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 bg-white border border-stone/40">
          <div className="bg-midnight text-white px-6 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone/50">Your booking</p>
            <p className="mt-1 font-semibold tracking-tight truncate">{eventName}</p>
          </div>
          <div className="p-6">
            <div key={chosen?.number ?? 0} className="motion-safe:animate-page-in">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-dust">Heat</p>
              {chosen ? (
                <div className="mt-1 flex items-end justify-between gap-4">
                  <p className="font-mono text-6xl font-semibold tracking-tighter leading-none tabular-nums">
                    {pad(chosen.number)}
                  </p>
                  <div className="text-right pb-1">
                    <p className="font-mono text-lg font-semibold tabular-nums">
                      {CLOCK.test(chosen.label) ? chosen.label : timeParts(chosen).main}
                    </p>
                    <p className="text-xs text-midnight/50">
                      {CLOCK.test(chosen.label) ? "Start time" : chosen.label}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-midnight/50">
                  {preview
                    ? closedKind === "soon"
                      ? "Heats open for booking soon."
                      : "Bookings are closed."
                    : allFull
                      ? "No heats left to book right now."
                      : "Pick a heat to see it here."}
                </p>
              )}
            </div>

            <dl className="mt-6 border-t border-stone/40 divide-y divide-stone/30 text-sm">
              <div className="flex items-center justify-between py-3">
                <dt className="text-midnight/60">Entry</dt>
                <dd className="font-mono font-semibold tabular-nums">{paid ? `${price} AUD` : "Free"}</dd>
              </div>
              {chosen && (
                <div className="flex items-center justify-between py-3">
                  <dt className="text-midnight/60">Spots left in heat</dt>
                  <dd className="font-mono tabular-nums">{chosen.remaining}</dd>
                </div>
              )}
            </dl>

            {error && <div className="mt-4">{errorBox(false)}</div>}
            <div className="mt-5">{renderCta(false)}</div>
            <p className="mt-4 text-xs text-midnight/50 leading-relaxed">{finePrint}</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
