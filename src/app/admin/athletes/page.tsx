import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ageOn } from "@/lib/agegroups";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Athletes · Admin · Running TT",
  robots: { index: false, follow: false },
};

interface AthleteRow {
  id: string;
  name: string;
  email: string;
  location: string | null;
  date_of_birth: string | null;
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
      `SELECT u.id, u.name, u.email, u.location, u.date_of_birth, u.profile_completed, u.is_admin, u.created_at,
              (SELECT COUNT(*) FROM entries WHERE user_id = u.id AND status = 'confirmed') as entries,
              (SELECT COUNT(*) FROM results WHERE user_id = u.id) as results
       FROM users u
       ORDER BY u.created_at DESC`
    )
    .all() as unknown as { results: AthleteRow[] };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <section className="bg-midnight text-white">
        <div className="mx-auto max-w-5xl px-6 py-10 md:py-14">
          <Link href="/admin" className="text-xs text-stone/60 hover:text-stone/80 transition-colors mb-4 inline-block">
            &larr; Admin
          </Link>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Athletes
          </h1>
          <p className="mt-2 text-stone/70 text-sm">
            {athletes.results.length} registered
          </p>
        </div>
      </section>

      <section className="bg-bone min-h-[60vh]">
        <div className="mx-auto max-w-5xl px-6 py-10 md:py-14">
          <div className="bg-white border border-stone/40 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-midnight text-stone/60 text-left text-[10px] uppercase tracking-[0.2em] font-mono">
                  <th className="px-4 py-3">Athlete</th>
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
                  return (
                    <tr key={a.id} className="border-b border-stone/20 last:border-b-0 hover:bg-bone/60 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/admin/athletes/${a.id}`} className="font-medium hover:text-terracotta transition-colors">
                          {a.name}
                        </Link>
                        {a.is_admin === 1 && (
                          <span className="ml-2 text-[10px] uppercase tracking-wider text-terracotta">admin</span>
                        )}
                        <p className="text-xs text-midnight/50">{a.email}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-midnight/70">{a.location ?? "-"}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums">{age ?? "-"}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums hidden sm:table-cell">{a.entries}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums hidden sm:table-cell">{a.results}</td>
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
