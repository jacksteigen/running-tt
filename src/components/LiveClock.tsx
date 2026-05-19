"use client";

import { useEffect, useState } from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Render a static placeholder on the server / first paint to avoid hydration flicker.
  const hh = now ? pad(now.getHours()) : "--";
  const mm = now ? pad(now.getMinutes()) : "--";
  const ss = now ? pad(now.getSeconds()) : "--";
  const ms = now ? pad(Math.floor(now.getMilliseconds() / 10)) : "--";

  return (
    <div className="font-mono text-stone/90 select-none">
      <div className="flex items-baseline leading-none">
        <span className="text-[2.6rem] sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-semibold tracking-tight">
          {hh}
        </span>
        <span className="text-[2.6rem] sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-semibold tracking-tight text-stone/40">
          :
        </span>
        <span className="text-[2.6rem] sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-semibold tracking-tight">
          {mm}
        </span>
        <span className="text-[2.6rem] sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-semibold tracking-tight text-stone/40">
          :
        </span>
        <span className="text-[2.6rem] sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-semibold tracking-tight text-terracotta">
          {ss}
        </span>
        {/* Hide the milliseconds on small screens so the clock never overflows */}
        <span className="hidden sm:inline text-2xl md:text-3xl font-semibold tracking-tight text-stone/40 ml-1">
          .{ms}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2 text-[10px] sm:text-xs uppercase tracking-[0.2em] text-stone/50">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-terracotta animate-pulse" />
        <span>Live · AEST</span>
      </div>
    </div>
  );
}
