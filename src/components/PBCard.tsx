interface PBCardProps {
  distance: string;
  time: string;
  verified?: boolean;
  /** "dark" when it sits on midnight. */
  tone?: "light" | "dark";
}

/**
 * A personal best as one line of a record book: the distance in serif on
 * the left, the time on the right. Render inside a <dl> with a top rule.
 */
export default function PBCard({ distance, time, verified, tone = "light" }: PBCardProps) {
  const dark = tone === "dark";
  return (
    <div
      className={`grid grid-cols-[1fr_auto] items-baseline gap-x-6 border-b py-5 ${
        dark ? "rule-light" : "rule"
      }`}
    >
      <dt className={`t-headline text-[1.35rem] md:text-[1.6rem] ${dark ? "text-bone" : "text-midnight"}`}>
        {distance}
        {verified && (
          <span
            className={`t-eyebrow ml-3 inline-flex items-center gap-1.5 align-middle ${
              dark ? "text-bone/55" : "text-trail"
            }`}
            title="Verified time"
          >
            <span
              aria-hidden
              className={`inline-block w-1.5 h-1.5 rounded-full ${dark ? "bg-bone/55" : "bg-trail"}`}
            />
            Verified
          </span>
        )}
      </dt>
      <dd className={`t-numeral text-[2rem] md:text-[2.5rem] ${dark ? "text-bone" : "text-midnight"}`}>
        {time}
      </dd>
    </div>
  );
}
