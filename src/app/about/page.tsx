import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import FirstInBand from "@/components/FirstInBand";
import PartnerEnquiryForm from "@/components/PartnerEnquiryForm";

export const metadata: Metadata = {
  title: "About · Running TT",
  description:
    "What Running TT is, how a race works, and how athletes and brands come together around a prize purse.",
};

const howItRuns = [
  {
    title: "Book your heat",
    body: "Pick a heat when you enter. Every heat has a set number of spots, and once it is booked out it is closed. First in, best dressed.",
  },
  {
    title: "Race the clock",
    body: "Heats go off through the event window. Every heat runs the same distance against the same clock, so a later heat can post the winning time.",
  },
  {
    title: "Times posted",
    body: "Every time is recorded at the finish and posted to the event page, then kept on your athlete profile.",
  },
  {
    title: "Prize money",
    body: "Every race pays out. The purse and how it splits are listed on the event page before you enter, and it is handed out on the day.",
  },
];

const brandCase = [
  {
    title: "Athletes chase the purse",
    body: "A real purse gives runners a real reason to race. It is funded by entry fees and by the brands who back it, so a bigger backing means more for the athletes.",
  },
  {
    title: "Brands get seen",
    body: "Your name on the purse, on race day and on the results, in front of people who train hard and buy what they trust.",
  },
  {
    title: "We make the introductions",
    body: "Every athlete tells us which brands they would love to run for. When a brand backs Running TT, we can put it in touch with runners who already want to work with it.",
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
                A start line, a clock, and a prize purse worth racing for.
                This is what Running TT is, how a race works, and where
                brands come in.
              </p>
            </div>
            <figure className="lg:col-span-5 motion-safe:animate-fade-up [animation-delay:150ms]">
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-bone/5">
                <Image
                  src="/images/steigen-singlet-back.webp"
                  alt="A runner seen from behind in a race singlet, hands on hips"
                  fill
                  priority
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover object-center"
                />
              </div>
              <figcaption className="t-caption mt-4 text-bone/55">
                Between heats.
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
                What Running TT is
              </h2>
              <div className={`lg:col-span-8 ${prose} text-midnight/80`}>
                <p className="first-letter:float-left first-letter:font-serif first-letter:text-[4.4rem] first-letter:leading-[0.82] first-letter:mr-3 first-letter:mt-[0.3rem] first-letter:text-midnight">
                  Running TT runs time trial races on tracks, roads, and
                  anywhere a good race can be held. You book a heat, run your
                  best, and your time goes on the record. The fastest runners
                  take home prize money.
                </p>
                <p>
                  Every heat races the same distance against the same clock,
                  so where you finish comes down to your time, not who you
                  happened to line up beside. Run the fastest time of the day
                  and you have beaten the whole field. Where a race pays in
                  women&apos;s and men&apos;s categories, the fastest time in
                  yours beats everyone in it, whichever heat they ran.
                </p>
                <p>
                  There is a third part to it, and it matters as much as the
                  first two: brands. Athletes want a purse worth chasing.
                  Brands want to be seen by people who genuinely run. Running
                  TT brings the two together.
                </p>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Where brands come in */}
      <section id="brands" className="bg-stone scroll-mt-20">
        <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
            <div className="lg:col-span-7">
              <h2 className="t-display text-[2.6rem] md:text-[3.8rem]">
                Where brands <em>come in.</em>
              </h2>
              <p className="t-lede mt-6 max-w-3xl text-midnight/75">
                Running TT works when three things line up: runners racing for
                something real, brands backing them, and someone making the
                connection.
              </p>
            </div>
            <div className="lg:col-span-5 relative aspect-[3/2] w-full overflow-hidden bg-midnight/5">
              <Image
                src="/images/spikes.webp"
                alt="Track spikes and pink running socks stepping across a lane line"
                fill
                sizes="(min-width: 1024px) 28rem, 100vw"
                className="object-cover object-[60%_55%]"
              />
            </div>
          </div>
          <ol className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-x-10 border-t border-midnight/15">
            {brandCase.map((item, i) => (
              <li key={item.title} className="border-b md:border-b-0 border-midnight/15 py-8 md:pt-10">
                <span className="t-numeral text-[1.6rem] text-terracotta">{i + 1}</span>
                <h3 className="mt-3 text-[1.5rem] md:text-[1.65rem] leading-tight">{item.title}</h3>
                <p className="mt-3 text-midnight/75 leading-relaxed">{item.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
            <div className="lg:col-span-4">
              <h3 className="t-headline text-[2rem] md:text-[2.4rem]">Back the purse</h3>
              <p className="mt-4 max-w-sm text-midnight/75 leading-relaxed">
                Tell us a little about your brand and what you are after. It
                comes straight to the Running TT team.
              </p>
            </div>
            <div className="lg:col-span-8">
              <PartnerEnquiryForm />
            </div>
          </div>
        </div>
      </section>

      {/* How an event runs */}
      <Reveal>
        <section className="bg-bone">
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
              <div className="lg:col-span-4">
                <h2 className="t-display text-[2.5rem] md:text-[3.3rem]">
                  How a race runs
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

      <FirstInBand tone="ink" href="/events" linkLabel="See the races" />

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
                  One distance per race, announced with the race. Usually one
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
            <div className="max-w-3xl">
              <h2 className="t-display text-[2.8rem] md:text-[4.2rem]">Human first.</h2>
              <div className={`mt-10 ${prose} text-bone/75`}>
                <p>
                  Running TT is built on simple things: a start line, a clock,
                  and people who turn up to run. Your results live on the event
                  page and on your athlete profile, so every run has a home.
                  But the website is never the point. The run is.
                </p>
                <p>
                  The clock does not care about your age, your kit, or your
                  following. It just measures. That is what we celebrate: the
                  honest act of putting yourself against a distance and a
                  clock.
                </p>
              </div>
              <p className="t-headline mt-12 max-w-[40rem] border-t rule-light pt-10 text-[1.75rem] md:text-[2.3rem] text-bone">
                Nobody is handed a time here. You run it, it goes on the
                record, and it stays yours.
              </p>
            </div>
          </div>
        </section>
      </Reveal>

      {/* A Steigen initiative */}
      <Reveal>
        <section className="bg-bone">
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <div className="max-w-3xl">
              <a
                href="https://www.steigen.com.au"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block py-2.5 -my-2.5 transition-opacity hover:opacity-70"
              >
                <Image
                  src="/images/steigen-logo-black.png"
                  alt="Steigen"
                  width={119}
                  height={28}
                  className="h-7 w-auto"
                />
              </a>
              <h2 className="mt-12 t-display text-[2.6rem] md:text-[3.6rem]">
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
                  , a performance running brand, to back the runners who make
                  our sport.
                </p>
                <p>
                  The idea is simple. Give runners somewhere to race in good
                  conditions, with real prize money on the line. Running is
                  rarely paid at the grassroots level. This is one step toward
                  changing that.
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
        </section>
      </Reveal>
    </>
  );
}
