import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { destroySession } from "@/lib/auth";

export async function POST() {
  const db = await getDB();
  await destroySession(db);
  return NextResponse.json({ success: true });
}
