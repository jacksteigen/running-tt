import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

/** The little the navigation needs to know about the signed-in athlete. */
export async function GET() {
  const db = await getDB();
  const session = await getSession(db);

  return NextResponse.json(
    {
      user: session
        ? {
            name: session.user.name,
            isAdmin: session.user.isAdmin,
            profileCompleted: session.user.profileCompleted,
          }
        : null,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
