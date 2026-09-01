import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSession } from "@/lib/auth";

/** Remove an entry. A recorded result has to be cleared first. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDB();
  const session = await getSession(db);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!session.user.isAdmin) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const entry = await db
    .prepare("SELECT id, event_id, user_id FROM entries WHERE id = ?")
    .bind(id)
    .first<{ id: string; event_id: string; user_id: string }>();

  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  const result = await db
    .prepare("SELECT id FROM results WHERE event_id = ? AND user_id = ?")
    .bind(entry.event_id, entry.user_id)
    .first();

  if (result) {
    return NextResponse.json(
      { error: "This athlete has a recorded time. Clear it before removing the entry." },
      { status: 400 }
    );
  }

  await db.prepare("DELETE FROM entries WHERE id = ?").bind(id).run();
  return NextResponse.json({ success: true });
}
