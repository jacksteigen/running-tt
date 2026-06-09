import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "About · Running TT",
  description:
    "What Running TT is, how the format works, and why we started running these events.",
};

export default function AboutPage() {
  return (
    <>
      {/* Header */}
      <section className="bg-midnight text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <Image
            src="/images/athlete-track-side.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
            aria-hidden
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-midnight via-midnight/80 to-midnight/40"
          />
        </div>
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24 relative">
          <p className="font-mono text-xs text-terracotta uppercase tracking-[0.25em] mb-4">
            About
          </p>
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight max-w-2xl leading-[1.1]">
            A running event stripped back to what matters.
          </h1>
        </div>
      </section>

      {/* What is Running TT */}
      <section className="bg-bone">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div className="max-w-2xl">
            <p className="text-xs text-dust uppercase tracking-wide mb-2">
              The idea
            </p>
            <h2 className="text-2xl font-semibold tracking-tight mb-6">
              What is Running TT
            </h2>
            <div className="space-y-4 text-midnight/70 leading-relaxed">
              <p>
                Running TT is a programme of time trial events held around
                the world. We secure venues, run small heats across the event
                window, record every time, and pay prize money to the top 3.
              </p>
              <p>
                The time trial format means you are racing against the clock,
                not the person next to you. Every runner in every heat gets the
                same conditions. The leaderboard sorts it out.
              </p>
              <p>
                We run with atmosphere. Good music, a DJ, a crowd on the fence.
                But the event is still about the clock. Everything else is here
                to make the racing better.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Format */}
      <section className="bg-stone">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div className="max-w-2xl">
            <p className="text-xs text-dust uppercase tracking-wide mb-2">
              The format
            </p>
            <h2 className="text-2xl font-semibold tracking-tight mb-8">
              How an event runs
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 max-w-4xl">
            <div>
              <h3 className="font-semibold tracking-tight mb-2">
                Rolling heats
              </h3>
              <p className="text-sm text-midnight/60 leading-relaxed">
                Runners go off in small heats on a rolling basis. You check
                in, get assigned a heat, and line up when your number is
                called. Heats run continuously from the start of the event.
              </p>
            </div>
            <div>
              <h3 className="font-semibold tracking-tight mb-2">
                Event window
              </h3>
              <p className="text-sm text-midnight/60 leading-relaxed">
                Each event runs across a set window. Early heats go first,
                but the leaderboard stays open until the final heat crosses
                the line. Late starters can still win.
              </p>
            </div>
            <div>
              <h3 className="font-semibold tracking-tight mb-2">
                Times posted
              </h3>
              <p className="text-sm text-midnight/60 leading-relaxed">
                Every time gets recorded at the finish and added to the event
                page as the race wraps. Your run stays on the record after
                the event closes.
              </p>
            </div>
            <div>
              <h3 className="font-semibold tracking-tight mb-2">
                Prize money
              </h3>
              <p className="text-sm text-midnight/60 leading-relaxed">
                1st place takes $2,000. 2nd takes $1,000. 3rd takes $500. Every
                event, guaranteed. Prize money is awarded on the day, at the
                track.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Distance Rotation */}
      <section className="bg-bone">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div className="max-w-2xl">
            <p className="text-xs text-dust uppercase tracking-wide mb-2">
              Distances
            </p>
            <h2 className="text-2xl font-semibold tracking-tight mb-6">
              The distances
            </h2>
            <p className="text-midnight/70 leading-relaxed mb-8">
              Running TT runs four classic distances. Each one tests something
              different. What&apos;s on offer at a given event gets announced
              with the race.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 max-w-3xl">
            {[
              { distance: "Mile", length: "1.609 km", character: "Speed and guts" },
              { distance: "3K", length: "3 km", character: "Sharp and honest" },
              { distance: "5K", length: "5 km", character: "The benchmark" },
              { distance: "10K", length: "10 km", character: "Patience and pain" },
            ].map((d) => (
              <div
                key={d.distance}
                className="bg-white border border-stone/40 p-5"
              >
                <p className="text-2xl font-semibold tracking-tight">
                  {d.distance}
                </p>
                <p className="text-xs text-dust font-mono mt-1">{d.length}</p>
                <p className="text-xs text-midnight/50 mt-2">{d.character}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="bg-midnight text-white relative overflow-hidden">
        <div className="absolute inset-y-0 right-0 w-full lg:w-1/2 opacity-60 lg:opacity-100">
          <Image
            src="/images/steigen-singlet-back.webp"
            alt=""
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover object-center"
            aria-hidden
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-midnight via-midnight/80 to-midnight/20 lg:from-midnight lg:via-midnight/60 lg:to-transparent"
          />
        </div>
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24 relative">
          <div className="max-w-xl">
            <p className="font-mono text-xs text-terracotta uppercase tracking-[0.25em] mb-3">
              Philosophy
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-6">
              Human first
            </h2>
            <div className="space-y-4 text-stone/70 leading-relaxed">
              <p>
                Running TT uses technology. Timing systems, leaderboards,
                athlete profiles. But the technology is never the point. The
                point is showing up at a track on a Saturday morning with
                people who run.
              </p>
              <p>
                The clock is the great equaliser. It does not care about your
                age, your kit, your training philosophy, or your Instagram
                following. It just measures. That is what we celebrate, the
                honest act of putting yourself against a distance and a clock.
              </p>
              <p>
                Every time is earned. Every placement is earned. Every dollar of
                prize money is earned. Running TT exists to make that visible.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Steigen */}
      <section className="bg-bone">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-center">
            <div className="lg:col-span-3 order-2 lg:order-1">
              <p className="text-xs text-dust uppercase tracking-wide mb-2">
                Origins
              </p>
              <h2 className="text-2xl font-semibold tracking-tight mb-4">
                A Steigen initiative
              </h2>
              <p className="text-midnight/70 leading-relaxed mb-4">
                Running TT was founded by{" "}
                <a
                  href="https://www.steigen.com.au"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-terracotta underline underline-offset-4 decoration-terracotta/40 hover:decoration-terracotta transition-colors"
                >
                  Steigen
                </a>
                , an Australian performance running brand, to back the runners
                who make our sport.
              </p>
              <p className="text-midnight/70 leading-relaxed">
                The point is simple. Give Australian athletes somewhere to race
                often, in good conditions, and with real prize money on the
                line. Running is rarely paid at the grassroots level. This is
                one small step toward changing that, and a way to celebrate the
                people who train hard and line up anyway.
              </p>
            </div>
            <div className="lg:col-span-2 order-1 lg:order-2">
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-stone">
                <Image
                  src="/images/athlete-sock-bench.jpg"
                  alt="Runner pulling on a Steigen sock at the track"
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
