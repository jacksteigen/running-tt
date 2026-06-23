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
    <section className="bg-bone border-t border-stone/40">
      <div className="mx-auto max-w-6xl px-6 py-14 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-3">
              Sponsors
            </p>
            <h2 className="text-2xl font-semibold tracking-tight mb-3">
              The purse is backed.
            </h2>
            <p className="text-sm text-midnight/60 leading-relaxed">
              Prize money at every event comes from entry fees plus cash from
              our sponsors. They back the runners, you see who they are.
            </p>
          </div>

          <div className="lg:col-span-2">
            <div className="flex flex-wrap items-center gap-4">
              {sponsors.map((s) => (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-white border border-stone/40 hover:border-midnight/30 transition-colors px-8 py-6"
                >
                  <p className="text-xl font-semibold tracking-[0.18em] group-hover:text-terracotta transition-colors">
                    {s.name}
                  </p>
                  {s.tag && (
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dust mt-1.5">
                      {s.tag}
                    </p>
                  )}
                </a>
              ))}

              {/* Become a sponsor */}
              <a
                href="mailto:partners@runningtt.com?subject=Sponsoring%20Running%20TT"
                className="border border-dashed border-dust/50 hover:border-terracotta px-8 py-6 transition-colors group"
              >
                <p className="text-sm font-medium text-midnight/70 group-hover:text-terracotta transition-colors">
                  Become a sponsor →
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dust mt-1.5">
                  Back the purse
                </p>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
