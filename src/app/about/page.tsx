import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/Reveal";

export const metadata: Metadata = {
  title: "About · Running TT",
  description:
    "What Running TT is, how the format works, and why we started running these events.",
};

const howItRuns = [
  {
    title: "Rolling heats",
    body: "Runners go off in small heats on a rolling basis. You check in, get assigned a heat, and line up when your number is called. Heats run continuously from the start of the event.",
  },
  {
    title: "Event window",
    body: "Each event runs across a set window. Early heats go first, but the leaderboard stays open until the final heat crosses the line. Late starters can still win.",
  },
  {
    title: "Times posted",
    body: "Every time gets recorded at the finish and added to the event page as the race wraps. Your run stays on the record after the event closes.",
  },
  {
    title: "Prize money",
    body: "Every event pays out prize money. What the purse is and how it is split gets announced with each race and listed on the event page. It is handed out on the day, at the finish.",
  },
];

const distances = [
  { distance: "Mile", length: "1.609 km", character: "Speed and guts" },
  { distance: "3K", length: "3 km", character: "Sharp and honest" },
  { distance: "5K", length: "5 km", character: "The benchmark" },
  {
    distance: "Or else",
    length: "you tell us",
    character: "400m up a hill, if it makes a race",
    open: true,
  },
];

/** Long-form reading measure shared by every block of body copy. */
const prose =
  "max-w-[40rem] space-y-6 text-[1.075rem] md:text-[1.125rem] leading-[1.75]";

