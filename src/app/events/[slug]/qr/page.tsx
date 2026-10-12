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
    <section className="bg-midnight text-white min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-10 md:py-14 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-terracotta mb-2">
          Running TT
        </p>
        <h1 className="text-2xl md:text-4xl font-semibold tracking-tight">
          {event.name}
        </h1>
        <p className="mt-2 text-stone/70 text-sm md:text-base">
          {[formatEventDate(event.date, "medium"), when, event.venue]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <div className="mt-8 md:mt-10 inline-block bg-white p-4 md:p-6">
          <QRCode
            value={entryUrl}
            className="w-[280px] h-[280px] md:w-[420px] md:h-[420px] block"
          />
        </div>

        <p className="mt-8 text-xl md:text-2xl font-semibold tracking-tight">
          {withHeats ? "Scan to book your heat" : "Scan to enter"}
        </p>
        <p className="mt-3 text-stone/70 text-sm max-w-md mx-auto leading-relaxed">
          {withHeats
            ? "Point your phone camera at the code. Sign in with your email, pick a heat and pay, and your spot on the start list is locked."
            : "Point your phone camera at the code. Sign in with your email, sign the clean sport declaration, and you are on the start list."}
        </p>
        <p className="mt-6 font-mono text-sm text-stone/80 break-all">
          {entryUrl.replace(/^https?:\/\//, "")}
        </p>

        <Link
          href={`/events/${event.slug}`}
          className="inline-block mt-10 py-2 text-xs text-stone/50 hover:text-stone/70 transition-colors"
        >
          Back to the event page
        </Link>
      </div>
    </section>
  );
}
