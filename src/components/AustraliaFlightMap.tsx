/**
 * Abstract map of Australia with dashed arcs flying into the two venue cities
 * (Geelong + Melbourne). The outline is a simplified polygon, not an exact
 * geographic match, and the city positions are loose but recognisable.
 */

interface City {
  name: string;
  x: number;
  y: number;
}

const cities: City[] = [
  { name: "Perth", x: 90, y: 520 },
  { name: "Darwin", x: 470, y: 60 },
  { name: "Cairns", x: 820, y: 180 },
  { name: "Brisbane", x: 925, y: 420 },
  { name: "Sydney", x: 905, y: 575 },
  { name: "Canberra", x: 865, y: 620 },
  { name: "Adelaide", x: 640, y: 600 },
  { name: "Hobart", x: 830, y: 770 },
];

// The two venue cities, shown larger.
const venues: City[] = [
  { name: "Melbourne", x: 790, y: 665 },
  { name: "Geelong", x: 760, y: 670 },
];

// Hand-tuned polygon that reads as Australia without being precise.
const aussiePath = [
  "M 110 480", // near Perth
  "L 180 360",
  "L 280 240",
  "L 380 150",
  "L 470 80",
  "L 540 110",
  "L 620 90",
  "L 720 120",
  "L 810 160",
  "L 860 240",
  "L 930 320",
  "L 950 420",
  "L 930 510",
  "L 900 580",
  "L 860 620",
  "L 810 660",
  "L 750 680",
  "L 680 660",
  "L 600 640",
  "L 520 620",
  "L 400 600",
  "L 300 580",
  "L 200 560",
  "L 140 540",
  "Z",
  // Tasmania (separate shape)
  "M 790 730",
  "L 830 720",
  "L 855 750",
  "L 835 785",
  "L 795 780",
  "L 780 755",
  "Z",
].join(" ");

export default function AustraliaFlightMap() {
  return (
    <section className="bg-midnight text-white relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24 relative">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-center">
          {/* Copy */}
          <div className="lg:col-span-2">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-4">
              Come from anywhere
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 leading-tight">
              Built in Victoria. Open to the country.
            </h2>
            <p className="text-stone/70 leading-relaxed mb-6">
              Runners fly in from every state. Geelong and Melbourne are the
              current home tracks, and travel weekends turn race day into a
              bigger event. If you&apos;re making the trip, tell us and
              we&apos;ll point you to the good coffee.
            </p>
            <div className="flex items-center gap-5 text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-terracotta" />
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-stone/60">
                  Host city
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-stone/50" />
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-stone/60">
                  Flying in
                </span>
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="lg:col-span-3">
            <svg
              viewBox="0 0 1000 820"
              className="w-full h-auto"
              role="img"
              aria-label="Map of Australia showing runners travelling to Geelong and Melbourne"
            >
              {/* Australia outline */}
              <path
                d={aussiePath}
                fill="rgba(245, 242, 236, 0.04)"
                stroke="rgba(245, 242, 236, 0.25)"
                strokeWidth="1"
              />

              {/* Flight arcs from each city to Melbourne */}
              {cities.map((c) => {
                const target = venues[0]; // Melbourne
                const mx = (c.x + target.x) / 2;
                const my = Math.min(c.y, target.y) - 80; // arc upwards
                return (
                  <g key={`arc-${c.name}`}>
                    <path
                      d={`M ${c.x} ${c.y} Q ${mx} ${my} ${target.x} ${target.y}`}
                      fill="none"
                      stroke="rgba(196, 89, 58, 0.55)"
                      strokeWidth="1.2"
                      strokeDasharray="4 6"
                      strokeLinecap="round"
                    >
                      <animate
                        attributeName="stroke-dashoffset"
                        from="0"
                        to="-40"
                        dur="2.8s"
                        repeatCount="indefinite"
                      />
                    </path>
                  </g>
                );
              })}

              {/* City dots */}
              {cities.map((c) => (
                <g key={c.name}>
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r="4"
                    fill="rgba(232, 226, 214, 0.7)"
                  />
                  <text
                    x={c.x}
                    y={c.y - 14}
                    textAnchor="middle"
                    fontFamily="JetBrains Mono, monospace"
                    fontSize="13"
                    fill="rgba(232, 226, 214, 0.6)"
                  >
                    {c.name}
                  </text>
                </g>
              ))}

              {/* Venue dots (larger, terracotta) */}
              {venues.map((v, i) => (
                <g key={v.name}>
                  <circle
                    cx={v.x}
                    cy={v.y}
                    r="9"
                    fill="#C4593A"
                    opacity="0.25"
                  >
                    <animate
                      attributeName="r"
                      values="9;14;9"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle cx={v.x} cy={v.y} r="5" fill="#C4593A" />
                  <text
                    x={v.x + (i === 0 ? 14 : -14)}
                    y={v.y + (i === 0 ? 5 : 20)}
                    textAnchor={i === 0 ? "start" : "end"}
                    fontFamily="JetBrains Mono, monospace"
                    fontSize="14"
                    fontWeight="600"
                    fill="#F5F2EC"
                  >
                    {v.name.toUpperCase()}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
