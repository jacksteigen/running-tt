import { NextRequest, NextResponse } from "next/server";
import { getDB, getPhotosBucket } from "@/lib/db";
import { getSession, generateId } from "@/lib/auth";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_PHOTOS = 10;

/** Add one photo to the athlete's album. */
export async function POST(request: NextRequest) {
  const db = await getDB();
  const session = await getSession(db);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let file: unknown;
  try {
    const formData = await request.formData();
    file = formData.get("photo");
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No photo provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
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

  const count = await db
    .prepare("SELECT COUNT(*) as n FROM user_photos WHERE user_id = ?")
    .bind(session.user.id)
    .first<{ n: number }>();

  if ((count?.n ?? 0) >= MAX_PHOTOS) {
    return NextResponse.json(
      { error: `Your album is full. ${MAX_PHOTOS} photos is the limit.` },
      { status: 400 }
    );
  }

  const photoId = `pho_${generateId()}`;
  const key = `users/${session.user.id}/gallery/${photoId}`;

  const bucket = await getPhotosBucket();
  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  await db
    .prepare(
      "INSERT INTO user_photos (id, user_id, r2_key, caption, sort_order) VALUES (?, ?, ?, '', ?)"
    )
    .bind(photoId, session.user.id, key, count?.n ?? 0)
    .run();

  return NextResponse.json({
    success: true,
    photo: { id: photoId, url: `/api/photos/${key}`, caption: "" },
  });
}
