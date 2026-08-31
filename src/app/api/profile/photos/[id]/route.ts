import { NextRequest, NextResponse } from "next/server";
import { getDB, getPhotosBucket } from "@/lib/db";
import { getSession } from "@/lib/auth";

const CAPTION_LIMIT = 140;

/** Update one album photo's caption. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDB();
  const session = await getSession(db);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let caption = "";
  try {
    const body = (await request.json()) as { caption?: string };
    caption =
      typeof body.caption === "string"
        ? body.caption.trim().slice(0, CAPTION_LIMIT)
        : "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await db
    .prepare("UPDATE user_photos SET caption = ? WHERE id = ? AND user_id = ?")
    .bind(caption, id, session.user.id)
    .run();

  if (!result.meta.changes) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

/** Remove one album photo. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getDB();
  const session = await getSession(db);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const photo = await db
    .prepare("SELECT r2_key FROM user_photos WHERE id = ? AND user_id = ?")
    .bind(id, session.user.id)
    .first<{ r2_key: string }>();

  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const bucket = await getPhotosBucket();
  await bucket.delete(photo.r2_key);

  await db
    .prepare("DELETE FROM user_photos WHERE id = ? AND user_id = ?")
    .bind(id, session.user.id)
    .run();

  return NextResponse.json({ success: true });
}
