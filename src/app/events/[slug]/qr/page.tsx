import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDB } from "@/lib/db";
import { SITE_URL } from "@/lib/site";
import { formatEventDate } from "@/lib/dates";
import { hasHeats, heatWindow, type HeatConfig } from "@/lib/heats";
import QRCode from "@/components/QRCode";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scan to enter · Running TT",
  robots: { index: false, follow: false },
};

/**
 * The race-day poster: shown on a screen at the venue or printed and taped
 * to the registration table. Set like a printed bill, on paper, with the
 * code as the one thing to look at.
 */
export default async function EventQRPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = await getDB();

  const event = await db
    .prepare(
      `SELECT slug, name, date, time, venue, location,
              first_heat_time, heat_interval_minutes, heat_count, heat_capacity
       FROM events WHERE slug = ?`
    )
    .bind(slug)
    .first<
      HeatConfig & {
        slug: string;
        name: string;
        date: string;
        time: string;
        venue: string;
        location: string;
      }
    >();

  if (!event) notFound();

  // Heat events send people straight to the heat picker; the rest to the
  // event page, where entry is one tap.
  const withHeats = hasHeats(event);
  const path = withHeats ? `/events/${event.slug}/book` : `/events/${event.slug}`;
  const entryUrl = `${SITE_URL}${path}`;
  const when = withHeats ? (heatWindow(event) ?? event.time) : event.time;

  return (
    <section className="bg-bone text-midnight min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-10 md:py-16">
        {/* Masthead */}
        <div className="flex items-baseline justify-between gap-4 border-b border-midnight pb-3">
          <p className="t-eyebrow text-[0.85rem] tracking-[0.14em]">Running TT</p>
          {event.location && !/TBC/i.test(event.location) && (
            <p className="t-eyebrow text-dust truncate">{event.location}</p>
          )}
        </div>

        <div className="text-center">
          <h1 className="t-display mt-12 md:mt-16 text-[3rem] sm:text-[4rem] md:text-[5.2rem] break-words">
            {event.name}
          </h1>
          <p className="t-lede mt-5 text-midnight/80">
            <em>{formatEventDate(event.date, "medium")}</em>
          </p>
          <p className="mt-2 text-[0.95rem] md:text-base text-midnight/65">
            {[when, event.venue].filter(Boolean).join(" · ")}
          </p>

          <div className="mt-10 md:mt-14 inline-block border border-midnight bg-white p-3 md:p-5">
            <QRCode
              value={entryUrl}
              className="w-[280px] h-[280px] md:w-[420px] md:h-[420px] block"
            />
          </div>

          <p className="t-display mt-10 md:mt-12 text-[2.4rem] md:text-[3.4rem]">
            {withHeats ? (
              <>
                Scan to <em>book your heat.</em>
              </>
            ) : (
              <>
                Scan to <em>enter.</em>
              </>
            )}
          </p>
          <p className="mt-4 text-midnight/70 max-w-md mx-auto leading-relaxed">
            {withHeats
              ? "Point your phone camera at the code. Sign in with your email, pick a heat and pay, and your spot on the start list is locked."
              : "Point your phone camera at the code. Sign in with your email, sign the clean sport declaration, and you are on the start list."}
          </p>
          <p className="mt-6 t-numeral text-[1.1rem] md:text-[1.25rem] text-midnight/80 break-all">
            {entryUrl.replace(/^https?:\/\//, "")}
          </p>
        </div>

        {/* Foot of the bill */}
        <div className="mt-14 md:mt-20 flex flex-col sm:flex-row items-center sm:items-baseline justify-between gap-3 border-t border-midnight pt-4">
          <p className="t-caption text-midnight/60">You. The clock. Nothing else.</p>
          <Link
            href={`/events/${event.slug}`}
            className="print:hidden inline-flex min-h-11 items-center link-quiet text-[0.9rem] text-midnight/60 hover:text-midnight transition-colors"
          >
            Back to the event page
          </Link>
        </div>
      </div>
    </section>
  );
}
