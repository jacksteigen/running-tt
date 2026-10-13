import Link from "next/link";

export default function NotFound() {
  return (
    <section className="bg-midnight text-bone">
      <div className="mx-auto max-w-6xl px-6 pt-28 pb-28 md:pt-40 md:pb-40">
        <div className="max-w-3xl motion-safe:animate-fade-up">
          <p className="t-eyebrow text-bone/55">DNF · Did not find</p>
          <h1 className="t-display mt-6 text-[3.2rem] sm:text-[4.4rem] md:text-[5.6rem]">
            You’ve stepped <em className="text-bone/75">off the track.</em>
          </h1>
          <p className="t-lede mt-8 max-w-xl text-bone/80">
            The page you were after isn’t here. Could be a typo, could be
            retired. Either way, head back to the start line.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href="/" className="btn btn-primary btn-lg">
              Back to start
            </Link>
            <Link href="/events" className="btn btn-light btn-lg">
              Find an event
            </Link>
          </div>
          <p className="t-caption mt-16 border-t rule-light pt-6 max-w-xs text-bone/45">
            Error 404. It happens to the best of us.
          </p>
        </div>
      </div>
    </section>
  );
}
