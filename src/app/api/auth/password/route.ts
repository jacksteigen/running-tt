import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";

/** Set or replace the signed-in user's password. */
export async function POST(request: NextRequest) {
  const db = await getDB();
  const session = await getSession(db);

  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: string };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (password.length < 8 || password.length > 200) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const hash = await hashPassword(password);
  await db
    .prepare(
      "UPDATE users SET password_hash = ?, failed_logins = 0, lock_until = NULL, updated_at = datetime('now') WHERE id = ?"
    )
    .bind(hash, session.user.id)
    .run();

  return NextResponse.json({ success: true });
}
