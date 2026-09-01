import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { todayInMelbourne } from "@/lib/events";
import Onboarding from "@/components/Onboarding";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set up your profile · Running TT",
  robots: { index: false, follow: false },
};

export default async function WelcomePage() {
  const db = await getDB();
  const session = await getSession(db);

  if (!session) redirect("/login");
  if (session.user.profileCompleted) redirect("/dashboard");

  // The soonest event open for entry, offered as the final step.
  const openEvent = await db
    .prepare(
      `SELECT id, slug, name, distance, date, time, venue, location, entry_fee_cents
       FROM events
       WHERE status = 'Open' AND date >= ?
       ORDER BY date ASC LIMIT 1`
    )
    .bind(todayInMelbourne())
    .first<{
      id: string;
      slug: string;
      name: string;
      distance: string;
      date: string;
      time: string;
      venue: string;
      location: string;
      entry_fee_cents: number;
    }>();

  let alreadyEntered = false;
  if (openEvent) {
    const entry = await db
      .prepare(
        "SELECT id FROM entries WHERE event_id = ? AND user_id = ? AND status = 'confirmed'"
      )
      .bind(openEvent.id, session.user.id)
      .first();
    alreadyEntered = !!entry;
  }

  const { user } = session;

  return (
    <section className="relative min-h-[calc(100vh-64px)] bg-midnight text-white overflow-hidden">
      <Image
        src="/images/athlete-track-side.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center opacity-40 scale-105 motion-safe:animate-slow-zoom"
        aria-hidden
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-midnight/70 via-midnight/60 to-midnight"
      />
      <div className="relative mx-auto max-w-xl px-6 py-12 md:py-20">
        <Onboarding
          initial={{
            firstName: user.firstName ?? "",
            middleName: user.middleName ?? "",
            lastName: user.lastName ?? "",
            dateOfBirth: user.dateOfBirth ?? "",
            location: user.location ?? "",
            bio: user.bio ?? "",
          }}
          openEvent={
            openEvent && !alreadyEntered
              ? {
                  id: openEvent.id,
                  slug: openEvent.slug,
                  name: openEvent.name,
                  distance: openEvent.distance,
                  date: openEvent.date,
                  time: openEvent.time,
                  venue: openEvent.venue,
                  entryFeeCents: openEvent.entry_fee_cents,
                }
              : null
          }
        />
      </div>
    </section>
  );
}
