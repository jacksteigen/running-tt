"use client";

import { useEffect, useState } from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** The visitor's own time, set like a trackside clock. */
export default function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  const [zone, setZone] = useState("");

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setZone(tz.split("/").pop()?.replace(/_/g, " ") ?? "");
    } catch {
      setZone("");
    }
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh = now ? pad(now.getHours()) : "--";
  const mm = now ? pad(now.getMinutes()) : "--";
  const ss = now ? pad(now.getSeconds()) : "--";

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
        Live{zone ? `, ${zone}` : ""}
      </p>
    </div>
  );
}
