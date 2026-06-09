"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Slowly rotating orthographic globe. Latitude rings and meridian arcs are
 * re-projected each frame so the wireframe actually wraps around the sphere.
 * A wide spread of cities renders on the visible hemisphere only.
 */

interface City {
  name: string;
  lat: number;
  lon: number;
  tier?: 1 | 2; // 1 = always labelled, 2 = dot only (saves clutter)
}

const cities: City[] = [
  // Europe
  { name: "London", lat: 51.51, lon: -0.13, tier: 1 },
  { name: "Paris", lat: 48.86, lon: 2.35, tier: 1 },
  { name: "Berlin", lat: 52.52, lon: 13.4, tier: 1 },
  { name: "Madrid", lat: 40.42, lon: -3.7, tier: 1 },
  { name: "Rome", lat: 41.9, lon: 12.5, tier: 1 },
  { name: "Amsterdam", lat: 52.37, lon: 4.9, tier: 2 },
  { name: "Stockholm", lat: 59.33, lon: 18.07, tier: 1 },
  { name: "Lisbon", lat: 38.72, lon: -9.14, tier: 2 },
  { name: "Athens", lat: 37.98, lon: 23.73, tier: 2 },
  { name: "Moscow", lat: 55.76, lon: 37.62, tier: 1 },
  { name: "Istanbul", lat: 41.01, lon: 28.98, tier: 1 },
  // North America
  { name: "New York", lat: 40.71, lon: -74.01, tier: 1 },
  { name: "Los Angeles", lat: 34.05, lon: -118.24, tier: 1 },
  { name: "Toronto", lat: 43.65, lon: -79.38, tier: 1 },
  { name: "Chicago", lat: 41.88, lon: -87.63, tier: 2 },
  { name: "Vancouver", lat: 49.28, lon: -123.12, tier: 2 },
  { name: "Mexico City", lat: 19.43, lon: -99.13, tier: 1 },
  { name: "Miami", lat: 25.76, lon: -80.19, tier: 2 },
  // South America
  { name: "São Paulo", lat: -23.55, lon: -46.63, tier: 1 },
  { name: "Buenos Aires", lat: -34.61, lon: -58.38, tier: 1 },
  { name: "Lima", lat: -12.05, lon: -77.04, tier: 1 },
  { name: "Bogotá", lat: 4.71, lon: -74.07, tier: 2 },
  { name: "Rio", lat: -22.91, lon: -43.17, tier: 2 },
  // Africa
  { name: "Cape Town", lat: -33.92, lon: 18.42, tier: 1 },
  { name: "Cairo", lat: 30.04, lon: 31.24, tier: 1 },
  { name: "Lagos", lat: 6.52, lon: 3.38, tier: 1 },
  { name: "Nairobi", lat: -1.29, lon: 36.82, tier: 1 },
  { name: "Johannesburg", lat: -26.2, lon: 28.04, tier: 2 },
  { name: "Casablanca", lat: 33.57, lon: -7.59, tier: 2 },
  // Middle East
  { name: "Dubai", lat: 25.2, lon: 55.27, tier: 1 },
  { name: "Tel Aviv", lat: 32.08, lon: 34.78, tier: 2 },
  // Asia
  { name: "Tokyo", lat: 35.68, lon: 139.69, tier: 1 },
  { name: "Seoul", lat: 37.57, lon: 126.98, tier: 1 },
  { name: "Beijing", lat: 39.9, lon: 116.41, tier: 1 },
  { name: "Shanghai", lat: 31.23, lon: 121.47, tier: 2 },
  { name: "Hong Kong", lat: 22.32, lon: 114.17, tier: 1 },
  { name: "Singapore", lat: 1.35, lon: 103.82, tier: 1 },
  { name: "Bangkok", lat: 13.76, lon: 100.5, tier: 1 },
  { name: "Mumbai", lat: 19.08, lon: 72.88, tier: 1 },
  { name: "Delhi", lat: 28.61, lon: 77.21, tier: 1 },
  { name: "Jakarta", lat: -6.2, lon: 106.85, tier: 2 },
  { name: "Manila", lat: 14.6, lon: 120.98, tier: 2 },
  { name: "Kuala Lumpur", lat: 3.14, lon: 101.69, tier: 2 },
  // Oceania
  { name: "Sydney", lat: -33.87, lon: 151.21, tier: 1 },
  { name: "Melbourne", lat: -37.81, lon: 144.96, tier: 1 },
  { name: "Auckland", lat: -36.85, lon: 174.76, tier: 1 },
  { name: "Brisbane", lat: -27.47, lon: 153.03, tier: 2 },
  { name: "Perth", lat: -31.95, lon: 115.86, tier: 2 },
];

const SIZE = 600;
const CENTER = SIZE / 2;
const RADIUS = SIZE * 0.4;
const TILT = -15; // slight axial tilt for character

const deg = Math.PI / 180;