export default function AboutPage() {
  return (
    <>
      {/* Opener */}
      <section className="bg-midnight text-bone">
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-20 md:pt-28 md:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-end">
            <div className="lg:col-span-7 motion-safe:animate-fade-up">
              <h1 className="t-display text-[3rem] sm:text-[4rem] md:text-[5rem] lg:text-[5.2rem]">
                A running event stripped back to{" "}
                <em className="text-bone/75">what matters.</em>
              </h1>
              <p className="t-lede mt-8 max-w-xl text-bone/80">
                Small heats, an honest clock, and prize money at every race.
                This is what Running TT is, how it works, and why we started
                it.
              </p>
            </div>
            <figure className="lg:col-span-5 motion-safe:animate-fade-up [animation-delay:150ms]">
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-bone/5">
                <Image
                  src="/images/athlete-track-side.jpg"
                  alt="An athlete smiling on a blue running track"
                  fill
                  priority
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover object-[50%_35%]"
                />
              </div>
              <figcaption className="t-caption mt-4 text-bone/55">
                Trackside, and smiling about it.
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* What it is */}
      <Reveal>
        <section className="bg-bone">
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
              <h2 className="lg:col-span-4 t-display text-[2.5rem] md:text-[3.3rem]">
                What Running TT <em>is</em>
              </h2>
              <div className={`lg:col-span-8 ${prose} text-midnight/80`}>
                <p className="first-letter:float-left first-letter:font-serif first-letter:text-[4.4rem] first-letter:leading-[0.82] first-letter:mr-3 first-letter:mt-[0.3rem] first-letter:text-midnight">
                  Running TT is a programme of time trial events held around
                  the world. We secure venues, run small heats across the event
                  window, record every time, and pay out prize money.
                </p>
                <p>
                  The time trial format means you are racing against the clock,
                  not the person next to you. Every runner in every heat gets
                  the same conditions. The leaderboard sorts it out.
                </p>
                <p>
                  We run with atmosphere. Good music, a DJ, a crowd on the
                  fence. But the event is still about the clock. Everything
                  else is here to make the racing better.
                </p>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* How an event runs */}
      <Reveal>
        <section className="bg-stone">
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
              <div className="lg:col-span-4">
                <h2 className="t-display text-[2.5rem] md:text-[3.3rem]">
                  How an event runs
                </h2>
                <Link href="/format" className="inline-block mt-4 py-2.5 link-quiet text-midnight">
                  The full format
                </Link>
              </div>
              <dl className="lg:col-span-8 border-t rule">
                {howItRuns.map((item) => (
                  <div
                    key={item.title}
                    className="grid grid-cols-1 md:grid-cols-[12rem_1fr] gap-x-8 gap-y-2 border-b rule py-7 md:py-8"
                  >
                    <dt className="t-headline text-[1.45rem] md:text-[1.6rem]">{item.title}</dt>
                    <dd className="max-w-[36rem] text-midnight/75 leading-relaxed">{item.body}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Distances */}
      <Reveal>
        <section className="bg-bone">
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
              <div className="lg:col-span-4">
                <h2 className="t-display text-[2.5rem] md:text-[3.3rem]">
                  The distances
                </h2>
                <p className="mt-6 max-w-sm text-midnight/75 leading-relaxed">
                  One distance per event, announced with the race. Usually one
                  of the classics, sometimes something odd we think will make a
                  good race. If it can be timed, it can be raced.
                </p>
              </div>
              <ul className="lg:col-span-8 border-t rule">
                {distances.map((d) => (
                  <li
                    key={d.distance}
                    className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_8rem_16rem] items-baseline gap-x-6 gap-y-2 border-b rule py-6 md:py-7"
                  >
                    <span
                      className={`t-display text-[2.6rem] md:text-[3.4rem] ${
                        d.open ? "text-midnight/75" : "text-midnight"
                      }`}
                    >
                      {d.open ? <em>{d.distance}</em> : d.distance}
                    </span>
                    <span className="t-numeral text-[1.1rem] md:text-[1.25rem] text-dust text-right md:text-left">
                      {d.length}
                    </span>
                    <span className="col-span-2 md:col-span-1 t-caption text-[1rem] text-midnight/65">
                      {d.character}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Human first */}
      <Reveal>
        <section className="bg-midnight text-bone">
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 lg:gap-16 items-start">
              <div className="lg:col-span-7">
                <h2 className="t-display text-[2.8rem] md:text-[4.2rem]">
                  Human first.
                </h2>
                <div className={`mt-10 ${prose} text-bone/75`}>
                  <p>
                    Running TT uses technology. Timing systems, leaderboards,
                    athlete profiles. But the technology is never the point.
                    The point is showing up at a track on a Saturday morning
                    with people who run.
                  </p>
                  <p>
                    The clock is the great equaliser. It does not care about
                    your age, your kit, your training philosophy, or your
                    Instagram following. It just measures. That is what we
                    celebrate, the honest act of putting yourself against a
                    distance and a clock.
                  </p>
                </div>
                <p className="t-headline mt-12 max-w-[40rem] border-t rule-light pt-10 text-[1.75rem] md:text-[2.3rem] text-bone">
                  Nobody is handed a time here. You run it, it goes on the
                  record, and it stays yours.{" "}
                  <em className="text-gold">Running TT exists to make that visible.</em>
                </p>
              </div>
              <figure className="lg:col-span-5 lg:mt-24">
                <div className="relative aspect-square w-full overflow-hidden bg-bone/5">
                  <Image
                    src="/images/steigen-singlet-back.webp"
                    alt="A runner seen from behind in a Steigen singlet, hands on hips"
                    fill
                    sizes="(min-width: 1024px) 40vw, 100vw"
                    className="object-cover object-center"
                  />
                </div>
                <figcaption className="t-caption mt-4 text-bone/55">
                  Late light, hands on hips.
                </figcaption>
              </figure>
            </div>
          </div>
        </section>
      </Reveal>

      {/* A Steigen initiative */}
      <Reveal>
        <section className="bg-bone">
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              <figure className="lg:col-span-5">
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-stone">
                  <Image
                    src="/images/athlete-sock-bench.jpg"
                    alt="Runner pulling on a Steigen sock at the track"
                    fill
                    sizes="(min-width: 1024px) 40vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <figcaption className="t-caption mt-4 text-midnight/55">
                  Fresh socks. The work starts soon.
                </figcaption>
              </figure>
              <div className="lg:col-span-7">
                <h2 className="t-display text-[2.6rem] md:text-[3.6rem]">
                  A Steigen initiative
                </h2>
                <div className={`mt-8 ${prose} text-midnight/80`}>
                  <p>
                    Running TT was founded by{" "}
                    <a
                      href="https://www.steigen.com.au"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-quiet text-midnight"
                    >
                      Steigen
                    </a>
                    , an Australian performance running brand, to back the
                    runners who make our sport.
                  </p>
                  <p>
                    The point is simple. Give Australian athletes somewhere to
                    race often, in good conditions, and with real prize money on
                    the line. Running is rarely paid at the grassroots level.
                    This is one small step toward changing that, and a way to
                    celebrate the people who train hard and line up anyway.
                  </p>
                </div>
                <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5">
                  <Link href="/events" className="btn btn-primary">
                    Find a race
                  </Link>
                  <Link href="/format" className="py-2.5 link-quiet text-midnight">
                    How the format works
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </Reveal>
    </>
  );
}
