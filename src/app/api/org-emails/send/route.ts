import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    requireOrgEmailAccess,
    resolveRecipientEmails,
    getRegistrationEmailBatches,
} from '@/lib/org-emails-server';
import { parseEmailList, sendOrgBulkEmails } from '@/lib/org-bulk-email';

export async function POST(request: NextRequest) {
    try {
        const access = await requireOrgEmailAccess();
        if (!access.ok) {
            return NextResponse.json({ error: access.message }, { status: access.status });
        }

        const body = await request.json();
        const title = String(body.title || '').trim();
        const subject = String(body.subject || '').trim();
        const toRaw = String(body.to || '').trim();
        const ccRaw = String(body.cc || '').trim();
        const bodyText = String(body.bodyText || '').trim();
        const eventId = body.eventId ? String(body.eventId).trim() : null;
        const saveAsTemplate = Boolean(body.saveAsTemplate);
        const batchNumber =
            body.batchNumber !== undefined && body.batchNumber !== null && body.batchNumber !== ''
                ? Number(body.batchNumber)
                : null;
        const userIds = Array.isArray(body.userIds)
            ? body.userIds.map((id: unknown) => String(id)).filter(Boolean)
            : [];

        if (!title || !subject || !bodyText) {
            return NextResponse.json(
                { error: 'Section title, subject, and message body are required' },
                { status: 400 }
            );
        }

        const { organizationId, userId } = access.session;

        if (eventId) {
            const event = await prisma.event.findFirst({
                where: { id: eventId, organizationId },
            });
            if (!event) {
                return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
            }
        }

        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { name: true },
        });
        if (!org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        let to: string[] = [];
        if (batchNumber && Number.isInteger(batchNumber) && batchNumber > 0) {
            const batches = await getRegistrationEmailBatches(organizationId, eventId, 99);
            const batch = batches.find((b) => b.batchNumber === batchNumber);
            if (!batch) {
                return NextResponse.json({ error: `Batch ${batchNumber} was not found` }, { status: 400 });
            }
            to = batch.emails;
        } else {
            to = await resolveRecipientEmails(organizationId, userIds, toRaw);
        }
        const cc = parseEmailList(ccRaw);

        if (to.length === 0) {
            return NextResponse.json(
                { error: 'Add at least one recipient in To or select team members' },
                { status: 400 }
            );
        }

        if (to.length > 100) {
            return NextResponse.json(
                { error: 'Maximum 100 recipients per send. Split into smaller batches.' },
                { status: 400 }
            );
        }

        let templateId: string | null = null;
        if (saveAsTemplate) {
            const t = await prisma.organizationEmailTemplate.create({
                data: {
                    organizationId,
                    eventId,
                    createdById: userId,
                    title,
                    subject,
                    cc: ccRaw,
                    bodyText,
                },
            });
            templateId = t.id;
        }

        const result = await sendOrgBulkEmails({
            to,
            cc,
            subject,
            sectionTitle: title,
            bodyText,
            organizationId,
            eventId,
            organizationName: org.name,
        });

        const sentLog = await prisma.organizationEmailSent.create({
            data: {
                organizationId,
                eventId,
                templateId,
                sentById: userId,
                title,
                subject,
                toEmails: to,
                ccEmails: cc,
                bodyText,
                recipientCount: result.sent,
            },
        });

        return NextResponse.json({
            success: result.failed.length === 0,
            sent: result.sent,
            failed: result.failed,
            log: sentLog,
            message:
                result.failed.length === 0
                    ? `Sent to ${result.sent} recipient(s).`
                    : `Sent to ${result.sent} recipient(s). ${result.failed.length} failed.`,
        });
    } catch (e) {
        console.error('POST org-emails/send', e);
        const message = e instanceof Error ? e.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
