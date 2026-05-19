import { getDB } from "@/lib/db";
import type { Metadata } from "next";
import Link from "next/link";
import PBCard from "@/components/PBCard";
import ResultsTable from "@/components/ResultsTable";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const db = await getDB();
  const user = await db
    .prepare("SELECT name FROM users WHERE id = ?")
    .bind(slug)
    .first<{ name: string }>();

  return {
    title: user ? `${user.name} · Running TT` : "Athlete · Running TT",
  };
}

export default async function AthletePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = await getDB();

  const user = await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(slug)
    .first<{
      id: string;
      name: string;
      email: string;
      location: string | null;
      created_at: string;
    }>();

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-24 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-3">
          DNF
        </p>
        <h1 className="text-2xl font-semibold">Athlete not found</h1>
        <Link href="/" className="text-terracotta text-sm mt-4 inline-block">
          Back home
        </Link>
      </div>
    );
  }

  interface PBRow {
    distance: string;
    time_display: string;
    verified: number;
  }

  interface ResultRow {
    id: string;
    time_display: string;
    rank: number;
    verified: number;
    prize_amount_cents: number;
    event_name: string;
    event_slug: string;
    distance: string;
  }

  const pbs = await db
    .prepare(
      "SELECT * FROM personal_bests WHERE user_id = ? ORDER BY distance"
    )
    .bind(user.id)
    .all() as unknown as { results: PBRow[] };

  const results = await db
    .prepare(
      `SELECT r.id, r.time_display, r.rank, r.verified, r.prize_amount_cents,
              ev.name as event_name, ev.slug as event_slug, ev.distance
       FROM results r
       JOIN events ev ON r.event_id = ev.id
       WHERE r.user_id = ?
       ORDER BY ev.date DESC`
    )
    .bind(user.id)
    .all() as unknown as { results: ResultRow[] };

  const initials = user.name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const memberSince = new Date(user.created_at).toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
  });

  // Summary stats
  const totalRaces = results.results.length;
  const podiums = results.results.filter((r) => r.rank <= 3).length;
  const wins = results.results.filter((r) => r.rank === 1).length;
  const earnings = results.results.reduce(
    (sum, r) => sum + (r.prize_amount_cents || 0),
    0
  );

  return (
    <>
      <section className="bg-midnight text-white relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent 0 79px, #F5F2EC 79px 80px)",
          }}
        />
        <div className="mx-auto max-w-6xl px-6 py-14 md:py-20 relative">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-5">
            Athlete
          </p>
          <div className="flex items-start gap-5 md:gap-6">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-terracotta/15 border border-terracotta/30 text-terracotta flex items-center justify-center font-mono text-2xl md:text-3xl font-semibold tracking-tight shrink-0">
              {initials}
            </div>
            <div className="pt-1">
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
                {user.name}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-stone/60 mt-2">
                {user.location && <span>{user.location}</span>}
                {user.location && <span className="text-stone/30">·</span>}
                <span className="font-mono">
                  Member since {memberSince}
                </span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-10 pt-8 border-t border-stone/10">
            <div>
              <p className="font-mono text-2xl md:text-3xl font-semibold tabular-nums">
                {totalRaces}
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-stone/50 mt-1">
                Races
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl md:text-3xl font-semibold tabular-nums">
                {wins}
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-stone/50 mt-1">
                Wins
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl md:text-3xl font-semibold tabular-nums">
                {podiums}
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-stone/50 mt-1">
                Podiums
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl md:text-3xl font-semibold tabular-nums text-gold">
                ${(earnings / 100).toFixed(0)}
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-stone/50 mt-1">
                Earned
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        {pbs.results.length > 0 && (
          <div className="mb-16">
            <div className="flex items-end justify-between mb-6">
              <div>
                <p className="text-xs text-dust uppercase tracking-[0.2em] mb-2">
                  Personal bests
                </p>
                <h2 className="text-xl font-semibold tracking-tight">
                  Best times
                </h2>
              </div>
              <p className="text-sm text-dust font-mono">
                {pbs.results.length} distance
                {pbs.results.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {pbs.results.map((pb) => (
                <PBCard
                  key={pb.distance}
                  distance={pb.distance}
                  time={pb.time_display}
                  verified={pb.verified === 1}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-xs text-dust uppercase tracking-[0.2em] mb-2">
                History
              </p>
              <h2 className="text-xl font-semibold tracking-tight">
                Race results
              </h2>
            </div>
            {totalRaces > 0 && (
              <p className="text-sm text-dust font-mono">
                {totalRaces} race{totalRaces === 1 ? "" : "s"}
              </p>
            )}
          </div>
          <ResultsTable rows={results.results} />
        </div>
      </div>
    </>
  );
}
