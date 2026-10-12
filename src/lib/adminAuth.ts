import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/** Resolve the admin session, or the response to send when there is none. */
export async function requireAdmin(
  db: D1Database
): Promise<{ session: Session; denied?: undefined } | { session?: undefined; denied: NextResponse }> {
  const session = await getSession(db);
  if (!session) {
    return { denied: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  if (!session.user.isAdmin) {
    return { denied: NextResponse.json({ error: "Not permitted" }, { status: 403 }) };
  }
  return { session };
}
