"use client";

import { useEffect, useState } from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function Countdown({
  target,
  className = "",
}: {
  target: string; // ISO date string, e.g. "2026-04-26"
  className?: string;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    // Target is 07:00 local time on the date.
    const t = new Date(target + "T07:00:00").getTime();
    const tick = () => setRemaining(Math.max(0, t - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  if (remaining === null) {
    return (
      <div className={`font-mono ${className}`}>
        <div className="grid grid-cols-4 gap-2 sm:gap-3 md:gap-5">
          {["--", "--", "--", "--"].map((v, i) => (
            <div key={i} className="text-center opacity-40">
              <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight tabular-nums">
                {v}
              </div>
              <div className="text-[10px] md:text-xs uppercase tracking-[0.2em] opacity-60 mt-1">
                &nbsp;
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((remaining / (1000 * 60)) % 60);
  const secs = Math.floor((remaining / 1000) % 60);

  const units: Array<{ value: string; label: string }> = [
    { value: String(days), label: "days" },
    { value: pad(hours), label: "hrs" },
    { value: pad(mins), label: "min" },
    { value: pad(secs), label: "sec" },
  ];

  return (
    <div className={`font-mono ${className}`}>
      <div className="grid grid-cols-4 gap-2 sm:gap-3 md:gap-5">
        {units.map((u) => (
          <div key={u.label} className="text-center">
            <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight tabular-nums">
              {u.value}
            </div>
            <div className="text-[10px] md:text-xs uppercase tracking-[0.2em] opacity-60 mt-1">
              {u.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
