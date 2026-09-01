import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import AthleteEditor from "@/components/AthleteEditor";
import RemoveEntryButton from "@/components/RemoveEntryButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Athlete · Admin · Running TT",
  robots: { index: false, follow: false },
};

export default async function AdminAthletePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getDB();
  const session = await getSession(db);
  if (!session) redirect("/login");
  if (!session.user.isAdmin) redirect("/dashboard");

  const athlete = await db
    .prepare(
      `SELECT id, name, email, first_name, middle_name, last_name, date_of_birth,
              location, bio, is_admin, profile_completed, created_at
       FROM users WHERE id = ?`
    )
    .bind(id)
    .first<{
      id: string;
      name: string;
      email: string;
      first_name: string | null;
      middle_name: string | null;
      last_name: string | null;
      date_of_birth: string | null;
      location: string | null;
      bio: string | null;
      is_admin: number;
      profile_completed: number;
      created_at: string;
    }>();

  if (!athlete) notFound();

  const entries = await db
    .prepare(
      `SELECT e.id, e.status, e.age_group, ev.name, ev.slug, ev.date, ev.distance,
              (SELECT time_display FROM results r WHERE r.event_id = e.event_id AND r.user_id = e.user_id) as time_display
       FROM entries e JOIN events ev ON ev.id = e.event_id
       WHERE e.user_id = ?
       ORDER BY ev.date DESC`
    )
    .bind(id)
    .all() as unknown as {
    results: {
      id: string;
      status: string;
      age_group: string | null;
      name: string;
      slug: string;
      date: string;
      distance: string;
      time_display: string | null;
    }[];
  };

  return (
    <>
      <section className="bg-midnight text-white">
        <div className="mx-auto max-w-4xl px-6 py-10 md:py-14">
          <Link href="/admin/athletes" className="text-xs text-stone/60 hover:text-stone/80 transition-colors mb-4 inline-block">
            &larr; Athletes
          </Link>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{athlete.name}</h1>
          <p className="mt-2 text-stone/70 text-sm">
            {athlete.email} · joined {athlete.created_at.slice(0, 10)}
            {athlete.profile_completed ? "" : " · profile incomplete"}
          </p>
          <Link href={`/athletes/${athlete.id}`} className="inline-block mt-4 text-xs text-terracotta hover:text-terracotta/80 transition-colors">
            View public profile →
          </Link>
        </div>
      </section>

      <section className="bg-bone min-h-[60vh]">
        <div className="mx-auto max-w-4xl px-6 py-10 md:py-14 space-y-10">
          <div>
            <h2 className="text-lg font-semibold tracking-tight mb-4">Profile</h2>
            <AthleteEditor
              athleteId={athlete.id}
              isSelf={athlete.id === session.user.id}
              initial={{
                firstName: athlete.first_name ?? "",
                middleName: athlete.middle_name ?? "",
                lastName: athlete.last_name ?? "",
                dateOfBirth: athlete.date_of_birth ?? "",
                location: athlete.location ?? "",
                bio: athlete.bio ?? "",
                isAdmin: athlete.is_admin === 1,
              }}
            />
          </div>

          <div>
            <h2 className="text-lg font-semibold tracking-tight mb-4">Entries</h2>
            <div className="bg-white border border-stone/40">
              {entries.results.length === 0 ? (
                <p className="px-5 py-8 text-sm text-midnight/50 text-center">No entries.</p>
              ) : (
                <div className="divide-y divide-stone/30">
                  {entries.results.map((e) => (
                    <div key={e.id} className="px-5 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <Link href={`/admin/events/${e.slug}`} className="text-sm font-medium hover:text-terracotta transition-colors">
                          {e.name}
                        </Link>
                        <p className="text-[11px] text-midnight/50">
                          {e.date} · {e.distance} · {e.age_group ?? "no age group"}
                          {e.time_display ? ` · ${e.time_display}` : ""}
                        </p>
                      </div>
                      <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-1 ${e.status === "confirmed" ? "bg-trail/10 text-trail" : "bg-gold/20 text-midnight"}`}>
                        {e.status}
                      </span>
                      <RemoveEntryButton entryId={e.id} label={athlete.name} disabled={!!e.time_display} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
