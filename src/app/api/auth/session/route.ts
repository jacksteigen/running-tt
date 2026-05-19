import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const db = await getDB();
  const session = await getSession(db);

  if (!session) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({ user: session.user });
}
