import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isStripeTestMode } from "@/lib/stripe";
import EventEditor from "@/components/EventEditor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New event · Admin · Running TT",
  robots: { index: false, follow: false },
};

export default async function NewEventPage() {
  const db = await getDB();
  const session = await getSession(db);

  if (!session) redirect("/login");
  if (!session.user.isAdmin) redirect("/dashboard");

  const stripeTestMode = await isStripeTestMode();

  return (
    <>
      <section className="bg-midnight text-white">
        <div className="mx-auto max-w-6xl px-6 py-10 md:py-14">
          <Link href="/admin" className="text-xs text-stone/60 hover:text-stone/80 transition-colors mb-4 inline-block">
            &larr; Admin
          </Link>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-2">
            New event
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Create an event</h1>
          <p className="mt-2 text-stone/70 text-sm max-w-xl leading-relaxed">
            It starts as Coming Soon, so it can sit on the site with the date TBC.
            Open it for bookings once the date and first heat are locked in.
          </p>
        </div>
      </section>

      <EventEditor
        mode="create"
        bookedCount={0}
        canDelete={false}
        stripeTestMode={stripeTestMode}
        initial={{
          name: "",
          distance: "",
          dateTbc: false,
          date: "",
          venue: "",
          location: "",
          status: "Coming Soon",
          entryFee: 15,
          changeFee: null,
          startTime: "",
          heatsEnabled: true,
          firstHeatTime: "",
          heatIntervalMinutes: 15,
          heatCount: 12,
          heatCapacity: 10,
          prizes: [],
          description: "",
          checkIn: "",
          whatToBring: [],
        }}
      />
    </>
  );
}
