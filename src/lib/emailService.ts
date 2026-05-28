import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { getResolvedBadgeTemplateSrcForOrg } from '@/lib/badge-template-server';
import { generateBadgeImage } from '@/lib/generate-badge-image';
import {
    getSummitEmailBranding,
    type SummitEmailBranding,
} from '@/lib/summit-registration-config';

// Registration type for email service (matching Prisma model)
interface Registration {
    id: number;
    fullName: string;
    churchName: string;
    serviceRole: string;
    phoneNumber: string;
    email?: string | null;
    amount: string;
    paymentStatus: string;
    isGroup: boolean;
    ticketNumber?: number | null;
    organizationId?: string | null;
    eventId?: string | null;
    attendees?: {
        fullName: string;
        role: string;
        amount: string;
        ticketNumber?: number | null;
        phoneNumber?: string | null;
    }[];
}

const port = parseInt(process.env.SMTP_PORT || '587');
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: port,
    secure: port === 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const EVENT_NAME = process.env.EVENT_NAME || "CHURCH LEADERSHIP SUMMIT";
const EVENT_DATE = process.env.EVENT_DATE || "March 31 - April 2, 2026";
const EVENT_LOCATION = process.env.EVENT_LOCATION || "Hawassa Yehiwot Birhan Church";
const EVENT_CITY = process.env.EVENT_CITY || "ADDIS ABABA";
const EVENT_YEAR = process.env.EVENT_YEAR || "2026";
const EVENT_YEAR_NUM = new Date().getFullYear().toString();
const FROM_NAME = process.env.FROM_NAME || "Church Leadership Summit";

