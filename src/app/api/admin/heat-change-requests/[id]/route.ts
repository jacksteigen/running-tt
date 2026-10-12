import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";

/** Close a heat change request without moving the athlete (declined or handled offline). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDB();
  const auth = await requireAdmin(db);
  if (auth.denied) return auth.denied;

  let status = "";
  try {
    const body = (await request.json()) as { status?: string };
    status = body.status === "declined" || body.status === "done" ? body.status : "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!status) return NextResponse.json({ error: "Status must be done or declined" }, { status: 400 });

  await db
    .prepare(
      "UPDATE heat_change_requests SET status = ?, resolved_at = datetime('now'), resolved_by = ? WHERE id = ?"
    )
    .bind(status, auth.session.user.id, id)
    .run();
  return NextResponse.json({ success: true });
}
