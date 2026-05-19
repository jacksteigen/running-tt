import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getDB(): Promise<D1Database> {
  const { env } = await getCloudflareContext();
  const db = (env as unknown as { DB: D1Database }).DB;
  if (!db) {
    throw new Error("D1 database binding not found");
  }
  return db;
}
