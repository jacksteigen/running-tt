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

export async function createMagicLink(db: D1Database, email: string) {
  const id = generateId();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

  await db
    .prepare(
      "INSERT INTO magic_links (id, email, token, expires_at) VALUES (?, ?, ?, ?)"
    )
    .bind(id, email.toLowerCase(), token, expiresAt)
    .run();

  return token;
}

export async function verifyMagicLink(db: D1Database, token: string) {
  const link = await db
    .prepare(
      "SELECT * FROM magic_links WHERE token = ? AND used = 0 AND expires_at > datetime('now')"
    )
    .bind(token)
    .first<{ id: string; email: string }>();

  if (!link) return null;

  // Mark as used
  await db
    .prepare("UPDATE magic_links SET used = 1 WHERE token = ?")
    .bind(token)
    .run();

  return link;
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
      `SELECT s.id as session_id, s.expires_at, u.id, u.email, u.name, u.location, u.strava_athlete_id, u.garmin_user_id, u.created_at
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

export async function findOrCreateUser(db: D1Database, email: string) {
  const existing = await db
    .prepare("SELECT * FROM users WHERE email = ?")
    .bind(email.toLowerCase())
    .first<{ id: string }>();

  if (existing) return existing.id;

  const id = `usr_${generateId()}`;
  const name = email.split("@")[0];
  await db
    .prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)")
    .bind(id, email.toLowerCase(), name)
    .run();

  return id;
}
