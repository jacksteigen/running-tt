"use client";

import { useEffect, useState } from "react";
import { isDateTbc } from "@/lib/dates";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

const LABELS = ["days", "hrs", "min", "sec"] as const;

/** One unit of the clock: race-bib digits over a small label. */
function Unit({ value, label, dim = false }: { value: string; label: string; dim?: boolean }) {
  return (
    <div>
      <div
        className={`t-numeral text-[2.5rem] sm:text-[3rem] md:text-[3.4rem] lg:text-[3.8rem] ${
          dim ? "opacity-40" : ""
        }`}
      >
        {value}
      </div>
      <div className="t-eyebrow opacity-60 mt-2.5">{label}</div>
    </div>
  );
}

/**
 * Counts down to the start gun. Renders nothing while the date is TBC, so
 * callers can drop it in anywhere and fall back to their own copy.
 */
export default function Countdown({
  target,
  time,
  className = "",
}: {
  target: string; // ISO date string, e.g. "2026-04-26"
  time?: string | null; // 24h "HH:MM", e.g. a heat start. Defaults to 07:00.
  className?: string;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const tbc = isDateTbc(target);
  const clock = time && /^\d{2}:\d{2}$/.test(time) ? time : "07:00";

  useEffect(() => {
    if (tbc) return;
    const t = new Date(`${target}T${clock}:00`).getTime();
    const tick = () => setRemaining(Math.max(0, t - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target, clock, tbc]);

  if (tbc) return null;

  // Before hydration: hold the shape so nothing jumps when the clock starts.
  if (remaining === null) {
    return (
      <div className={className}>
        <div className="flex items-start gap-5 sm:gap-6 lg:gap-7">
          {LABELS.map((label) => (
            <Unit key={label} value="--" label={label} dim />
          ))}
        </div>
      </div>
    );
  }

  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((remaining / (1000 * 60)) % 60);
  const secs = Math.floor((remaining / 1000) % 60);

  const values = [String(days), pad(hours), pad(mins), pad(secs)];

  return (
    <div className={className}>
      <div className="flex items-start gap-5 sm:gap-6 lg:gap-7">
        {LABELS.map((label, i) => (
          <Unit key={label} value={values[i]} label={label} />
        ))}
      </div>
    </div>
  );
}
