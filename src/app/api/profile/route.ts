import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function PATCH(request: NextRequest) {
  const db = await getDB();
  const session = await getSession(db);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { name, location } = (await request.json()) as { name?: string; location?: string };

  const updates: string[] = [];
  const values: string[] = [];

  if (name && typeof name === "string") {
    updates.push("name = ?");
    values.push(name.trim());
  }
  if (location !== undefined) {
    updates.push("location = ?");
    values.push(location?.trim() || "");
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  updates.push("updated_at = datetime('now')");
  values.push(session.user.id);

  await db
    .prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  return NextResponse.json({ success: true });
}
