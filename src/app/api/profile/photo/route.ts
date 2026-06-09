import { NextRequest, NextResponse } from "next/server";
import { getDB, getPhotosBucket } from "@/lib/db";
import { getSession } from "@/lib/auth";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: NextRequest) {
  const db = await getDB();
  const session = await getSession(db);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("photo");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No photo provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES[file.type]) {
    return NextResponse.json(
      { error: "Photo must be a JPG, PNG or WebP" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Photo must be under 5 MB" },
      { status: 400 }
    );
  }

  const bucket = await getPhotosBucket();
  const key = `users/${session.user.id}`;

  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  // Cache-busting query so a replaced photo shows immediately.
  const photoUrl = `/api/photos/${key}?v=${Date.now()}`;

  await db
    .prepare(
      "UPDATE users SET photo_url = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .bind(photoUrl, session.user.id)
    .run();

  return NextResponse.json({ success: true, photoUrl });
}

export async function DELETE() {
  const db = await getDB();
  const session = await getSession(db);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const bucket = await getPhotosBucket();
  await bucket.delete(`users/${session.user.id}`);

  await db
    .prepare(
      "UPDATE users SET photo_url = NULL, updated_at = datetime('now') WHERE id = ?"
    )
    .bind(session.user.id)
    .run();

  return NextResponse.json({ success: true });
}
