/**
 * Horizontal timeline showing how rolling heats unfold across the 3-hour
 * event window. Each tick is a heat of 8 going off.
 */
export default function HeatsTimeline() {
  const heats = Array.from({ length: 14 }, (_, i) => {
    const minute = i * 13; // heat every ~13 minutes
    const hours = Math.floor(minute / 60);
    const mins = minute % 60;
    return {
      num: i + 1,
      label: `${String(8 + hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`,
    };
  });

  return (
    <div className="w-full">
      {/* Clock axis */}
      <div className="relative">
        <div className="h-px bg-stone/30 w-full" />
        <div className="flex justify-between mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-dust">
          <span>08:00</span>
          <span>09:00</span>
          <span>10:00</span>
          <span>11:00</span>
        </div>
      </div>

      {/* Heat ticks */}
      <div className="mt-8 relative">
        <div className="h-px bg-midnight/15 w-full absolute top-1/2" />
        <div className="flex justify-between relative">
          {heats.map((h) => (
            <div key={h.num} className="flex flex-col items-center">
              <span className="font-mono text-[10px] text-dust mb-1">
                H{h.num}
              </span>
              <span className="inline-block w-2 h-2 bg-terracotta rounded-full" />
              <span className="font-mono text-[10px] text-midnight/60 mt-2 tabular-nums">
                {h.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-8 text-sm text-midnight/60 text-center">
        A heat goes off roughly every 13 minutes across a 3-hour window.
      </p>
    </div>
  );
}
