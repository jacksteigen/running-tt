/**
 * Heats rolling off across the event window, drawn like a timing tape: one
 * baseline, a tick for every heat. Deliberately keeps off specific clock
 * times or heat counts because those vary per event. Responsive: shows fewer
 * heats on mobile so labels don't collide.
 */
export default function HeatsTimeline() {
  // Twelve heats on desktop, but every other one is hidden on mobile (so six show).
  const heats = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <figure className="w-full">
      <div className="flex items-baseline justify-between t-eyebrow text-dust mb-6 md:mb-8">
        <span>Event opens</span>
        <span>Event closes</span>
      </div>

      <div className="relative">
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-midnight/30" />
        <ol className="relative flex justify-between">
          {heats.map((num, i) => {
            // Hide every other heat on mobile to give labels room to breathe.
            const hideOnMobile =
              i !== 0 && i !== heats.length - 1 && i % 2 !== 0;
            return (
              <li
                key={num}
                className={`flex flex-col items-center ${
                  hideOnMobile ? "hidden sm:flex" : ""
                }`}
              >
                <span className="t-numeral text-[0.95rem] sm:text-[1.05rem] text-midnight/70 mb-3">
                  H{num}
                </span>
                <span aria-hidden className="block w-[2px] h-6 sm:h-8 bg-terracotta" />
              </li>
            );
          })}
        </ol>
      </div>

      <figcaption className="t-caption mt-6 text-[1rem] text-midnight/60">
        Heats roll off continuously across the event window.
      </figcaption>
    </figure>
  );
}
