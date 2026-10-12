"use client";

import { useState } from "react";
import Link from "next/link";
import { dateParts, isDateTbc } from "@/lib/dates";
import { addMinutes } from "@/lib/heats";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * The three steps of booking a heat, shown across the top of the booking
 * and confirmation pages so the athlete always knows where they are.
 */
export function BookingSteps({
  current,
  free = false,
  withHeats = true,
}: {
  current: 1 | 2 | 3;
  free?: boolean;
  withHeats?: boolean;
}) {
  const steps = [withHeats ? "Choose your heat" : "Enter", free ? "Confirm" : "Pay", "You are in"];
  return (
    <ol aria-label="Booking progress" className="grid grid-cols-3 gap-3 sm:gap-5">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} aria-current={active ? "step" : undefined}>
            <div
              aria-hidden
              className={`h-0.5 transition-colors duration-500 ${n <= current ? "bg-terracotta" : "bg-white/15"}`}
            />
            <p
              className={`mt-3 font-mono text-[10px] tracking-[0.25em] flex items-center gap-1.5 ${
                active ? "text-terracotta" : done ? "text-stone/70" : "text-stone/40"
              }`}
            >
              {done ? (
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M2 6.5 4.8 9 10 3" />
                </svg>
              ) : null}
              {pad(n)}
              {done && <span className="sr-only">, done</span>}
            </p>
            <p
              className={`mt-1 text-[11px] sm:text-sm leading-snug ${
                active ? "text-white font-medium" : done ? "text-stone/70" : "text-stone/40"
              }`}
            >
              {label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Calendar file ---------- */

function icsEscape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Long lines are folded so strict calendar apps accept the file. */
function icsFold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 60) {
    out.push(rest.slice(0, 60));
    rest = " " + rest.slice(60);
  }
  out.push(rest);
  return out.join("\r\n");
}

/** "2026-11-01" + "17:45" to "20261101T174500". */
function icsLocal(date: string, hhmm: string) {
  return `${date.replace(/-/g, "")}T${hhmm.replace(":", "")}00`;
}

function nextDay(date: string) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const MELBOURNE_TZ = [
  "BEGIN:VTIMEZONE",
  "TZID:Australia/Melbourne",
  "BEGIN:STANDARD",
  "DTSTART:19700405T030000",
  "TZOFFSETFROM:+1100",
  "TZOFFSETTO:+1000",
  "RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU",
  "TZNAME:AEST",
  "END:STANDARD",
  "BEGIN:DAYLIGHT",
  "DTSTART:19701004T020000",
  "TZOFFSETFROM:+1000",
  "TZOFFSETTO:+1100",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=1SU",
  "TZNAME:AEDT",
  "END:DAYLIGHT",
  "END:VTIMEZONE",
];

