import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDB } from "@/lib/db";
import QRCode from "@/components/QRCode";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scan to enter · Running TT",
  robots: { index: false, follow: false },
};

const SITE_URL = "https://runningtt.com";

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default async function EventQRPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = await getDB();

  const event = await db
    .prepare(
      "SELECT slug, name, date, time, venue, location FROM events WHERE slug = ?"
    )
    .bind(slug)
    .first<{
      slug: string;
      name: string;
      date: string;
      time: string;
      venue: string;
      location: string;
    }>();

  if (!event) notFound();

  const entryUrl = `${SITE_URL}/events/${event.slug}`;

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
          {formatDate(event.date)} · {event.time} · {event.venue}
        </p>

        <div className="mt-8 md:mt-10 inline-block bg-white p-4 md:p-6">
          <QRCode
            value={entryUrl}
            className="w-[280px] h-[280px] md:w-[420px] md:h-[420px] block"
          />
        </div>

        <p className="mt-8 text-xl md:text-2xl font-semibold tracking-tight">
          Scan to enter
        </p>
        <p className="mt-3 text-stone/70 text-sm max-w-md mx-auto leading-relaxed">
          Point your phone camera at the code. Sign in with your email, sign
          the clean sport declaration, and you are on the start list.
        </p>
        <p className="mt-6 font-mono text-sm text-stone/80 break-all">
          runningtt.com/events/{event.slug}
        </p>

        <Link
          href={`/events/${event.slug}`}
          className="inline-block mt-10 text-xs text-stone/50 hover:text-stone/70 transition-colors"
        >
          Back to the event page
        </Link>
      </div>
    </section>
  );
}
