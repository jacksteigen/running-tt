import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ageOn } from "@/lib/agegroups";
import { composeLocation } from "@/lib/countries";
import { todayInMelbourne } from "@/lib/events";
import { CATEGORY_LABEL, toRaceCategory } from "@/lib/categories";
import AddAthleteForm from "@/components/AddAthleteForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Athletes · Admin · Running TT",
  robots: { index: false, follow: false },
};

interface AthleteRow {
  id: string;
  name: string;
  email: string;
  city: string | null;
  country: string | null;
  location: string | null;
  date_of_birth: string | null;
  race_category: string | null;
  profile_completed: number;
  is_admin: number;
  created_at: string;
  entries: number;
  results: number;
}

export default async function AdminAthletesPage() {
  const db = await getDB();
  const session = await getSession(db);
  if (!session) redirect("/login");
  if (!session.user.isAdmin) redirect("/dashboard");

  const athletes = await db
    .prepare(
      `SELECT u.id, u.name, u.email, u.city, u.country, u.location, u.date_of_birth, u.race_category,
              u.profile_completed, u.is_admin, u.created_at,
              (SELECT COUNT(*) FROM entries WHERE user_id = u.id AND status = 'confirmed') as entries,
              (SELECT COUNT(*) FROM results WHERE user_id = u.id) as results
       FROM users u
       ORDER BY u.created_at DESC`
    )
    .all() as unknown as { results: AthleteRow[] };

  const today = todayInMelbourne();

  const categoryCounts = { women: 0, men: 0, unset: 0 };
  for (const a of athletes.results) {
    categoryCounts[toRaceCategory(a.race_category) ?? "unset"] += 1;
  }

  // Which brands athletes most want to run for: the outreach list.
  const wishes = (await db
    .prepare(
      "SELECT dream_brands FROM users WHERE dream_brands IS NOT NULL AND dream_brands != '' AND open_to_sponsorship != 0"
    )
    .all()) as unknown as { results: { dream_brands: string }[] };
  const brandCounts = new Map<string, { label: string; n: number }>();
  for (const row of wishes.results) {
    const seen = new Set<string>();
    for (const raw of row.dream_brands.split(/[,\n;]+/)) {
      const label = raw.trim();
      const key = label.toLowerCase();
      if (!label || seen.has(key)) continue;
      seen.add(key);
      const current = brandCounts.get(key);
      brandCounts.set(key, { label: current?.label ?? label, n: (current?.n ?? 0) + 1 });
    }
  }
  const topBrands = [...brandCounts.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).slice(0, 20);

  return (
    <>
      <section className="bg-midnight text-bone">
        <div className="mx-auto max-w-5xl px-6 pt-10 pb-10 md:pt-14 md:pb-12">
          <Link href="/admin" className="link-quiet text-sm text-bone/65 decoration-bone/30 hover:text-bone">
            Admin
          </Link>
          <h1 className="t-display mt-5 text-[2.6rem] md:text-[3.6rem]">Athletes</h1>
          <p className="mt-3 text-[0.95rem] text-bone/65">
            <span className="t-numeral text-[1.25rem] text-bone">{athletes.results.length}</span> registered
          </p>
          <p className="mt-1.5 text-[0.9rem] text-bone/55">
            {categoryCounts.women} women, {categoryCounts.men} men, {categoryCounts.unset} not set
          </p>
        </div>
      </section>

      <section className="bg-bone min-h-[60vh]">
        <div className="mx-auto max-w-5xl px-6 py-10 md:py-14 space-y-8">
          <AddAthleteForm />

          <div className="border-t rule pt-6">
            <h2 className="t-headline text-[1.6rem] md:text-[1.9rem]">Brands athletes want</h2>
            <p className="mt-2 text-[0.95rem] text-midnight/65 leading-relaxed max-w-2xl">
              From every athlete open to a sponsor. Use it to choose which brands to approach.
            </p>
            {topBrands.length === 0 ? (
              <p className="mt-4 text-[0.95rem] text-midnight/55">No dream brands yet.</p>
            ) : (
              <ol className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-10 border-t rule">
                {topBrands.map((b) => (
                  <li key={b.label} className="flex items-baseline justify-between gap-4 border-b rule py-3">
                    <span className="text-[1rem]">{b.label}</span>
                    <span className="t-numeral text-[1.2rem] text-terracotta">
                      {b.n} <span className="t-eyebrow text-dust">{b.n === 1 ? "athlete" : "athletes"}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="bg-white border border-stone/40 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b rule text-left t-eyebrow text-dust">
                  <th className="px-4 py-3">Athlete</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Category</th>
                  <th className="px-4 py-3 hidden md:table-cell">Location</th>
                  <th className="px-4 py-3 text-right">Age</th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell">Entries</th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell">Results</th>
                  <th className="px-4 py-3">Profile</th>
                </tr>
              </thead>
              <tbody>
                {athletes.results.map((a) => {
                  const age = a.date_of_birth ? ageOn(a.date_of_birth, today) : null;
                  const place = composeLocation(a.city, a.country) || a.location;
                  const category = toRaceCategory(a.race_category);
                  return (
                    <tr key={a.id} className="border-b border-stone/20 last:border-b-0 hover:bg-bone/60 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/admin/athletes/${a.id}`} className="t-headline text-[1.1rem] hover:text-terracotta transition-colors">
                          {a.name}
                        </Link>
                        {a.is_admin === 1 && (
                          <span className="ml-2 t-eyebrow text-terracotta">Admin</span>
                        )}
                        <p className="text-xs text-midnight/50">
                          <span className="sm:hidden">{category ? CATEGORY_LABEL[category] : "No category"} · </span>
                          {a.email}
                        </p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-midnight/70">
                        {category ? CATEGORY_LABEL[category] : "-"}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-midnight/70">{place || "-"}</td>
                      <td className="px-4 py-3 text-right t-numeral text-[1.05rem]">{age ?? "-"}</td>
                      <td className="px-4 py-3 text-right t-numeral text-[1.05rem] hidden sm:table-cell">{a.entries}</td>
                      <td className="px-4 py-3 text-right t-numeral text-[1.05rem] hidden sm:table-cell">{a.results}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-1 ${a.profile_completed ? "bg-trail/10 text-trail" : "bg-gold/20 text-midnight"}`}>
                          {a.profile_completed ? "Complete" : "Incomplete"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