function buildIcs({
  uid,
  date,
  start,
  summary,
  location,
  description,
}: {
  uid: string;
  date: string;
  start: string;
  summary: string;
  location: string;
  description: string;
}) {
  const [h, m] = start.split(":").map(Number);
  const end = addMinutes(start, 30);
  const endDate = h * 60 + m + 30 >= 1440 ? nextDay(date) : date;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Running TT//Heat booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...MELBOURNE_TZ,
    "BEGIN:VEVENT",
    `UID:${uid}@runningtt.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Australia/Melbourne:${icsLocal(date, start)}`,
    `DTEND;TZID=Australia/Melbourne:${icsLocal(endDate, end)}`,
    `SUMMARY:${icsEscape(summary)}`,
    `LOCATION:${icsEscape(location)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(summary)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map(icsFold)
    .join("\r\n");
}

/* ---------- Ticket ---------- */

function Field({
  label,
  children,
  className = "",
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="font-mono text-[10px] uppercase tracking-[0.25em] text-dust">{label}</dt>
      <dd className={`mt-1.5 text-[15px] font-medium leading-snug ${mono ? "font-mono tabular-nums" : ""}`}>
        {children}
      </dd>
    </div>
  );
}

export interface BookingTicketProps {
  entryId: string;
  bookingRef: string;
  athleteName: string;
  eventSlug: string;
  eventName: string;
  distance: string;
  /** Raw event date, YYYY-MM-DD or the TBC sentinel. */
  date: string;
  /** formatEventDate(date, "long"). */
  dateText: string;
  venue: string;
  location: string;
  heatNumber: number | null;
  /** "5:45pm", or "Start + 45 min" while the first heat time is not set. */
  heatLabel: string | null;
  /** 24h "HH:MM" start of the heat, or null while it is not set. */
  heatStart: string | null;
  /** "$15 AUD, paid", "Free entry", or "Entered by Running TT" when the team added them. */
  entryText: string;
  email: string;
  /** False when no confirmation email has gone out (e.g. added by the team without one). */
  emailed?: boolean;
}

/**
 * The confirmation, styled as a boarding pass: the payoff at the end of
 * booking, and the page athletes come back to to check their heat.
 */
export default function BookingTicket({
  entryId,
  bookingRef,
  athleteName,
  eventSlug,
  eventName,
  distance,
  date,
  dateText,
  venue,
  location,
  heatNumber,
  heatLabel,
  heatStart,
  entryText,
  email,
  emailed = true,
}: BookingTicketProps) {
  const [saved, setSaved] = useState(false);
  const firstName = athleteName.split(" ")[0] || athleteName;
  const tbc = isDateTbc(date);
  const parts = dateParts(date);
  const canCalendar = !tbc && !!heatStart && !!heatNumber;
  // Say what is actually missing: the date, the heat times, or (no heats) a start time.
  const calendarWaitText = tbc
    ? "Add to calendar unlocks once the date is set."
    : heatNumber
      ? "Add to calendar unlocks once heat times are set."
      : "Start times are on the event page.";

  function addToCalendar() {
    if (!heatStart || !heatNumber) return;
    const ics = buildIcs({
      uid: entryId,
      date,
      start: heatStart,
      summary: `Running TT · ${eventName} · Heat ${heatNumber}`,
      location: [venue, location].filter(Boolean).join(", "),
      description: `Booking ref ${bookingRef}. Manage your booking at https://runningtt.com/events/${eventSlug}/booked`,
    });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `running-tt-heat-${heatNumber}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSaved(true);
  }

  return (
    <div>
      <div className="motion-safe:animate-fade-up">
        <p className="font-mono text-sm md:text-base uppercase tracking-[0.3em] text-terracotta">
          You are in
        </p>
        <h1 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
          {heatNumber ? `Heat ${heatNumber} is yours, ${firstName}.` : `See you on the line, ${firstName}.`}
        </h1>
        <p className="mt-3 text-midnight/60 leading-relaxed max-w-xl">
          {emailed ? (
            <>
              Your confirmation is on its way to{" "}
              <span className="text-midnight font-medium break-words">{email}</span>.{" "}
            </>
          ) : null}
          This page is your ticket, so come back any time.
        </p>
      </div>

      {/* Ticket */}
      <article
        aria-label={`Ticket for ${eventName}`}
        className="relative mt-10 bg-white shadow-[0_40px_80px_-40px_rgba(26,26,24,0.55)] motion-safe:animate-fade-up [animation-delay:120ms]"
      >
        <div className="flex flex-col md:flex-row">
          {/* Main body */}
          <div className="flex-1 min-w-0">
            <div className="bg-midnight text-white h-14 px-5 md:px-7 flex items-center justify-between gap-4">
              <span className="font-semibold tracking-tight text-sm">RUNNING TT</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone/60 truncate">
                Entry ticket
              </span>
            </div>
            <div className="px-5 md:px-7 pt-6 pb-7">
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta">{distance}</p>
              <h2 className="mt-1.5 text-2xl md:text-3xl font-semibold tracking-tight leading-tight">
                {eventName}
              </h2>
              <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5">
                <Field label="Athlete" className="col-span-2 sm:col-span-1">
                  {athleteName}
                </Field>
                <Field label="Date" className="col-span-2 sm:col-span-1">
                  {dateText}
                </Field>
                <Field label="Venue" className="col-span-2">
                  {venue}
                  {location && <span className="block text-sm font-normal text-midnight/60">{location}</span>}
                </Field>
                <Field label="Entry">{entryText}</Field>
                <Field label="Booking ref" mono>
                  {bookingRef}
                </Field>
              </dl>
            </div>
          </div>

          {/* Perforation: across on phones, down the middle from md */}
          <div aria-hidden className="relative h-0 md:h-auto md:w-0">
            <div className="absolute left-5 right-5 top-0 border-t-2 border-dashed border-stone md:left-0 md:right-auto md:top-5 md:bottom-5 md:border-t-0 md:border-l-2" />
            <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-bone" />
            <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-bone md:right-auto md:top-auto md:-left-3 md:-bottom-3" />
          </div>

          {/* Stub */}
          <div className="md:w-60 shrink-0">
            <div className="hidden md:flex bg-midnight text-white h-14 px-7 items-center">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone/60">
                {heatNumber ? "Your heat" : "Race day"}
              </span>
            </div>
            <div className="px-5 md:px-7 pt-6 pb-7 flex md:flex-col items-end md:items-start justify-between gap-4">
              {heatNumber ? (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-dust">Heat</p>
                  <p className="font-mono text-7xl md:text-8xl font-semibold tracking-tighter leading-none tabular-nums mt-1">
                    {pad(heatNumber)}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-dust">{parts.weekday}</p>
                  <p className="font-mono text-6xl md:text-7xl font-semibold tracking-tighter leading-none tabular-nums mt-1">
                    {parts.day}
                  </p>
                  {parts.month && (
                    <p className="font-mono text-sm uppercase tracking-[0.2em] text-midnight/60 mt-1">{parts.month}</p>
                  )}
                </div>
              )}
              <div className="text-right md:text-left">
                {heatNumber && (
                  <>
                    <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-dust">Start</p>
                    <p className="font-mono text-xl font-semibold tabular-nums mt-1">
                      {heatStart ? heatLabel : "Time TBC"}
                    </p>
                    {!heatStart && heatLabel && (
                      <p className="text-xs text-midnight/50 mt-0.5">{heatLabel}</p>
                    )}
                  </>
                )}
                <span className="mt-4 inline-block border-2 border-trail text-trail font-mono text-[10px] font-semibold uppercase tracking-[0.25em] px-2 py-1 -rotate-6">
                  Confirmed
                </span>
              </div>
            </div>
          </div>
        </div>
      </article>

      {/* Actions */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 motion-safe:animate-fade-up [animation-delay:240ms]">
        {canCalendar ? (
          <button
            type="button"
            onClick={addToCalendar}
            className="inline-flex items-center justify-center gap-2 bg-midnight text-white text-sm font-medium px-5 py-3.5 min-h-12 hover:bg-midnight/85 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <rect x="3" y="5" width="18" height="16" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
            {saved ? "Calendar file saved" : "Add to calendar"}
          </button>
        ) : (
          <p className="flex items-center justify-center border border-dashed border-stone px-4 py-3 min-h-12 text-xs text-midnight/50 text-center">
            {calendarWaitText}
          </p>
        )}
        <Link
          href={`/events/${eventSlug}`}
          className="inline-flex items-center justify-center border border-midnight/20 text-sm font-medium px-5 py-3.5 min-h-12 hover:border-midnight/50 transition-colors"
        >
          Event details
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center border border-midnight/20 text-sm font-medium px-5 py-3.5 min-h-12 hover:border-midnight/50 transition-colors"
        >
          Your dashboard
        </Link>
      </div>
      <p aria-live="polite" className="sr-only">
        {saved ? "Calendar file downloaded. Open it to add your heat to your calendar." : ""}
      </p>
    </div>
  );
}
