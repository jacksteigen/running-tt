"use client";

import { useEffect, useState } from "react";

// Race time is Melbourne time, the same clock race days and heat cut-offs
// run on, so every visitor sees the one trackside clock wherever they are.
const ZONE = "Australia/Melbourne";
const PLACE = "Melbourne";

const clockFormat = new Intl.DateTimeFormat("en-AU", {
  timeZone: ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function melbourneParts(date: Date) {
  const parts = Object.fromEntries(
    clockFormat.formatToParts(date).map((p) => [p.type, p.value])
  );
  return { hh: parts.hour, mm: parts.minute, ss: parts.second };
}

/** Melbourne time, set like a trackside clock. */
export default function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { hh, mm, ss } = now ? melbourneParts(now) : { hh: "--", mm: "--", ss: "--" };

  return (
    <div className="select-none" aria-hidden>
      <div className="t-numeral flex items-baseline text-bone text-[4.2rem] sm:text-[5.5rem] lg:text-[7rem]">
        <span>{hh}</span>
        <span className="text-bone/30 mx-[0.04em]">:</span>
        <span>{mm}</span>
        <span className="text-bone/30 mx-[0.04em]">:</span>
        <span className="text-terracotta">{ss}</span>
      </div>
      <p className="t-eyebrow text-bone/55 mt-3 flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-terracotta motion-safe:animate-pulse" />
        Live, {PLACE}
      </p>
    </div>
  );
}
