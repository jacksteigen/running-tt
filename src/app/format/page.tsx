import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import TrackDiagram from "@/components/TrackDiagram";
import HeatsTimeline from "@/components/HeatsTimeline";
import Reveal from "@/components/Reveal";

export const metadata: Metadata = {
  title: "The Format · Running TT",
  description:
    "How a Running TT event unfolds. Rolling heats, every time recorded, prize money at every race.",
};

const steps = [
  {
    title: "Check in",
    body: "Arrive anytime in the event window. Pick up your bib and warm up before your heat is called.",
  },
  {
    title: "Line up in a small heat",
    body: "Heats roll off continuously. When your number is called, walk onto the start line. No wave starts, no mass corrals.",
  },
  {
    title: "Run the clock",
    body: "Gun goes. You run your distance. Your time gets recorded at the finish.",
  },
  {
    title: "Times posted",
    body: "Times go up on the event page as the race wraps. Your run stays on the page afterwards.",
  },
  {
    title: "Payout",
    body: "After the final heat closes, prize money is handed out on the day. Everyone else keeps their time on the record.",
  },
];

const rules = [
  {
    label: "Venue",
    body: "Tracks, road courses, anywhere a good race can be held. The venue is announced with the race.",
  },
  {
    label: "Distance",
    body: "One distance per event, announced with the race. Often a Mile, 3K, 5K or 10K, sometimes something stranger, like 400m up a hill. If it can be timed, it can be raced.",
  },
  {
    label: "Timing",
    body: "Every time gets recorded at the finish. How depends on the venue, and is announced with the race.",
  },
  {
    label: "Entry fee",
    body: "One entry fee per race, set for that race and shown on the event page before you enter. No tiers, no surprises. If a race is free, the event page says so.",
  },
  {
    label: "Prize money",
    body: "Every event pays out. The purse and how it is split gets announced with the race and is listed on the event page before you enter. The money comes from entry fees plus cash from our sponsors.",
  },
];

export default function FormatPage() {
  return (
    <>
      {/* Opener */}
      <section className="bg-midnight text-bone">
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-20 md:pt-28 md:pb-28">
          <div className="max-w-4xl motion-safe:animate-fade-up">
            <h1 className="t-display text-[3rem] sm:text-[4rem] md:text-[5.4rem]">
              Race against the clock.{" "}
              <em className="text-bone/75">Not each other.</em>
            </h1>
            <p className="t-lede mt-8 max-w-2xl text-bone/80">
              Time trial events run in rolling heats, with every time recorded
              and prize money on the line. Built to be honest, fair, and worth
              your time.
            </p>
          </div>
        </div>
      </section>

      {/* On the line */}
      <Reveal>
        <section className="bg-bone">
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 lg:gap-12 items-center">
              <div className="lg:col-span-4">
                <h2 className="t-display text-[2.5rem] md:text-[3.3rem]">
                  Small heats. One clock. <em>One honest line.</em>
                </h2>
                <p className="mt-6 max-w-sm text-midnight/75 leading-relaxed">
                  Every heat lines up together at the same start. No waves, no
                  pacers, no corrals. You line up, the gun fires, and the clock
                  decides.
                </p>
              </div>
              <div className="lg:col-span-8">
                <TrackDiagram />
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* How the day unfolds */}
      <Reveal>
        <section className="bg-bone">
          <div className="mx-auto max-w-6xl px-6">
            <div className="border-t rule py-24 md:py-32 grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-10">
              <h2 className="lg:col-span-4 t-display text-[2.5rem] md:text-[3.3rem]">
                How the day unfolds
              </h2>
              <ol className="lg:col-span-8 lg:col-start-5 lg:row-span-2 border-t rule">
                {steps.map((s, i) => (
                  <li
                    key={s.title}
                    className="grid grid-cols-[2.5rem_1fr] md:grid-cols-[4rem_1fr] gap-4 border-b rule py-7"
                  >
                    <span className="t-numeral text-[1.6rem] text-terracotta">{i + 1}</span>
                    <div>
                      <h3 className="text-[1.45rem] md:text-[1.6rem] leading-tight">{s.title}</h3>
                      <p className="mt-2 max-w-xl text-midnight/70 leading-relaxed">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <figure className="lg:col-span-4 lg:row-start-2 lg:self-end">
                <div className="relative aspect-[4/5] lg:aspect-[3/4] w-full overflow-hidden bg-stone">
                  <Image
                    src="/images/athlete-track-lane.jpg"
                    alt="An athlete standing in lane six of a blue running track"
                    fill
                    sizes="(min-width: 1024px) 30vw, 100vw"
                    className="object-cover object-[45%_40%]"
                  />
                </div>
                <figcaption className="t-caption mt-4 text-midnight/55">
                  Lane six. Nobody to chase but the clock.
                </figcaption>
              </figure>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Rolling heats */}
      <Reveal>
        <section className="bg-stone">
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <div className="max-w-2xl">
              <h2 className="t-display text-[2.5rem] md:text-[3.3rem]">
                A steady rolling start
              </h2>
              <p className="mt-6 max-w-xl text-midnight/75 leading-relaxed">
                Heats are spread across the event window. That means short
                queues at the start, a steady rhythm through the day, and a
                full record of times by the end.
              </p>
            </div>
            <div className="mt-16 md:mt-20">
              <HeatsTimeline />
            </div>
          </div>
        </section>
      </Reveal>

      {/* Ground rules */}
      <Reveal>
        <section className="bg-bone">
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
              <h2 className="lg:col-span-4 t-display text-[2.5rem] md:text-[3.3rem]">
                Fair game, fast courses
              </h2>
              <dl className="lg:col-span-8 border-t rule">
                {rules.map((r) => (
                  <div
                    key={r.label}
                    className="grid grid-cols-1 md:grid-cols-[11rem_1fr] gap-x-8 gap-y-2 border-b rule py-7 md:py-8"
                  >
                    <dt className="t-headline text-[1.45rem] md:text-[1.6rem]">{r.label}</dt>
                    <dd className="max-w-[36rem] text-midnight/75 leading-relaxed">{r.body}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Close */}
      <section className="bg-stone">
        <div className="mx-auto max-w-6xl px-6 py-24 md:py-28">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-10">
            <h2 className="t-display text-[2.8rem] md:text-[4rem] max-w-2xl">
              Seen enough. Now find your distance.
            </h2>
            <div className="flex flex-wrap gap-3">
              <Link href="/events" className="btn btn-primary btn-lg">
                Find an event
              </Link>
              <Link href="/about" className="btn btn-ghost btn-lg">
                Why we built it
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
