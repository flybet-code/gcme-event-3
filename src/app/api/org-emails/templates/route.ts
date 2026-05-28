import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgEmailAccess } from '@/lib/org-emails-server';

export async function POST(request: NextRequest) {
    try {
        const access = await requireOrgEmailAccess();
        if (!access.ok) {
            return NextResponse.json({ error: access.message }, { status: access.status });
        }

        const body = await request.json();
        const title = String(body.title || '').trim();
        const subject = String(body.subject || '').trim();
        const cc = String(body.cc || '').trim();
        const bodyText = String(body.bodyText || '').trim();
        const eventId = body.eventId ? String(body.eventId).trim() : null;

        if (!title || !subject || !bodyText) {
            return NextResponse.json(
                { error: 'title, subject, and bodyText are required' },
                { status: 400 }
            );
        }

        if (eventId) {
            const event = await prisma.event.findFirst({
                where: { id: eventId, organizationId: access.session.organizationId },
            });
            if (!event) {
                return NextResponse.json({ error: 'Invalid event' }, { status: 400 });
            }
        }

        const template = await prisma.organizationEmailTemplate.create({
            data: {
                organizationId: access.session.organizationId,
                eventId,
                createdById: access.session.userId,
                title,
                subject,
                cc,
                bodyText,
            },
        });

        return NextResponse.json({ data: template });
    } catch (e) {
        console.error('POST org email template', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
