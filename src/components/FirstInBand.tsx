import Link from "next/link";

/**
 * The booking rule, said plainly and given room: heats are capped, and once
 * a heat is booked out it is gone. Used on the home, events and about pages.
 */
export default function FirstInBand({
  tone = "ink",
  spots,
  heats,
  href,
  linkLabel = "Book your heat",
}: {
  tone?: "ink" | "bone" | "terracotta";
  /** Total spots across the next race's heats, when known. */
  spots?: number | null;
  heats?: number | null;
  href?: string | null;
  linkLabel?: string;
}) {
  const dark = tone !== "bone";
  const bg =
    tone === "ink" ? "bg-midnight text-bone" : tone === "terracotta" ? "bg-terracotta text-bone" : "bg-stone text-midnight";

  return (
    <section className={bg}>
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end">
          <div className="lg:col-span-7">
            <p className={`t-eyebrow ${dark ? "text-bone/60" : "text-dust"}`}>How booking works</p>
            <h2 className="t-display mt-4 text-[2.8rem] sm:text-[3.6rem] md:text-[4.4rem]">
              First in, <em className={tone === "ink" ? "text-terracotta" : ""}>best dressed.</em>
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p className={`text-[1.05rem] leading-relaxed ${dark ? "text-bone/85" : "text-midnight/75"}`}>
              Every heat has a set number of spots. Once a heat is booked out,
              it is closed, and the only way in is a spot in another heat.
              Book early to race when you want to.
            </p>
            {(spots || href) && (
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                {spots && heats ? (
                  <p className={`t-eyebrow ${dark ? "text-bone/70" : "text-dust"}`}>
                    Next race: <span className="t-numeral text-[1.05rem] align-baseline">{spots}</span> spots across{" "}
                    <span className="t-numeral text-[1.05rem] align-baseline">{heats}</span> heats
                  </p>
                ) : null}
                {href && (
                  <Link
                    href={href}
                    className={`inline-flex min-h-11 items-center link-quiet ${dark ? "text-bone" : "text-midnight"}`}
                  >
                    {linkLabel}
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
