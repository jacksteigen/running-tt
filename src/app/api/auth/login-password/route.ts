import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { createSession, hashPassword, verifyPassword } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FAILURES = 8;
const LOCK_MINUTES = 15;
const GENERIC_ERROR = "Email or password is incorrect";

export async function POST(request: NextRequest) {
  let email = "";
  let password = "";
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!EMAIL_RE.test(email) || !password || password.length > 200) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const db = await getDB();
  const user = await db
    .prepare(
      "SELECT id, password_hash, failed_logins, lock_until, profile_completed FROM users WHERE email = ?"
    )
    .bind(email)
    .first<{
      id: string;
      password_hash: string | null;
      failed_logins: number;
      lock_until: string | null;
      profile_completed: number;
    }>();

  if (!user || !user.password_hash) {
    // Burn comparable time so missing accounts are not distinguishable.
    await hashPassword(password);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  if (user.lock_until && user.lock_until > new Date().toISOString()) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes, or use an email link." },
      { status: 429 }
    );
  }

  const ok = await verifyPassword(password, user.password_hash);

  if (!ok) {
    const failures = (user.failed_logins ?? 0) + 1;
    if (failures >= MAX_FAILURES) {
      const lockUntil = new Date(
        Date.now() + LOCK_MINUTES * 60 * 1000
      ).toISOString();
      await db
        .prepare(
          "UPDATE users SET failed_logins = 0, lock_until = ? WHERE id = ?"
        )
        .bind(lockUntil, user.id)
        .run();
    } else {
      await db
        .prepare("UPDATE users SET failed_logins = ? WHERE id = ?")
        .bind(failures, user.id)
        .run();
    }
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  await db
    .prepare(
      "UPDATE users SET failed_logins = 0, lock_until = NULL WHERE id = ?"
    )
    .bind(user.id)
    .run();

  await createSession(db, user.id);

  return NextResponse.json({
    success: true,
    next: user.profile_completed === 1 ? "/dashboard" : "/welcome",
  });
}
