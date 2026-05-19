import Link from "next/link";

export default function NotFound() {
  return (
    <section className="bg-midnight text-white">
      <div className="mx-auto max-w-6xl px-6 py-32 md:py-40 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-terracotta mb-6">
          DNF · Did not find
        </p>
        <p className="font-mono text-8xl md:text-9xl font-semibold tracking-tight text-stone/80 mb-6">
          404
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-4">
          You&apos;ve stepped off the track.
        </h1>
        <p className="text-stone/60 max-w-md mx-auto mb-10">
          The page you were after isn&apos;t here. Could be a typo, could be
          retired. Either way, head back to the start line.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-block bg-terracotta text-white font-medium px-7 py-3.5 text-sm hover:bg-terracotta/90 transition-colors"
          >
            Back to start
          </Link>
          <Link
            href="/events"
            className="inline-block border border-stone/20 text-white px-7 py-3.5 text-sm hover:border-stone/40 transition-colors"
          >
            Find an event
          </Link>
        </div>
      </div>
    </section>
  );
}
