import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    requireOrgEmailAccess,
    getRegistrationEmailBatches,
    getRegistrationSmsBatches,
} from '@/lib/org-emails-server';
import { getSummitEmailBranding } from '@/lib/summit-registration-config';

export async function GET(request: Request) {
    try {
        const access = await requireOrgEmailAccess();
        if (!access.ok) {
            return NextResponse.json({ error: access.message }, { status: access.status });
        }

        const { organizationId } = access.session;
        const url = new URL(request.url);
        const requestedEventId = url.searchParams.get('eventId')?.trim() || null;

        const [org, templates, sent, events, members] = await Promise.all([
            prisma.organization.findUnique({
                where: { id: organizationId },
                select: { id: true, name: true, slug: true },
            }),
            prisma.organizationEmailTemplate.findMany({
                where: { organizationId },
                orderBy: { updatedAt: 'desc' },
                take: 50,
            }),
            prisma.organizationEmailSent.findMany({
                where: { organizationId },
                orderBy: { createdAt: 'desc' },
                take: 50,
            }),
            prisma.event.findMany({
                where: { organizationId },
                orderBy: { startsAt: 'desc' },
                select: { id: true, name: true, slug: true, startsAt: true },
            }),
            prisma.organizationMember.findMany({
                where: { organizationId },
                include: { user: { select: { id: true, name: true, email: true } } },
                orderBy: { createdAt: 'desc' },
            }),
        ]);

        const effectiveEventId =
            requestedEventId && events.some((e) => e.id === requestedEventId)
                ? requestedEventId
                : events[0]?.id ?? null;

        const [branding, registrationEmailBatches, registrationSmsBatches] = await Promise.all([
            getSummitEmailBranding(organizationId, effectiveEventId),
            getRegistrationEmailBatches(organizationId, effectiveEventId, 99),
            getRegistrationSmsBatches(organizationId, effectiveEventId, 99),
        ]);

        return NextResponse.json({
            organization: org,
            branding,
            events,
            effectiveEventId,
            templates,
            sent,
            registrationEmailBatches: registrationEmailBatches.map((b) => ({
                batchNumber: b.batchNumber,
                count: b.count,
                label: `Batch ${b.batchNumber} (${b.start}-${b.end})`,
            })),
            registrationSmsBatches: registrationSmsBatches.map((b) => ({
                batchNumber: b.batchNumber,
                count: b.count,
                label: `Batch ${b.batchNumber} (${b.start}-${b.end})`,
                phones: b.phones,
            })),
            members: members.map((m) => ({
                id: m.user.id,
                name: m.user.name,
                email: m.user.email,
                orgRole: m.role,
            })),
        });
    } catch (e) {
        console.error('GET org-emails', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
