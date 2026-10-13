import { getDB } from "@/lib/db";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import PBCard from "@/components/PBCard";
import ResultsTable from "@/components/ResultsTable";
import { formatFee } from "@/lib/money";
import { placeFor } from "@/lib/categories";

export const dynamic = "force-dynamic";

interface UserRow {
  id: string;
  name: string;
  first_name: string | null;
  email: string;
  location: string | null;
  created_at: string;
  bio: string | null;
  story: string | null;
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

/** "a, b and c", keeping each part's markup. */
function inSentence(parts: ReactNode[]): ReactNode[] {
  return parts.flatMap((part, i) => {
    if (i === 0) return [part];
    return [i === parts.length - 1 ? " and " : ", ", part];
  });
}

/** A number set in race-bib figures inside a serif sentence. */
function Figure({ children }: { children: ReactNode }) {
  return <span className="t-numeral text-[1.08em] text-midnight">{children}</span>;
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
      <section className="bg-bone">
        <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
          <h1 className="t-display text-[2.8rem] md:text-[4.2rem] max-w-3xl">
            Athlete <em>not found.</em>
          </h1>
          <p className="t-lede mt-5 max-w-lg text-midnight/70">
            This page may have moved, or the athlete may no longer be listed.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-7 gap-y-2">
            <Link href="/" className="link-quiet inline-block py-3 text-midnight">
              Back home
            </Link>
            <Link href="/results" className="link-quiet inline-block py-3 text-midnight">
              See the results
            </Link>
          </div>
        </div>
      </section>
    );
  }

  interface PBRow {
    distance: string;
    time_display: string;
    verified: number;
  }

  interface ResultRow {
    is_test?: number;
    id: string;
    time_display: string;
    rank: number;
    verified: number;
    prize_amount_cents: number;
    event_name: string;
    event_slug: string;
    distance: string;
    prize_split: string | null;
    race_category: string | null;
    category_rank: number | null;
    age_group_award: number;
    age_group_prize: string | null;
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
              r.race_category, r.category_rank, r.age_group_award,
              ev.name as event_name, ev.slug as event_slug, ev.distance, ev.is_test,
              ev.prize_split, ev.age_group_prize
       FROM results r
       JOIN events ev ON r.event_id = ev.id
       WHERE r.user_id = ?
       ORDER BY ev.date DESC`
    )
    .bind(user.id)
    .all() as unknown as { results: ResultRow[] };

  const albumRows = await db
    .prepare(
      "SELECT id, r2_key, caption FROM user_photos WHERE user_id = ? ORDER BY sort_order, created_at"
    )
    .bind(user.id)
    .all() as unknown as {
    results: { id: string; r2_key: string; caption: string | null }[];
  };

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

  const firstName = user.first_name?.trim() || user.name.split(" ")[0];
  const story = (user.story ?? "")
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean);
  const place = user.location?.trim();
  const openToSponsors = user.open_to_sponsorship === 1;

  // Summary stats, told as a sentence rather than a row of boxes.
  // Test runs show in the history, tagged, but are not part of the tally.
  const counted = results.results.filter((r) => !r.is_test);
  const totalRaces = counted.length;
  // In a race paid by category, a win or podium is among the women or the men,
  // and a finisher with no category has no place that counts.
  const podiums = counted.filter((r) => {
    const p = placeFor(r);
    return p !== null && p <= 3;
  }).length;
  const wins = counted.filter((r) => placeFor(r) === 1).length;
  const earnings = counted.reduce(
    (sum, r) => sum + (r.prize_amount_cents || 0),
    0
  );
  const record: ReactNode[] = [];
  if (totalRaces > 0) {
    record.push(
      <span key="races">
        <Figure>{totalRaces}</Figure> {totalRaces === 1 ? "race" : "races"} on the clock
      </span>
    );
  }
  if (wins > 0) {
    record.push(
      <span key="wins">
        <Figure>{wins}</Figure> {wins === 1 ? "win" : "wins"}
      </span>
    );
  }
  if (podiums > 0) {
    record.push(
      <span key="podiums">
        <Figure>{podiums}</Figure> {podiums === 1 ? "podium" : "podiums"}
      </span>
    );
  }
  if (earnings > 0) {
    record.push(
      <span key="earned">
        <Figure>{formatFee(earnings)}</Figure> in prize money
      </span>
    );
  }

  return (
    <>
      {/* The profile: a name, a face, and a line about them. */}
      <section className="bg-bone">
        <div className="mx-auto max-w-6xl px-6 pt-12 pb-16 md:pt-20 md:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-12 gap-y-10">
            <div className="lg:col-span-7 lg:row-start-1 lg:self-end motion-safe:animate-fade-up">
              {place && <p className="t-eyebrow text-dust">{place}</p>}
              <h1
                className={`t-display text-[3rem] sm:text-[4.2rem] md:text-[5.2rem] lg:text-[clamp(4.2rem,6vw,5.8rem)] break-words text-balance ${
                  place ? "mt-5" : ""
                }`}
              >
                {user.name}
              </h1>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
                <p className="t-caption text-midnight/60">
                  With Running TT since {memberSince}
                </p>
                {openToSponsors && (
                  <p className="t-eyebrow text-trail inline-flex items-center gap-2">
                    <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full bg-trail" />
                    Open to sponsors
                  </p>
                )}
              </div>
            </div>

            {user.photo_url ? (
              <div className="lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:row-span-2 motion-safe:animate-fade-up [animation-delay:120ms]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={user.photo_url}
                  alt={user.name}
                  className="w-full aspect-[4/5] object-cover bg-stone"
                />
              </div>
            ) : (
              // No photo yet: a monogram holds the space on wide screens.
              <div
                aria-hidden
                className="hidden lg:flex lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:row-span-2 aspect-[4/5] bg-stone items-center justify-center"
              >
                <span className="t-display italic text-[9rem] text-dust/60">{initials}</span>
              </div>
            )}

            <div className="lg:col-span-7 lg:row-start-2">
              {user.bio && (
                <p className="t-lede max-w-xl text-midnight/80">{user.bio}</p>
              )}

              {socials.length > 0 && (
                <ul className={`flex flex-wrap gap-x-7 ${user.bio ? "mt-6" : ""}`}>
                  {socials.map((s) => (
                    <li key={s.label}>
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-quiet inline-block py-3 text-[0.95rem] text-midnight"
                      >
                        {s.label === "Instagram" || s.label === "TikTok"
                          ? `${s.label} ${s.value}`
                          : s.label === "Website"
                            ? s.value
                            : s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* The record, as a sentence */}
          <div className="mt-14 md:mt-20 border-t rule pt-7">
            <p className="t-headline text-[1.45rem] md:text-[2rem] text-midnight/75 max-w-4xl">
              {record.length > 0 ? (
                <>{inSentence(record)}.</>
              ) : (
                <>No Running TT races on the record yet.</>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Personal bests */}
      {pbs.results.length > 0 && (
        <section className="bg-bone">
          <div className="mx-auto max-w-6xl px-6">
            <div className="border-t rule py-20 md:py-28 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
              <h2 className="lg:col-span-4 t-display text-[2.6rem] md:text-[3.6rem]">
                Personal <em>bests</em>
              </h2>
              <dl className="lg:col-span-8 border-t rule">
                {pbs.results.map((pb) => (
                  <PBCard
                    key={pb.distance}
                    distance={pb.distance}
                    time={pb.time_display}
                    verified={pb.verified === 1}
                  />
                ))}
              </dl>
            </div>
          </div>
        </section>
      )}

      {/* Story */}
      {story.length > 0 && (
        <section className="bg-bone">
          <div className="mx-auto max-w-6xl px-6">
            <div className="border-t rule py-20 md:py-28 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
              <h2 className="lg:col-span-4 t-display text-[2.6rem] md:text-[3.6rem]">
                In their words
              </h2>
              <div className="lg:col-span-8 max-w-[38rem] space-y-6">
                {story.map((para, i) => (
                  <p
                    key={i}
                    className={`font-serif text-[1.15rem] md:text-[1.3rem] leading-[1.7] text-midnight/85 whitespace-pre-line ${
                      i === 0 && para.length > 120
                        ? "first-letter:float-left first-letter:font-serif first-letter:text-[4.6rem] first-letter:leading-[0.8] first-letter:mr-3 first-letter:mt-[0.08em] first-letter:text-terracotta"
                        : ""
                    }`}
                  >
                    {para}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Race history */}
      <section className="bg-midnight text-bone">
        <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4">
              <h2 className="t-display text-[2.6rem] md:text-[3.6rem]">
                On the clock
              </h2>
              <p className="mt-5 max-w-sm text-bone/65 leading-relaxed">
                {totalRaces > 0
                  ? `Every race ${firstName} has run with Running TT, newest first.`
                  : `When ${firstName} lines up at a Running TT race, the time lands here.`}
              </p>
            </div>
            <div className="lg:col-span-8">
              <ResultsTable
                rows={results.results}
                tone="dark"
                empty={
                  <p className="max-w-md text-bone/65 leading-relaxed">
                    No Running TT results yet.
                  </p>
                }
              />
              <p className="t-caption mt-8 max-w-md text-bone/50">
                Coming soon: results from races outside Running TT, so the
                whole racing record lives in one place.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Album */}
      {albumRows.results.length > 0 && (
        <section className="bg-bone">
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <h2 className="t-display text-[2.6rem] md:text-[3.6rem]">
              The album
            </h2>
            <div className="mt-10 md:mt-14 grid grid-cols-2 lg:grid-cols-3 gap-x-4 md:gap-x-6 gap-y-10 md:gap-y-14">
              {albumRows.results.map((photo) => (
                <figure key={photo.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/photos/${photo.r2_key}`}
                    alt={photo.caption || `Photo of ${user.name}`}
                    loading="lazy"
                    decoding="async"
                    className="w-full aspect-[4/5] object-cover bg-stone"
                  />
                  {photo.caption && (
                    <figcaption className="t-caption mt-3 text-midnight/60">
                      {photo.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Backing */}
      <section className="bg-stone">
        <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <h2 className="lg:col-span-4 t-display text-[2.6rem] md:text-[3.6rem]">
              {openToSponsors ? (
                <>
                  Back {firstName}
                </>
              ) : (
                <>
                  In their corner
                </>
              )}
            </h2>
            <div className="lg:col-span-8 max-w-2xl">
              <p className="t-eyebrow text-dust">Sponsored by</p>
              {sponsorList.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-1">
                  {sponsorList.map((s) => (
                    <li key={s.name}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-quiet inline-block py-2 t-headline text-[1.5rem] md:text-[1.8rem] text-midnight hover:text-terracotta transition-colors"
                      >
                        {s.name}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-midnight/60">No sponsors listed yet.</p>
              )}

              {openToSponsors && (
                <div className="mt-10 border-t border-midnight/15 pt-6">
                  <p className="t-eyebrow text-trail inline-flex items-center gap-2">
                    <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full bg-trail" />
                    Open to sponsorship
                  </p>
                  {user.sponsor_interests && (
                    <p className="t-lede mt-3 text-midnight/80">
                      Looking for {user.sponsor_interests}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-10 border-t border-midnight/15 pt-6">
                <p className="max-w-lg text-midnight/70 leading-relaxed">
                  Every athlete profile shows real, recorded results. If you
                  want to back a runner you see here, reach out through their
                  socials or{" "}
                  <a
                    href="/about#brands"
                    className="link-quiet text-midnight"
                  >
                    contact Running TT
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
