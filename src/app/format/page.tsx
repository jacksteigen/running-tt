import type { Metadata } from "next";
import Link from "next/link";
import TrackDiagram from "@/components/TrackDiagram";
import HeatsTimeline from "@/components/HeatsTimeline";

export const metadata: Metadata = {
  title: "The Format · Running TT",
  description:
    "How a Running TT event unfolds. Rolling heats of 8 on a certified 400m track, live leaderboard, prize money for the top 3.",
};

const steps = [
  {
    number: "01",
    title: "Check in",
    body: "Arrive anytime in the 3-hour window. Show your QR, get your bib, pick up your timing chip. Warm up on the infield.",
  },
  {
    number: "02",
    title: "Line up in a heat of 8",
    body: "Heats roll off about every 13 minutes. When your number is called, walk onto the start line. No wave starts, no mass corrals.",
  },
  {
    number: "03",
    title: "Run the clock",
    body: "Gun goes. You run your distance. Times are captured by chip and verified at the finish.",
  },
  {
    number: "04",
    title: "Leaderboard updates live",
    body: "Your time hits the live leaderboard within seconds. Watch the standings shift as the field comes through.",
  },
  {
    number: "05",
    title: "Podium + payout",
    body: "After the final heat closes, the top 3 collect prize money on the day. Everyone else keeps their time on the page, forever.",
  },
];

const rules = [
  {
    label: "Track",
    body: "Certified 400m athletics tracks only. Proper surface, accurate distance, fair conditions.",
  },
  {
    label: "Distances",
    body: "The Mile, 3K, 5K and 10K rotate through each city calendar year.",
  },
  {
    label: "Timing",
    body: "Chip-timed by default. Apple Watch, Garmin and Strava links verify splits and ratify records.",
  },
  {
    label: "Prize money",
    body: "$2,000 · $1,000 · $500 for the top 3 in every event. No conditions, no minimums.",
  },
];

export default function FormatPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-midnight text-white relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent 0 79px, #F5F2EC 79px 80px)",
          }}
        />
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24 relative">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-5">
            The format
          </p>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05] max-w-3xl">
            Race against the clock. Not each other.
          </h1>
          <p className="mt-5 text-lg text-stone/70 max-w-2xl leading-relaxed">
            A time trial series run on certified tracks, in rolling heats of
            eight, under a live leaderboard. Built to be fast, fair, and
            honest.
          </p>
        </div>
      </section>

      {/* Track diagram */}
      <section className="bg-bone border-b border-stone/40">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-center">
            <div className="lg:col-span-1">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-3">
                On the line
              </p>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-5">
                Eight runners. One clock. One honest line.
              </h2>
              <p className="text-midnight/60 leading-relaxed">
                Every heat runs eight abreast on a certified 400m track. No
                waves, no pacers, no corrals. You line up, the gun fires, and
                the clock decides.
              </p>
            </div>
            <div className="lg:col-span-2 pt-12 lg:pt-0">
              <TrackDiagram />
            </div>
          </div>
        </div>
      </section>

      {/* Unfolds */}
      <section className="bg-bone">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-2">
            The day
          </p>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-12">
            How it unfolds
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {steps.map((s) => (
              <div
                key={s.number}
                className="border-t-2 border-midnight/10 pt-5"
              >
                <p className="font-mono text-terracotta text-sm mb-3">
                  {s.number}
                </p>
                <h3 className="font-semibold tracking-tight mb-2">
                  {s.title}
                </h3>
                <p className="text-sm text-midnight/60 leading-relaxed">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rolling heats timeline */}
      <section className="bg-stone">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div className="max-w-2xl mb-10">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-2">
              Rolling heats
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">
              A new heat every 13 minutes
            </h2>
            <p className="text-midnight/60 leading-relaxed">
              Heats are spread across a three-hour window. That means short
              queues at the start, a steady rhythm across the morning, and a
              leaderboard that keeps shifting until the final gun.
            </p>
          </div>

          <div className="bg-bone border border-stone/40 p-8 md:p-12">
            <HeatsTimeline />
          </div>
        </div>
      </section>

      {/* Rules */}
      <section className="bg-bone">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-2">
            Ground rules
          </p>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-10">
            Fair game, fast tracks
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 max-w-4xl">
            {rules.map((r) => (
              <div key={r.label} className="border-l-2 border-terracotta pl-5">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta mb-2">
                  {r.label}
                </p>
                <p className="text-midnight/70 leading-relaxed">{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-midnight text-white">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-3">
                Next up
              </p>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight max-w-xl">
                Seen enough. Found your distance.
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/events"
                className="inline-block bg-terracotta text-white font-medium px-7 py-3.5 text-sm hover:bg-terracotta/90 transition-colors"
              >
                Find an event
              </Link>
              <Link
                href="/about"
                className="inline-block border border-stone/20 text-white px-7 py-3.5 text-sm hover:border-stone/40 transition-colors"
              >
                Why we built it
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
