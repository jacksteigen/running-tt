/**
 * A venue drawn like the plan in a printed race programme: hairline lanes, a
 * small heat gathered behind the start line, and the race clock above.
 * Generic enough to read as either a track or a road loop. Used on /format.
 *
 * Shapes live in the SVG; the words sit on top as HTML so they stay legible
 * at phone width instead of shrinking with the drawing.
 */

// Drawing size. The overlay labels are positioned as a share of these.
const W = 900;
const H = 460;

// The loop: an outer edge and six lanes in to the infield.
const OUTER = { x: 40, y: 60, w: 820, h: 340 };
const LANE = 13;
const LANES = 6;

// The start line sits across the home straight.
const START_X = 300;
const STRAIGHT_TOP = OUTER.y + OUTER.h - LANE * LANES; // inner edge of the straight
const STRAIGHT_BOTTOM = OUTER.y + OUTER.h;

// A loose cluster behind the line rather than one runner per lane: runners
// set off together, and the venue is not always a lane-marked track.
const runners = [
  { x: 290, y: 330 },
  { x: 279, y: 343 },
  { x: 291, y: 356 },
  { x: 281, y: 369 },
  { x: 289, y: 382 },
  { x: 278, y: 394 },
];

const LEADER_X = 285;
const LEADER_TOP = 236;

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export default function TrackDiagram() {
  return (
    <figure className="w-full">
      {/* Race clock */}
      <div
        aria-hidden
        className="t-numeral flex items-baseline text-midnight text-[3rem] sm:text-[4rem] md:text-[4.6rem]"
      >
        <span>03</span>
        <span className="text-midnight/25 mx-[0.04em]">:</span>
        <span>27</span>
        <span className="text-midnight/25 mx-[0.04em]">:</span>
        <span className="text-terracotta">08</span>
      </div>

      <div className="relative mt-6 md:mt-8">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label="Race venue with a heat lined up at the start"
        >
          {/* Running surface */}
          <rect
            x={OUTER.x}
            y={OUTER.y}
            width={OUTER.w}
            height={OUTER.h}
            rx={OUTER.h / 2}
            fill="#C4593A"
            fillOpacity="0.15"
          />

          {/* Infield */}
          {(() => {
            const inset = LANE * LANES;
            const props = {
              x: OUTER.x + inset,
              y: OUTER.y + inset,
              width: OUTER.w - inset * 2,
              height: OUTER.h - inset * 2,
              rx: OUTER.h / 2 - inset,
            };
            return (
              <>
                <rect {...props} fill="#F5F2EC" />
                <rect {...props} fill="#2D5A3D" fillOpacity="0.09" />
              </>
            );
          })()}

          {/* Lane lines: the two edges firmer, the lanes between as hairlines */}
          {Array.from({ length: LANES + 1 }, (_, i) => {
            const o = i * LANE;
            const edge = i === 0 || i === LANES;
            return (
              <rect
                key={i}
                x={OUTER.x + o}
                y={OUTER.y + o}
                width={OUTER.w - o * 2}
                height={OUTER.h - o * 2}
                rx={OUTER.h / 2 - o}
                fill="none"
                stroke="#1A1A18"
                strokeOpacity={edge ? 0.5 : 0.16}
                strokeWidth={edge ? 1.25 : 1}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {/* Start line, with a tick down to its label */}
          <line
            x1={START_X}
            y1={STRAIGHT_TOP}
            x2={START_X}
            y2={STRAIGHT_BOTTOM}
            stroke="#1A1A18"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={START_X}
            y1={STRAIGHT_BOTTOM}
            x2={START_X}
            y2={STRAIGHT_BOTTOM + 12}
            stroke="#1A1A18"
            strokeOpacity="0.4"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />

          {/* Leader from the heat up to its note */}
          <line
            x1={LEADER_X}
            y1={STRAIGHT_TOP - 8}
            x2={LEADER_X}
            y2={LEADER_TOP}
            stroke="#1A1A18"
            strokeOpacity="0.4"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />

          {/* The heat, on the line */}
          {runners.map((r, i) => (
            <circle key={i} cx={r.x} cy={r.y} r="5" fill="#C4593A" />
          ))}
        </svg>

        {/* Note on the heat */}
        <div
          aria-hidden
          className="absolute pl-2.5"
          style={{ left: pct(LEADER_X, W), top: pct(LEADER_TOP - 10, H) }}
        >
          <p className="t-eyebrow text-dust leading-none">Heat 04</p>
          <p className="t-caption text-midnight/75 mt-1 whitespace-nowrap">On the line.</p>
        </div>

        {/* Start label */}
        <p
          aria-hidden
          className="absolute -translate-x-1/2 t-eyebrow text-midnight/60 leading-none"
          style={{ left: pct(START_X, W), top: pct(STRAIGHT_BOTTOM + 18, H) }}
        >
          Start
        </p>
      </div>
    </figure>
  );
}
