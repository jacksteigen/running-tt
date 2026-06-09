/**
 * Abstract horizontal timeline showing heats rolling off across the event
 * window. Deliberately keeps off specific clock times or heat counts because
 * those vary per event. Responsive: shows fewer dots on mobile so labels
 * don't collide.
 */
export default function HeatsTimeline() {
  // Twelve dots on desktop, but every other one is hidden on mobile (so six show).
  const heats = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-dust mb-4">
        <span>Event opens</span>
        <span>Event closes</span>
      </div>

      <div className="relative">
        <div className="h-px bg-midnight/15 w-full absolute top-1/2" />
        <div className="flex justify-between relative">
          {heats.map((num, i) => {
            // Hide every other dot on mobile to give labels room to breathe.
            const hideOnMobile =
              i !== 0 && i !== heats.length - 1 && i % 2 !== 0;
            return (
              <div
                key={num}
                className={`flex flex-col items-center ${
                  hideOnMobile ? "hidden sm:flex" : ""
                }`}
              >
                <span className="font-mono text-[9px] sm:text-[10px] text-dust mb-1">
                  H{num}
                </span>
                <span className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 bg-terracotta rounded-full" />
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-6 text-sm text-midnight/60 text-center">
        Heats roll off continuously across the event window.
      </p>
    </div>
  );
}