async function getRegistrationPublicContext(registration: Registration): Promise<{
    registerUrl: string;
    organizationName: string | null;
}> {
    const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        '';

    if (!registration.organizationId) {
        return { registerUrl: `${baseUrl}/register`, organizationName: null };
    }

    const org = await prisma.organization.findUnique({
        where: { id: registration.organizationId },
        select: { name: true, slug: true },
    });
    if (!org) {
        return { registerUrl: `${baseUrl}/register`, organizationName: null };
    }

    if (!registration.eventId) {
        return { registerUrl: `${baseUrl}/${org.slug}/register`, organizationName: org.name };
    }

    const event = await prisma.event.findFirst({
        where: { id: registration.eventId, organizationId: registration.organizationId },
        select: { slug: true },
    });

    return {
        registerUrl: event
            ? `${baseUrl}/${org.slug}/${event.slug}/register`
            : `${baseUrl}/${org.slug}/register`,
        organizationName: org.name,
    };
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Generate HTML email ticket (just the image)
 */
function generateTicketHtml(cid: string): string {
    return `
    <div style="width: 100%; max-width: 360px; margin: 0 auto 30px auto;">
        <img src="cid:${cid}" alt="Summit Ticket" style="width: 100%; height: auto; display: block; border-radius: 12px; box-shadow: 0 10px 20px rgba(0,0,0,0.1);" />
    </div>
    `;
}

/**
 * Generate HTML email template (for individual registration)
 */
function generateIndividualEmailTemplate(
    registration: Registration,
    badgeCid: string,
    branding: SummitEmailBranding,
    registerUrl: string,
    organizationName: string | null
): string {
    const ticketHtml = generateTicketHtml(badgeCid);
    const downloadUrl = `${registerUrl}?trade_status=PAY_SUCCESS&callback_info=individual_${registration.id}&total_amount=0&lang=en`;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Registration Confirmed - ${escapeHtml(branding.eventTitle)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08);">
                    <!-- Brand Header -->
                    <tr>
                        <td align="center" style="padding: 50px 40px 10px 40px;">
                            <div style="width: 80px; height: 5px; background-color: #22C55E; border-radius: 10px; margin-bottom: 30px;"></div>
                            <h1 style="margin: 0; font-size: 28px; color: #0f172a; font-weight: 900; letter-spacing: -1px;">Registration Successful!</h1>
                            <p style="margin: 12px 0 0 0; font-size: 16px; color: #64748b;">Thank you for registering for ${escapeHtml(branding.eventTitle)}.</p>
                        </td>
                    </tr>

                    <!-- The Ticket -->
                    <tr>
                        <td align="center" style="padding: 40px 20px 10px 20px;">
                            ${ticketHtml}
                        </td>
                    </tr>

                    <!-- Download Button -->
                    <tr>
                        <td align="center" style="padding: 10px 40px 40px 40px;">
                            <a href="${downloadUrl}" style="display: inline-block; background-color: #1e293b; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 800; font-size: 15px; box-shadow: 0 10px 15px rgba(0,0,0,0.1); transition: all 0.2s;">
                                <span>📥</span> &nbsp; Download Official Ticket
                            </a>
                            <p style="margin: 20px 0 0 0; font-size: 13px; color: #94a3b8; max-width: 400px; line-height: 1.5;">
                                Please download and save your badge. Use this specific QR code for check-in on the event day.
                            </p>
                        </td>
                    </tr>

                    <!-- Instructions -->
                    <tr>
                        <td style="padding: 0 40px 30px 40px; text-align: center;">
                            <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.6;">
                                Please present this QR code at the event entrance for check-in.<br/>
                                You can also download or screenshot this ticket for quick access.
                            </p>
                        </td>
                    </tr>

                    <!-- Event Info Grid -->
                    <tr>
                        <td style="padding: 40px; background-color: #f8fafc; border-top: 1px solid #f1f5f9;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td width="33%" valign="top" style="padding-right: 20px;">
                                        <p style="margin: 0; font-size: 10px; text-transform: uppercase; font-weight: 800; color: #94a3b8; letter-spacing: 1.5px;">Date</p>
                                        <p style="margin: 6px 0 0 0; font-size: 14px; font-weight: 800; color: #334155;">${escapeHtml(branding.datesLine)}</p>
                                    </td>
                                    <td width="33%" valign="top" style="padding-right: 20px;">
                                        <p style="margin: 0; font-size: 10px; text-transform: uppercase; font-weight: 800; color: #94a3b8; letter-spacing: 1.5px;">Location</p>
                                        <p style="margin: 6px 0 0 0; font-size: 14px; font-weight: 800; color: #334155;">${escapeHtml(branding.placeLine)}</p>
                                    </td>
                                    <td width="33%" valign="top">
                                        <p style="margin: 0; font-size: 10px; text-transform: uppercase; font-weight: 800; color: #94a3b8; letter-spacing: 1.5px;">Entry</p>
                                        <p style="margin: 6px 0 0 0; font-size: 14px; font-weight: 800; color: #334155;">08:30 AM</p>
                                    </td>
                                </tr>
                            </table>
                            ${
                                branding.supportEmail
                                    ? `<p style="margin: 16px 0 0 0; font-size: 13px; color: #475569; text-align: center;">Contact: <a href="mailto:${branding.supportEmail.replace(/"/g, '')}">${escapeHtml(branding.supportEmail)}</a></p>`
                                    : ''
                            }
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 40px; background-color: #0f172a; color: #ffffff; text-align: center;">
                            <p style="margin: 0; font-size: 15px; font-weight: 900; letter-spacing: 0.5px;">${escapeHtml(organizationName || branding.eventTitle)}</p>
                            <p style="margin: 10px 0 0 0; font-size: 12px; color: #94a3b8; opacity: 0.8;">Powered by Yotor Church Management System</p>
                        </td>
                    </tr>
                </table>
                <p style="margin-top: 25px; font-size: 12px; color: #94a3b8; text-align: center; font-weight: 500;">
                    &copy; ${escapeHtml(branding.yearLabel)} ${escapeHtml(branding.eventTitle)}. All rights reserved.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
}

/**
 * Generate HTML email template with multiple tickets for group registration
 */
async function generateGroupEmailTemplate(
    registration: Registration,
    branding: SummitEmailBranding,
    registerUrl: string,
    organizationName: string | null
): Promise<{ html: string; attachments: any[] }> {
    const attendeeCount = registration.attendees?.length || 0;
    const downloadUrl = `${registerUrl}?trade_status=PAY_SUCCESS&callback_info=group_${registration.id}&total_amount=0&lang=en`;

    const templateSrc = await getResolvedBadgeTemplateSrcForOrg(registration.organizationId);

    const attachments: any[] = [];
    const ticketsHtmlParts: string[] = [];

    // Generate badges for each attendee
    for (let i = 0; i < (registration.attendees || []).length; i++) {
        const attendee = registration.attendees![i];
        // const badgeId = `CLS-${registration.id.toString().padStart(4, '0')}-${(i + 1).toString().padStart(2, '0')}`;
        const cid = `badge-group-${i}`;

        const qrData = JSON.stringify({
            groupId: registration.id,
            attendeeIndex: i,
            name: attendee.fullName,
            church: registration.churchName,
            role: attendee.role,
            type: 'group-attendee',
            timestamp: new Date().toISOString()
        });

        const ticketNo = (attendee.ticketNumber || 0).toString().padStart(4, '0');
        const buffer = await generateBadgeImage(attendee.fullName, ticketNo, qrData, templateSrc);

        attachments.push({
            filename: `badge-${i}.png`,
            content: buffer,
            cid: cid
        });

        ticketsHtmlParts.push(generateTicketHtml(cid));
    }

    const ticketsHtml = ticketsHtmlParts.join('\n');

    const html = `
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08);">
                    <!-- Brand Header -->
                    <tr>
                        <td align="center" style="padding: 50px 40px 10px 40px;">
                            <div style="width: 80px; height: 5px; background-color: #22C55E; border-radius: 10px; margin-bottom: 30px;"></div>
                            <h1 style="margin: 0; font-size: 28px; color: #0f172a; font-weight: 900; letter-spacing: -1px;">Group Registration Successful!</h1>
                            <p style="margin: 12px 0 0 0; font-size: 16px; color: #64748b;">${attendeeCount} ${attendeeCount === 1 ? 'attendee' : 'attendees'} registered successfully.</p>
                        </td>
                    </tr>

                    <!-- The Tickets -->
                    <tr>
                        <td align="center" style="padding: 20px 20px;">
                            <h2 style="margin: 0 0 25px 0; font-size: 18px; color: #334155; font-weight: 800; text-align: center;">Attendee Badges</h2>
                            <p style="margin: -15px 0 30px 0; font-size: 13px; color: #94a3b8; text-align: center; max-width: 400px; line-height: 1.5;">Please share these individual tickets with your group members.</p>
                            ${ticketsHtml}
                        </td>
                    </tr>

                    <!-- Download Button -->
                    <tr>
                        <td align="center" style="padding: 0 40px 40px 40px;">
                            <a href="${downloadUrl}" style="display: inline-block; background-color: #1e293b; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 800; font-size: 15px; box-shadow: 0 10px 15px rgba(0,0,0,0.1); transition: all 0.2s;">
                                <span>📥</span> &nbsp; Download All Tickets (PDF)
                            </a>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 20px 40px 40px 40px; background-color: #f8fafc; border-top: 1px solid #f1f5f9;">
                            <p style="margin: 0; font-size: 10px; text-transform: uppercase; font-weight: 800; color: #94a3b8; letter-spacing: 1.5px;">Event</p>
                            <p style="margin: 6px 0 0 0; font-size: 14px; font-weight: 800; color: #334155;">${escapeHtml(branding.eventTitle)}</p>
                            <p style="margin: 8px 0 0 0; font-size: 13px; color: #475569;">${escapeHtml(branding.datesLine)}</p>
                            <p style="margin: 4px 0 0 0; font-size: 13px; color: #475569;">${escapeHtml(branding.placeLine)}</p>
                            ${
                                branding.supportEmail
                                    ? `<p style="margin: 12px 0 0 0; font-size: 13px;"><a href="mailto:${escapeHtml(branding.supportEmail)}">${escapeHtml(branding.supportEmail)}</a></p>`
                                    : ''
                            }
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 40px; background-color: #0f172a; color: #ffffff; text-align: center;">
                            <p style="margin: 0; font-size: 15px; font-weight: 900; letter-spacing: 0.5px;">Great Commission Ministry Ethiopia</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;

    return { html, attachments };
}

/**
 * Send confirmation email with QR code badge(s)
 * For group registrations, sends individual QR codes for each attendee
 */
export async function sendConfirmationEmail(
    registration: Registration,
    email: string
): Promise<boolean> {
    try {
        const { registerUrl, organizationName } = await getRegistrationPublicContext(registration);
        const branding = await getSummitEmailBranding(
            registration.organizationId ?? null,
            registration.eventId ?? null
        );

        let htmlContent: string;
        let subject: string;
        let attachments: any[] = [];

        if (registration.isGroup && registration.attendees && registration.attendees.length > 0) {
            // Group registration
            const result = await generateGroupEmailTemplate(
                registration,
                branding,
                registerUrl,
                organizationName
            );
            htmlContent = result.html;
            attachments = result.attachments;
            subject = `✓ Group Registration Confirmed - ${branding.eventTitle} (${registration.attendees.length} attendees)`;
        } else {
            // Individual registration
            const qrData = JSON.stringify({
                id: registration.id,
                name: registration.fullName,
                church: registration.churchName,
                type: 'individual',
                timestamp: new Date().toISOString()
            });

            const badgeCid = 'unique-badge-cid';
            const ticketNo = (registration.ticketNumber || 0).toString().padStart(4, '0');
            const templateSrc = await getResolvedBadgeTemplateSrcForOrg(registration.organizationId);
            const buffer = await generateBadgeImage(registration.fullName, ticketNo, qrData, templateSrc);

            attachments.push({
                filename: 'Badge.png',
                content: buffer,
                cid: badgeCid
            });

            htmlContent = generateIndividualEmailTemplate(
                registration,
                badgeCid,
                branding,
                registerUrl,
                organizationName
            );
            subject = `✓ Registration Confirmed - ${branding.eventTitle}`;
        }

        // Send email
        const info = await transporter.sendMail({
            from: `"${branding.eventTitle}" <${process.env.SMTP_USER}>`,
            to: email,
            subject: subject,
            html: htmlContent,
            attachments: attachments
        });

        console.log('Email sent successfully:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending confirmation email:', error);
        return false;
    }
}

/**
 * Send invitation email to a new team member
 */
export async function sendInvitationEmail(
    email: string,
    roleName: string,
    inviteLink: string
): Promise<boolean> {
    try {
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>You've been invited - Church Leadership Summit</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08);">
                    <!-- Brand Header -->
                    <tr>
                        <td align="center" style="padding: 50px 40px 10px 40px;">
                            <div style="width: 80px; height: 5px; background-color: #22C55E; border-radius: 10px; margin-bottom: 30px;"></div>
                            <h1 style="margin: 0; font-size: 28px; color: #0f172a; font-weight: 900; letter-spacing: -1px;">You're Invited!</h1>
                            <p style="margin: 12px 0 0 0; font-size: 16px; color: #64748b;">Join the management team.</p>
                        </td>
                    </tr>

                    <!-- Invite Info -->
                    <tr>
                        <td align="center" style="padding: 30px 40px;">
                            <p style="font-size: 16px; color: #475569; line-height: 1.6; margin-bottom: 30px;">
                                You have been invited to join the management portal as a <strong>${roleName}</strong>.
                            </p>
                            
                            <a href="${inviteLink}" style="display: inline-block; background-color: #22C55E; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 16px; font-weight: 800; font-size: 16px; box-shadow: 0 10px 15px rgba(34, 197, 94, 0.2);">
                                Accept Invitation
                            </a>
                            
                            <p style="margin: 30px 0 0 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                                This link will expire in 7 days. If you weren't expecting this invitation, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 40px; background-color: #0f172a; color: #ffffff; text-align: center;">
                            <p style="margin: 0; font-size: 15px; font-weight: 900; letter-spacing: 0.5px;">Great Commission Ministry Ethiopia</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;

        await transporter.sendMail({
            from: `"${FROM_NAME}" <${process.env.SMTP_USER}>`,
            to: email,
            subject: `Management Portal Invitation`,
            html: htmlContent
        });

        console.log('Invitation email sent successfully to:', email);
        return true;
    } catch (error) {
        console.error('Error sending invitation email:', error);
        return false;
    }
}

/**
 * Invite to a specific organization (org role: ADMIN or STAFF)
 */
export async function sendOrgInvitationEmail(
    email: string,
    organizationName: string,
    orgRole: string,
    inviteLink: string
): Promise<boolean> {
    try {
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Organization invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08);">
                    <tr>
                        <td align="center" style="padding: 50px 40px 10px 40px;">
                            <div style="width: 80px; height: 5px; background-color: #22C55E; border-radius: 10px; margin-bottom: 30px;"></div>
                            <h1 style="margin: 0; font-size: 28px; color: #0f172a; font-weight: 900;">You're invited</h1>
                            <p style="margin: 12px 0 0 0; font-size: 16px; color: #64748b;">${organizationName}</p>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 30px 40px;">
                            <p style="font-size: 16px; color: #475569; line-height: 1.6; margin-bottom: 30px;">
                                You have been invited to join <strong>${organizationName}</strong> as <strong>${orgRole}</strong>.
                            </p>
                            <a href="${inviteLink}" style="display: inline-block; background-color: #22C55E; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 16px; font-weight: 800; font-size: 16px;">
                                Accept invitation
                            </a>
                            <p style="margin: 30px 0 0 0; font-size: 13px; color: #94a3b8;">
                                This link expires in 7 days.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px; background-color: #0f172a; color: #ffffff; text-align: center;">
                            <p style="margin: 0; font-size: 15px; font-weight: 900;">${escapeHtml(organizationName || branding.eventTitle)}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;

        await transporter.sendMail({
            from: `"${FROM_NAME}" <${process.env.SMTP_USER}>`,
            to: email,
            subject: `Invitation to ${organizationName}`,
            html: htmlContent,
        });
        return true;
    } catch (error) {
        console.error('Error sending org invitation email:', error);
        return false;
    }
}

export type PasswordResetEmailOptions = {
    userName?: string;
    organizationId?: string | null;
    eventId?: string | null;
    organizationName?: string;
};

/**
 * Password reset link for dashboard users (branded per org / event).
 */
export async function sendPasswordResetEmail(
    email: string,
    resetLink: string,
    options?: PasswordResetEmailOptions | string
): Promise<boolean> {
    try {
        const opts: PasswordResetEmailOptions =
            typeof options === 'string' ? { userName: options } : options ?? {};
        const userName = opts.userName;
        const organizationName = opts.organizationName?.trim() || '';

        const branding = await getSummitEmailBranding(
            opts.organizationId ?? null,
            opts.eventId ?? null
        );

        const eventTitle = branding.eventTitle.trim();
        const subtitleParts = [
            organizationName && organizationName !== eventTitle ? organizationName : '',
            branding.datesLine?.trim(),
        ].filter(Boolean);
        const subtitle = subtitleParts.join(' · ') || organizationName || eventTitle;

        const greeting = userName?.trim() ? `Hi ${escapeHtml(userName.trim())},` : 'Hi,';
        const footerLabel = organizationName || eventTitle || FROM_NAME;
        const fromLabel = organizationName || eventTitle || FROM_NAME;
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reset your password — ${escapeHtml(eventTitle)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08);">
                    <tr>
                        <td align="center" style="padding: 50px 40px 10px 40px;">
                            <div style="width: 80px; height: 5px; background-color: #22C55E; border-radius: 10px; margin: 0 auto 30px auto;"></div>
                            <h1 style="margin: 0; font-size: 28px; color: #0f172a; font-weight: 900;">Reset your password</h1>
                            <p style="margin: 12px 0 0 0; font-size: 16px; color: #64748b; line-height: 1.4;">${escapeHtml(eventTitle)}</p>
                            ${subtitle && subtitle !== eventTitle ? `<p style="margin: 8px 0 0 0; font-size: 14px; color: #94a3b8;">${escapeHtml(subtitle)}</p>` : ''}
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 30px 40px;">
                            <p style="font-size: 16px; color: #475569; line-height: 1.6; margin-bottom: 30px; text-align: left;">
                                ${greeting}<br><br>
                                We received a request to reset the password for your <strong>${escapeHtml(eventTitle)}</strong> management account. Click the button below to choose a new password.
                            </p>
                            <a href="${resetLink}" style="display: inline-block; background-color: #22C55E; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 16px; font-weight: 800; font-size: 16px;">
                                Reset password
                            </a>
                            <p style="margin: 30px 0 0 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                                If you did not request this, you can safely ignore this email. This link expires after a short time.
                            </p>
                            ${branding.supportEmail ? `<p style="margin: 16px 0 0 0; font-size: 13px; color: #94a3b8;">Questions? Contact <a href="mailto:${escapeHtml(branding.supportEmail)}" style="color: #22C55E;">${escapeHtml(branding.supportEmail)}</a></p>` : ''}
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px; background-color: #0f172a; color: #ffffff; text-align: center;">
                            <p style="margin: 0; font-size: 15px; font-weight: 900;">${escapeHtml(footerLabel)}</p>
                            ${branding.placeLine ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #94a3b8;">${escapeHtml(branding.placeLine)}</p>` : ''}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;

        const safeFromLabel = fromLabel.replace(/"/g, "'");

        await transporter.sendMail({
            from: `"${safeFromLabel}" <${process.env.SMTP_USER}>`,
            to: email,
            subject: `Reset your password — ${eventTitle}`,
            html: htmlContent,
        });
        return true;
    } catch (error) {
        console.error('Error sending password reset email:', error);
        return false;
    }
}

/**
 * Verify email transporter configuration
 */
export async function verifyEmailConfig(): Promise<boolean> {
    try {
        await transporter.verify();
        console.log('Email server is ready to send messages');
        return true;
    } catch (error) {
        console.error('Email server verification failed:', error);
        return false;
    }
}
