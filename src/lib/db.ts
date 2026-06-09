import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getDB(): Promise<D1Database> {
  const { env } = await getCloudflareContext();
  const db = (env as unknown as { DB: D1Database }).DB;
  if (!db) {
    throw new Error("D1 database binding not found");
  }
  return db;
}

export async function getPhotosBucket(): Promise<R2Bucket> {
  const { env } = await getCloudflareContext();
  const bucket = (env as unknown as { PHOTOS: R2Bucket }).PHOTOS;
  if (!bucket) {
    throw new Error("R2 photos bucket binding not found");
  }
  return bucket;
}
