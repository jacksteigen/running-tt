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
      <section className="bg-midnight text-bone">
        <div className="mx-auto max-w-6xl px-6 pt-10 pb-10 md:pt-14 md:pb-12">
          <Link href="/admin" className="link-quiet text-sm text-bone/65 decoration-bone/30 hover:text-bone">
            Admin
          </Link>
          <h1 className="t-display mt-5 text-[2.6rem] md:text-[3.6rem]">
            A new <em>race</em>
          </h1>
          <p className="mt-4 text-[0.95rem] text-bone/70 max-w-xl leading-relaxed">
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
          prizeSplit: "overall",
          ageGroupPrize: "",
          description: "",
          checkIn: "",
          whatToBring: [],
        }}
      />
    </>
  );
}
