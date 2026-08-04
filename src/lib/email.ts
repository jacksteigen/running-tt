import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Absolute asset base so email clients can load images no matter where the request originated. */
const ASSET_BASE = "https://runningtt.com";

interface EmailShellOptions {
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footnote?: string;
}

/**
 * Shared branded shell for every Running TT email: bone background, white
 * card, RTT stopwatch lockup on top, terracotta button. Table-based layout
 * and inline styles for email-client compatibility. No em dashes, ever.
 */
function emailShell({
  heading,
  bodyHtml,
  ctaLabel,
  ctaUrl,
  footnote,
}: EmailShellOptions) {
  return `
  <div style="background: #F5F2EC; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; margin: 0 auto;">
      <tr>
        <td style="padding: 8px 0 20px 0; text-align: center;">
          <img src="${ASSET_BASE}/logo-nav.png" width="56" alt="Running TT" style="display: inline-block; border: 0;" />
          <p style="margin: 10px 0 0 0; font-size: 11px; letter-spacing: 0.25em; color: #8B7355; text-transform: uppercase; font-family: 'SF Mono', Menlo, Consolas, monospace;">Running TT</p>
        </td>
      </tr>
      <tr>
        <td style="background: #ffffff; border: 1px solid #E8E2D6; padding: 36px 32px;">
          <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1A1A18; letter-spacing: -0.01em;">${heading}</h1>
          ${bodyHtml}
          ${
            ctaLabel && ctaUrl
              ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0 8px 0; width: 100%;">
            <tr>
              <td style="background: #C4593A; text-align: center;">
                <a href="${ctaUrl}" style="display: block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 500;">${ctaLabel}</a>
              </td>
            </tr>
          </table>`
              : ""
          }
          ${
            footnote
              ? `<p style="margin: 16px 0 0 0; color: #8B7355; font-size: 13px; line-height: 1.5;">${footnote}</p>`
              : ""
          }
        </td>
      </tr>
      <tr>
        <td style="padding: 20px 8px; text-align: center;">
          <p style="margin: 0; color: #8B7355; font-size: 12px; line-height: 1.6;">
            Running TT · You. The clock. Nothing else.<br/>
            Worldwide time trials · <a href="${ASSET_BASE}" style="color: #C4593A; text-decoration: none;">runningtt.com</a>
          </p>
        </td>
      </tr>
    </table>
  </div>`;
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
  const { env } = await getCloudflareContext();
  const RESEND_API_KEY = (env as unknown as Record<string, string>)
    .RESEND_API_KEY;
  const FROM_EMAIL =
    (env as unknown as Record<string, string>).FROM_EMAIL ||
    "Running TT <noreply@runningtt.com>";

  if (!RESEND_API_KEY) {
    console.log(`[DEV] Email to ${to}: ${subject}\n${text}`);
    return { success: true, dev: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html, text }),
  });

  if (!response.ok) {
    console.error("Email send failed with status", response.status);
    return { success: false };
  }

  return { success: true };
}

export async function sendMagicLinkEmail(
  email: string,
  token: string,
  baseUrl: string
) {
  const verifyUrl = `${baseUrl}/api/auth/verify?token=${token}`;

  const html = emailShell({
    heading: "Sign in to Running TT",
    bodyHtml: `
      <p style="margin: 0; color: #1A1A18; font-size: 15px; line-height: 1.6;">
        Press the button below, then press <strong>Complete sign in</strong> on
        the page that opens. The link works once and expires in 15 minutes.
      </p>`,
    ctaLabel: "Sign in to Running TT",
    ctaUrl: verifyUrl,
    footnote:
      "If you did not request this, you can safely ignore this email. Your account stays untouched.",
  });

  const text = [
    "Sign in to Running TT",
    "",
    "Open this link, then press Complete sign in on the page that opens.",
    "It works once and expires in 15 minutes.",
    "",
    verifyUrl,
    "",
    "If you did not request this, you can safely ignore this email.",
    "",
    "Running TT · You. The clock. Nothing else.",
  ].join("\n");

  return sendEmail(email, "Sign in to Running TT", html, text);
}
