/**
 * Stylised 400 m athletics track with eight runners lined up at the start,
 * plus a big mono race clock above. Intended as a visual hero for /format.
 */
export default function TrackDiagram() {
  // The track is drawn as two concentric rounded rectangles to show lanes.
  // Eight runners sit on the straight near the start line.
  const runners = Array.from({ length: 8 }, (_, i) => ({
    x: 180 + i * 55,
    y: 270,
    lane: i + 1,
  }));

  return (
    <div className="relative w-full">
      {/* Floating clock */}
      <div className="absolute left-1/2 -translate-x-1/2 -top-3 md:-top-6 z-10">
        <div className="inline-flex items-baseline gap-1 bg-midnight text-white px-5 py-3 border border-stone/20 font-mono tabular-nums">
          <span className="text-2xl md:text-3xl font-semibold">03</span>
          <span className="text-2xl md:text-3xl font-semibold text-stone/40">
            :
          </span>
          <span className="text-2xl md:text-3xl font-semibold">27</span>
          <span className="text-2xl md:text-3xl font-semibold text-stone/40">
            :
          </span>
          <span className="text-2xl md:text-3xl font-semibold text-terracotta">
            08
          </span>
        </div>
      </div>

      <svg
        viewBox="0 0 900 500"
        className="w-full h-auto"
        role="img"
        aria-label="Running track with 8 runners lined up at the start"
      >
        {/* Outer track surface */}
        <rect
          x="60"
          y="80"
          width="780"
          height="340"
          rx="170"
          fill="#2D5A3D"
          fillOpacity="0.08"
          stroke="#2D5A3D"
          strokeOpacity="0.4"
          strokeWidth="1"
        />

        {/* Track surface proper */}
        <rect
          x="90"
          y="110"
          width="720"
          height="280"
          rx="140"
          fill="#C4593A"
          fillOpacity="0.12"
          stroke="#C4593A"
          strokeOpacity="0.3"
          strokeWidth="1"
        />

        {/* Lane lines */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const offset = i * 9;
          return (
            <rect
              key={i}
              x={96 + offset}
              y={116 + offset}
              width={708 - offset * 2}
              height={268 - offset * 2}
              rx={137 - offset}
              fill="none"
              stroke="#F5F2EC"
              strokeOpacity="0.3"
              strokeWidth="0.5"
            />
          );
        })}

        {/* Infield */}
        <rect
          x="165"
          y="185"
          width="570"
          height="130"
          rx="65"
          fill="#2D5A3D"
          fillOpacity="0.35"
        />

        {/* Start line */}
        <line
          x1="170"
          y1="250"
          x2="170"
          y2="320"
          stroke="#F5F2EC"
          strokeWidth="2"
        />
        <text
          x="170"
          y="345"
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize="10"
          fill="#F5F2EC"
          opacity="0.6"
          letterSpacing="2"
        >
          START
        </text>

        {/* Runners */}
        {runners.map((r) => (
          <g key={r.lane}>
            {/* Runner dot */}
            <circle
              cx={r.x}
              cy={r.y}
              r="8"
              fill="#C4593A"
              opacity={0.35 + r.lane * 0.08}
            />
            <circle cx={r.x} cy={r.y} r="4" fill="#F5F2EC" />
            <text
              x={r.x}
              y={r.y + 24}
              textAnchor="middle"
              fontFamily="JetBrains Mono, monospace"
              fontSize="10"
              fill="#F5F2EC"
              opacity="0.5"
            >
              {r.lane}
            </text>
          </g>
        ))}

        {/* Heat label */}
        <g>
          <rect
            x="620"
            y="120"
            width="180"
            height="60"
            fill="#1A1A18"
            stroke="#F5F2EC"
            strokeOpacity="0.2"
            strokeWidth="1"
          />
          <text
            x="710"
            y="143"
            textAnchor="middle"
            fontFamily="JetBrains Mono, monospace"
            fontSize="10"
            fill="#F5F2EC"
            opacity="0.5"
            letterSpacing="2"
          >
            HEAT 04 · 8 RUNNERS
          </text>
          <text
            x="710"
            y="165"
            textAnchor="middle"
            fontFamily="JetBrains Mono, monospace"
            fontSize="14"
            fill="#D4A84B"
            fontWeight="600"
          >
            ON THE LINE
          </text>
        </g>

        {/* Distance label inside infield */}
        <text
          x="450"
          y="260"
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize="12"
          fill="#F5F2EC"
          opacity="0.6"
          letterSpacing="3"
        >
          400m
        </text>
      </svg>
    </div>
  );
}
