import nodemailer from 'nodemailer';
import { getSummitEmailBranding, type SummitEmailBranding } from '@/lib/summit-registration-config';

const port = parseInt(process.env.SMTP_PORT || '587');
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/** Parse comma, semicolon, or newline separated email addresses. */
export function parseEmailList(raw: string): string[] {
    if (!raw?.trim()) return [];
    const parts = raw.split(/[,;\n\r]+/).map((s) => s.trim().toLowerCase());
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of parts) {
        if (!p || !p.includes('@')) continue;
        if (seen.has(p)) continue;
        seen.add(p);
        out.push(p);
    }
    return out;
}

export function textToHtmlBody(text: string): string {
    return escapeHtml(text).replace(/\n/g, '<br />');
}

export function buildOrgBrandedEmailHtml(options: {
    sectionTitle: string;
    bodyText: string;
    branding: SummitEmailBranding;
    organizationName: string;
}): string {
    const { sectionTitle, bodyText, branding, organizationName } = options;
    const eventTitle = branding.eventTitle.trim();
    const footerLabel = organizationName || eventTitle;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(sectionTitle)}</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:40px 40px 16px 40px;text-align:center;">
              <div style="width:80px;height:5px;background:#22C55E;border-radius:10px;margin:0 auto 24px auto;"></div>
              <h1 style="margin:0;font-size:26px;color:#0f172a;font-weight:900;">${escapeHtml(sectionTitle)}</h1>
              <p style="margin:12px 0 0 0;font-size:16px;color:#64748b;">${escapeHtml(eventTitle)}</p>
              ${branding.datesLine ? `<p style="margin:8px 0 0 0;font-size:14px;color:#94a3b8;">${escapeHtml(branding.datesLine)}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 40px 40px;">
              <div style="font-size:16px;color:#475569;line-height:1.7;text-align:left;">
                ${textToHtmlBody(bodyText)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;background:#0f172a;color:#fff;text-align:center;">
              <p style="margin:0;font-size:15px;font-weight:900;">${escapeHtml(footerLabel)}</p>
              ${branding.placeLine ? `<p style="margin:8px 0 0 0;font-size:12px;color:#94a3b8;">${escapeHtml(branding.placeLine)}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export type SendOrgBulkEmailInput = {
    to: string[];
    cc: string[];
    subject: string;
    sectionTitle: string;
    bodyText: string;
    organizationId: string;
    eventId: string | null;
    organizationName: string;
};

export type SendOrgBulkEmailResult = {
    sent: number;
    failed: { email: string; error: string }[];
};

/** Send one message per To address (same subject/body), with shared CC on each. */
export async function sendOrgBulkEmails(
    input: SendOrgBulkEmailInput
): Promise<SendOrgBulkEmailResult> {
    const branding = await getSummitEmailBranding(input.organizationId, input.eventId);
    const html = buildOrgBrandedEmailHtml({
        sectionTitle: input.sectionTitle,
        bodyText: input.bodyText,
        branding,
        organizationName: input.organizationName,
    });
    const fromLabel = (input.organizationName || branding.eventTitle).replace(/"/g, "'");
    const smtpUser = process.env.SMTP_USER;
    if (!smtpUser) {
        throw new Error('SMTP is not configured');
    }

    const failed: { email: string; error: string }[] = [];
    let sent = 0;

    for (const to of input.to) {
        try {
            await transporter.sendMail({
                from: `"${fromLabel}" <${smtpUser}>`,
                to,
                cc: input.cc.length > 0 ? input.cc : undefined,
                subject: input.subject,
                text: input.bodyText,
                html,
            });
            sent += 1;
        } catch (err) {
            failed.push({
                email: to,
                error: err instanceof Error ? err.message : 'Send failed',
            });
        }
    }

    return { sent, failed };
}
