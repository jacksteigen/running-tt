import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function sendMagicLinkEmail(
  email: string,
  token: string,
  baseUrl: string
) {
  const { env } = await getCloudflareContext();
  const RESEND_API_KEY = (env as unknown as Record<string, string>).RESEND_API_KEY;
  const FROM_EMAIL =
    (env as unknown as Record<string, string>).FROM_EMAIL ||
    "Running TT <noreply@runningtt.com>";

  const verifyUrl = `${baseUrl}/api/auth/verify?token=${token}`;

  if (!RESEND_API_KEY) {
    console.log(`[DEV] Magic link for ${email}: ${verifyUrl}`);
    return { success: true, dev: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: email,
      subject: "Sign in to Running TT",
      html: `
        <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <p style="font-size: 18px; font-weight: 600; color: #1A1A18; margin-bottom: 24px;">Running TT</p>
          <p style="color: #1A1A18; font-size: 15px; line-height: 1.6;">
            Click the link below to sign in. This link expires in 15 minutes.
          </p>
          <a href="${verifyUrl}" style="display: inline-block; margin: 24px 0; background: #C4593A; color: white; text-decoration: none; padding: 12px 32px; font-size: 14px; font-weight: 500;">
            Sign in to Running TT
          </a>
          <p style="color: #8B7355; font-size: 13px; line-height: 1.5;">
            If you didn't request this, you can safely ignore this email.
          </p>
          <p style="color: #8B7355; font-size: 12px; margin-top: 32px; border-top: 1px solid #E8E2D6; padding-top: 16px;">
            Running TT · You. The clock. Nothing else.
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Failed to send email:", error);
    return { success: false, error };
  }

  return { success: true };
}