function project(lat: number, lon: number, rotation: number) {
  const phi = lat * deg;
  const lambda = (lon - rotation) * deg;
  const t = TILT * deg;

  const x0 = Math.cos(phi) * Math.sin(lambda);
  const y0 = Math.sin(phi);
  const z0 = Math.cos(phi) * Math.cos(lambda);

  const y1 = y0 * Math.cos(t) - z0 * Math.sin(t);
  const z1 = y0 * Math.sin(t) + z0 * Math.cos(t);

  return {
    x: CENTER + RADIUS * x0,
    y: CENTER - RADIUS * y1,
    visible: z1 > -0.001,
    z: z1,
  };
}

function buildLatPath(lat: number, rotation: number) {
  let d = "";
  let started = false;
  for (let lon = -180; lon <= 180; lon += 4) {
    const p = project(lat, lon, rotation);
    if (p.visible) {
      d += `${started ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
      started = true;
    } else {
      started = false;
    }
  }
  return d;
}

function buildLonPath(lon: number, rotation: number) {
  let d = "";
  let started = false;
  for (let lat = -85; lat <= 85; lat += 4) {
    const p = project(lat, lon, rotation);
    if (p.visible) {
      d += `${started ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
      started = true;
    } else {
      started = false;
    }
  }
  return d;
}

export default function GlobeMap() {
  const [rotation, setRotation] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = (t - startRef.current) / 1000;
      setRotation(elapsed * 5); // 5 deg/s = 72s full rotation
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Latitude lines: equator, tropics, mid latitudes, polar circles.
  const lats = [-66.5, -45, -23.5, 0, 23.5, 45, 66.5];
  // Meridians every 15°.
  const lons: number[] = [];
  for (let l = 0; l < 360; l += 15) lons.push(l);

  return (
    <section className="bg-midnight text-white relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24 relative">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-center">
          {/* Copy */}
          <div className="lg:col-span-2">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-4">
              Worldwide
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 leading-tight">
              Wherever the runners are.
            </h2>
            <p className="text-stone/70 leading-relaxed">
              Running TT is built to run anywhere there&apos;s a good venue
              and athletes who want to race. Each event is announced as it
              gets locked in, so check back often.
            </p>
          </div>

          {/* Globe */}
          <div className="lg:col-span-3 flex justify-center">
            <svg
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="w-full max-w-[560px] h-auto"
              role="img"
              aria-label="Rotating globe showing major cities worldwide"
            >
              <defs>
                <radialGradient id="globe-body" cx="35%" cy="32%" r="75%">
                  <stop offset="0%" stopColor="#2a2a26" />
                  <stop offset="60%" stopColor="#15150f" />
                  <stop offset="100%" stopColor="#08080a" />
                </radialGradient>
                <radialGradient id="globe-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="60%" stopColor="rgba(196, 89, 58, 0)" />
                  <stop offset="100%" stopColor="rgba(196, 89, 58, 0.2)" />
                </radialGradient>
              </defs>

              {/* Soft outer glow */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS + 44}
                fill="url(#globe-glow)"
              />

              {/* Sphere body */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="url(#globe-body)"
                stroke="rgba(245, 242, 236, 0.22)"
                strokeWidth="1"
              />

              {/* Latitude rings */}
              {lats.map((lat) => (
                <path
                  key={`lat-${lat}`}
                  d={buildLatPath(lat, rotation)}
                  fill="none"
                  stroke={
                    lat === 0
                      ? "rgba(232, 226, 214, 0.32)"
                      : "rgba(232, 226, 214, 0.16)"
                  }
                  strokeWidth={lat === 0 ? "0.8" : "0.5"}
                />
              ))}

              {/* Meridian arcs */}
              {lons.map((lon) => (
                <path
                  key={`lon-${lon}`}
                  d={buildLonPath(lon, rotation)}
                  fill="none"
                  stroke="rgba(232, 226, 214, 0.14)"
                  strokeWidth="0.5"
                />
              ))}

              {/* Cities */}
              {cities.map((c) => {
                const p = project(c.lat, c.lon, rotation);
                if (!p.visible) return null;
                const edgeFade = Math.min(1, Math.max(0, p.z + 0.05) / 0.35);
                const isMajor = c.tier === 1;
                const labelRight = p.x < CENTER + RADIUS * 0.6;
                return (
                  <g key={c.name} style={{ opacity: edgeFade }}>
                    {isMajor && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="8"
                        fill="#D4A84B"
                        opacity="0.18"
                      >
                        <animate
                          attributeName="r"
                          values="5;11;5"
                          dur="3.6s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isMajor ? 2.6 : 1.6}
                      fill="#D4A84B"
                      opacity={isMajor ? 1 : 0.7}
                    />
                    {isMajor && (
                      <text
                        x={labelRight ? p.x + 8 : p.x - 8}
                        y={p.y + 4}
                        textAnchor={labelRight ? "start" : "end"}
                        fontFamily="JetBrains Mono, monospace"
                        fontSize="10.5"
                        fill="#F5F2EC"
                        opacity="0.88"
                      >
                        {c.name}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Subtle front-left highlight */}
              <ellipse
                cx={CENTER - RADIUS * 0.35}
                cy={CENTER - RADIUS * 0.3}
                rx={RADIUS * 0.45}
                ry={RADIUS * 0.25}
                fill="rgba(255, 255, 255, 0.04)"
              />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
