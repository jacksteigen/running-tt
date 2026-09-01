import { cookies } from "next/headers";

const SESSION_COOKIE = "rtt_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function generateId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createMagicLink(
  db: D1Database,
  email: string,
  declared: boolean
) {
  const id = generateId();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min
  const normalised = email.trim().toLowerCase();

  // Only one live link per email: issuing a new one retires the others.
  await db
    .prepare("UPDATE magic_links SET used = 1 WHERE email = ? AND used = 0")
    .bind(normalised)
    .run();

  await db
    .prepare(
      "INSERT INTO magic_links (id, email, token, expires_at, declared) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(id, normalised, token, expiresAt, declared ? 1 : 0)
    .run();

  return token;
}

/**
 * Check a token without consuming it. Used by the confirmation page so that
 * email security scanners that prefetch the link cannot burn it; only the
 * explicit button press (POST) consumes the token.
 */
export async function peekMagicLink(db: D1Database, token: string) {
  return db
    .prepare(
      "SELECT id, email, declared FROM magic_links WHERE token = ? AND used = 0 AND expires_at > datetime('now')"
    )
    .bind(token)
    .first<{ id: string; email: string; declared: number }>();
}

/** Atomically consume a token; returns null if already used or expired. */
export async function consumeMagicLink(db: D1Database, token: string) {
  return db
    .prepare(
      "UPDATE magic_links SET used = 1 WHERE token = ? AND used = 0 AND expires_at > datetime('now') RETURNING id, email, declared"
    )
    .bind(token)
    .first<{ id: string; email: string; declared: number }>();
}

export async function createSession(db: D1Database, userId: string) {
  const sessionId = generateId();
  const expiresAt = new Date(
    Date.now() + SESSION_MAX_AGE * 1000
  ).toISOString();

  await db
    .prepare(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
    )
    .bind(sessionId, userId, expiresAt)
    .run();

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return sessionId;
}

export async function getSession(db: D1Database) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const session = await db
    .prepare(
      `SELECT s.id as session_id, s.expires_at, u.id, u.email, u.name, u.location,
              u.strava_athlete_id, u.garmin_user_id, u.created_at,
              u.bio, u.story, u.photo_url, u.instagram, u.strava_url, u.tiktok, u.website,
              u.sponsors, u.sponsor_interests, u.open_to_sponsorship, u.is_admin,
              (u.password_hash IS NOT NULL) as has_password
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ? AND s.expires_at > datetime('now')`
    )
    .bind(sessionId)
    .first<{
      session_id: string;
      expires_at: string;
      id: string;
      email: string;
      name: string;
      location: string | null;
      strava_athlete_id: string | null;
      garmin_user_id: string | null;
      created_at: string;
      bio: string | null;
      story: string | null;
      photo_url: string | null;
      instagram: string | null;
      strava_url: string | null;
      tiktok: string | null;
      website: string | null;
      sponsors: string | null;
      sponsor_interests: string | null;
      open_to_sponsorship: number;
      is_admin: number;
      has_password: number;
    }>();

  if (!session) return null;

  return {
    sessionId: session.session_id,
    user: {
      id: session.id,
      email: session.email,
      name: session.name,
      location: session.location,
      stravaAthleteId: session.strava_athlete_id,
      garminUserId: session.garmin_user_id,
      createdAt: session.created_at,
      bio: session.bio,
      story: session.story,
      photoUrl: session.photo_url,
      instagram: session.instagram,
      stravaUrl: session.strava_url,
      tiktok: session.tiktok,
      website: session.website,
      sponsors: session.sponsors,
      sponsorInterests: session.sponsor_interests,
      openToSponsorship: session.open_to_sponsorship,
      isAdmin: session.is_admin === 1,
      hasPassword: !!session.has_password,
    },
  };
}

export async function destroySession(db: D1Database) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
    cookieStore.delete(SESSION_COOKIE);
  }
}

export async function findOrCreateUser(
  db: D1Database,
  email: string
): Promise<{ id: string; created: boolean }> {
  const normalised = email.trim().toLowerCase();
  const existing = await db
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(normalised)
    .first<{ id: string }>();

  if (existing) return { id: existing.id, created: false };

  const id = `usr_${generateId()}`;
  const name = normalised.split("@")[0];
  await db
    .prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)")
    .bind(id, normalised, name)
    .run();

  return { id, created: true };
}

// --- Password sign-in (optional, set after first email verification) ---

const PBKDF2_ITERATIONS = 100_000;

async function derivePasswordBits(
  password: string,
  salt: Uint8Array,
  iterations: number
) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256
  );
}

function bytesToB64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function b64ToBytes(s: string) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derivePasswordBits(password, salt, PBKDF2_ITERATIONS);
  return `v1$${PBKDF2_ITERATIONS}$${bytesToB64(salt)}$${bytesToB64(new Uint8Array(bits))}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "v1") return false;
  const iterations = parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations < 1) return false;
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = b64ToBytes(parts[2]);
    expected = b64ToBytes(parts[3]);
  } catch {
    return false;
  }
  const bits = new Uint8Array(
    await derivePasswordBits(password, salt, iterations)
  );
  if (bits.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
  return diff === 0;
}
