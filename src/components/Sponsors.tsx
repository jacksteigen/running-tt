/**
 * Sponsors strip. Data-driven: add a sponsor to the list and it renders.
 * Wordmarks are styled text until proper logo assets are supplied.
 */

interface Sponsor {
  name: string;
  url: string;
  tag?: string; // e.g. "Founding sponsor"
}

const sponsors: Sponsor[] = [
  {
    name: "STEIGEN",
    url: "https://www.steigen.com.au",
    tag: "Founding sponsor",
  },
];

export default function Sponsors() {
  return (
    <section className="bg-bone">
      <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
          <div className="lg:col-span-5">
            <h2 className="t-display text-[2.6rem] md:text-[3.6rem]">
              The purse is <em>backed.</em>
            </h2>
            <p className="mt-5 max-w-sm text-midnight/70 leading-relaxed">
              Prize money comes from entry fees and from the people who back
              the runners. You will always see who they are.
            </p>
          </div>

          <ul className="lg:col-span-7 border-t rule">
            {sponsors.map((s) => (
              <li key={s.name} className="border-b rule">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-baseline justify-between gap-6 py-6"
                >
                  <span className="t-eyebrow text-[1.5rem] md:text-[1.9rem] tracking-[0.2em] text-midnight group-hover:text-terracotta transition-colors duration-300">
                    {s.name}
                  </span>
                  {s.tag && <span className="t-caption text-midnight/55">{s.tag}</span>}
                </a>
              </li>
            ))}
            <li className="border-b rule">
              <a
                href="mailto:partners@runningtt.com?subject=Sponsoring%20Running%20TT"
                className="group flex items-baseline justify-between gap-6 py-6"
              >
                <span className="t-headline text-[1.3rem] md:text-[1.5rem] text-midnight/60 group-hover:text-terracotta transition-colors duration-300">
                  Your name here
                </span>
                <span className="link-draw text-[0.95rem] text-midnight">Back the purse</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
