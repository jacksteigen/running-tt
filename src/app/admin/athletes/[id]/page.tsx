import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { formatEventDate } from "@/lib/dates";
import { composeLocation, isKnownCountry } from "@/lib/countries";
import { heatLabel } from "@/lib/heats";
import AthleteEditor from "@/components/AthleteEditor";
import RemoveEntryButton from "@/components/RemoveEntryButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Athlete · Admin · Running TT",
  robots: { index: false, follow: false },
};

/**
 * Profiles saved before city and country were split only have a location
 * line. Pull a known country off the end so the editor starts filled in.
 */
function splitPlace(city: string | null, country: string | null, location: string | null) {
  if (city || country) return { city: city ?? "", country: country ?? "" };
  const parts = (location ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  const last = parts[parts.length - 1];
  if (last && isKnownCountry(last)) {
    return { city: parts.slice(0, -1).join(", "), country: last };
  }
  return { city: (location ?? "").trim(), country: "" };
}

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
              city, country, location, bio, is_admin, profile_completed, created_at
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
      city: string | null;
      country: string | null;
      location: string | null;
      bio: string | null;
      is_admin: number;
      profile_completed: number;
      created_at: string;
    }>();

  if (!athlete) notFound();

  const entries = await db
    .prepare(
      `SELECT e.id, e.status, e.age_group, e.heat_number, ev.name, ev.slug, ev.date, ev.distance,
              ev.first_heat_time, ev.heat_interval_minutes, ev.heat_count, ev.heat_capacity,
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
      heat_number: number | null;
      first_heat_time: string | null;
      heat_interval_minutes: number | null;
      heat_count: number | null;
      heat_capacity: number | null;
      name: string;
      slug: string;
      date: string;
      distance: string;
      time_display: string | null;
    }[];
  };

  const place = splitPlace(athlete.city, athlete.country, athlete.location);
  const placeText = composeLocation(athlete.city, athlete.country) || athlete.location;

  return (
    <>
      <section className="bg-midnight text-bone">
        <div className="mx-auto max-w-4xl px-6 pt-10 pb-10 md:pt-14 md:pb-12">
          <Link href="/admin/athletes" className="link-quiet text-sm text-bone/65 decoration-bone/30 hover:text-bone">
            Athletes
          </Link>
          <h1 className="t-display mt-5 text-[2.6rem] md:text-[3.6rem] break-words">{athlete.name}</h1>
          <p className="mt-3 text-[0.95rem] text-bone/65">
            {athlete.email}
            {placeText ? ` · ${placeText}` : ""} · joined {athlete.created_at.slice(0, 10)}
            {athlete.profile_completed ? "" : " · profile incomplete"}
          </p>
          <Link
            href={`/athletes/${athlete.id}`}
            className="inline-block mt-5 link-quiet text-sm text-bone decoration-bone/40"
          >
            View public profile
          </Link>
        </div>
      </section>

      <section className="bg-bone min-h-[60vh]">
        <div className="mx-auto max-w-4xl px-6 py-10 md:py-14 space-y-12">
          <div>
            <h2 className="t-headline text-[1.7rem] md:text-[2rem] mb-5">Profile</h2>
            <AthleteEditor
              athleteId={athlete.id}
              isSelf={athlete.id === session.user.id}
              initial={{
                firstName: athlete.first_name ?? "",
                middleName: athlete.middle_name ?? "",
                lastName: athlete.last_name ?? "",
                dateOfBirth: athlete.date_of_birth ?? "",
                city: place.city,
                country: place.country,
                bio: athlete.bio ?? "",
                isAdmin: athlete.is_admin === 1,
              }}
            />
          </div>

          <div>
            <h2 className="t-headline text-[1.7rem] md:text-[2rem] mb-5">Entries</h2>
            {entries.results.length === 0 ? (
              <p className="border-t rule pt-4 text-[0.95rem] text-midnight/55">
                No entries yet.
              </p>
            ) : (
              <div className="bg-white border border-stone/40 divide-y divide-stone/30">
                {entries.results.map((e) => (
                  <div key={e.id} className="px-5 py-3.5 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/admin/events/${e.slug}`}
                        className="t-headline text-[1.1rem] hover:text-terracotta transition-colors"
                      >
                        {e.name}
                      </Link>
                      <p className="text-xs text-midnight/55 mt-0.5">
                        {formatEventDate(e.date, "compact")} · {e.distance}
                        {e.heat_number ? ` · ${heatLabel(e, e.heat_number)}` : ""}
                        {" · "}
                        {e.age_group ?? "no age group"}
                        {e.time_display && (
                          <span className="sm:hidden">
                            {" · "}
                            <span className="font-mono text-midnight">{e.time_display}</span>
                          </span>
                        )}
                      </p>
                    </div>
                    {e.time_display && (
                      <span className="hidden sm:inline t-numeral text-[1.3rem] shrink-0">{e.time_display}</span>
                    )}
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
      </section>
    </>
  );
}
