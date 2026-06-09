interface CloudflareEnv {
  DB: D1Database;
  PHOTOS: R2Bucket;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  RESEND_API_KEY: string;
  FROM_EMAIL: string;
}
