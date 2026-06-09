import { getDB } from "@/lib/db";
import type { Metadata } from "next";
import Link from "next/link";
import PBCard from "@/components/PBCard";
import ResultsTable from "@/components/ResultsTable";

export const dynamic = "force-dynamic";

interface UserRow {
  id: string;
  name: string;
  email: string;
  location: string | null;
  created_at: string;
  bio: string | null;
  photo_url: string | null;
  instagram: string | null;
  strava_url: string | null;
  tiktok: string | null;
  website: string | null;
  sponsors: string | null; // JSON [{ name, url }]
  sponsor_interests: string | null;
  open_to_sponsorship: number;
}

interface SponsorRef {
  name: string;
  url: string;
}

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
    .first<UserRow>();

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

  let sponsorList: SponsorRef[] = [];
  if (user.sponsors) {
    try {
      sponsorList = JSON.parse(user.sponsors) as SponsorRef[];
    } catch {
      sponsorList = [];
    }
  }

  const socials: Array<{ label: string; value: string; href: string }> = [];
  if (user.instagram) {
    socials.push({
      label: "Instagram",
      value: `@${user.instagram.replace(/^@/, "")}`,
      href: `https://instagram.com/${user.instagram.replace(/^@/, "")}`,
    });
  }
  if (user.strava_url) {
    socials.push({ label: "Strava", value: "Strava", href: user.strava_url });
  }
  if (user.tiktok) {
    socials.push({
      label: "TikTok",
      value: `@${user.tiktok.replace(/^@/, "")}`,
      href: `https://tiktok.com/@${user.tiktok.replace(/^@/, "")}`,
    });
  }
  if (user.website) {
    socials.push({
      label: "Website",
      value: user.website.replace(/^https?:\/\//, ""),
      href: user.website,
    });
  }

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
      {/* Identity header */}
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
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Photo or initials */}
            {user.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.photo_url}
                alt={user.name}
                className="w-28 h-28 md:w-36 md:h-36 object-cover border border-terracotta/30 shrink-0"
              />
            ) : (
              <div className="w-24 h-24 md:w-28 md:h-28 bg-terracotta/15 border border-terracotta/30 text-terracotta flex items-center justify-center font-mono text-2xl md:text-3xl font-semibold tracking-tight shrink-0">
                {initials}
              </div>
            )}

            <div className="pt-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
                  {user.name}
                </h1>
                {user.open_to_sponsorship === 1 && (
                  <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-1 bg-trail text-white">
                    Open to sponsors
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-stone/60 mt-2">
                {user.location && <span>{user.location}</span>}
                {user.location && <span className="text-stone/30">·</span>}
                <span className="font-mono">Member since {memberSince}</span>
              </div>

              {user.bio && (
                <p className="mt-4 text-stone/70 leading-relaxed max-w-2xl">
                  {user.bio}
                </p>
              )}

              {socials.length > 0 && (
                <div className="flex flex-wrap items-center gap-4 mt-5">
                  {socials.map((s) => (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs uppercase tracking-[0.15em] text-stone/60 hover:text-terracotta transition-colors"
                    >
                      {s.label === "Instagram" || s.label === "TikTok"
                        ? `${s.label} ${s.value}`
                        : s.label}
                    </a>
                  ))}
                </div>
              )}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-14">
            {/* Personal bests */}
            {pbs.results.length > 0 && (
              <div>
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
                <div className="grid grid-cols-2 gap-4">
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

            {/* Running TT results */}
            <div>
              <div className="flex items-end justify-between mb-6">
                <div>
                  <p className="text-xs text-dust uppercase tracking-[0.2em] mb-2">
                    On the clock
                  </p>
                  <h2 className="text-xl font-semibold tracking-tight">
                    Running TT results
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

            {/* Other results */}
            <div>
              <p className="text-xs text-dust uppercase tracking-[0.2em] mb-2">
                Beyond Running TT
              </p>
              <h2 className="text-xl font-semibold tracking-tight mb-6">
                Other results
              </h2>
              <div className="bg-white border border-stone/40 p-10 text-center">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-2">
                  Coming soon
                </p>
                <p className="text-sm text-midnight/60 max-w-sm mx-auto">
                  Athletes will be able to add results from races outside
                  Running TT, so the whole racing record lives in one place.
                </p>
              </div>
            </div>
          </div>

          {/* Sponsorship sidebar */}
          <div className="space-y-8">
            <div className="bg-white border border-stone/40 p-6">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-3">
                Backing
              </p>
              <h3 className="font-semibold tracking-tight mb-4">
                Sponsored by
              </h3>
              {sponsorList.length > 0 ? (
                <div className="space-y-2">
                  {sponsorList.map((s) => (
                    <a
                      key={s.name}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block border border-stone/40 hover:border-terracotta px-4 py-3 transition-colors group"
                    >
                      <span className="text-sm font-semibold tracking-[0.12em] uppercase group-hover:text-terracotta transition-colors">
                        {s.name}
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-midnight/50">
                  No sponsors listed yet.
                </p>
              )}

              {user.open_to_sponsorship === 1 && (
                <div className="mt-5 pt-5 border-t border-stone/30">
                  <p className="text-xs font-medium text-trail mb-2">
                    Open to sponsorship
                  </p>
                  {user.sponsor_interests && (
                    <p className="text-sm text-midnight/60 leading-relaxed">
                      Looking for: {user.sponsor_interests}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="bg-stone/60 border border-stone/40 p-6">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-3">
                Scouts and sponsors
              </p>
              <p className="text-sm text-midnight/70 leading-relaxed">
                Every athlete profile shows real, recorded results. If you
                want to back a runner you see here, reach out through their
                socials or contact Running TT.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
