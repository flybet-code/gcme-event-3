import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePlatformFeedbackViewer } from '@/lib/platform-feedback-admin';

function serializeCampaign(c: {
    id: string;
    organizationId: string;
    eventId: string | null;
    isActive: boolean;
    autoShowOnLogin: boolean;
    requireEventEnded: boolean;
    visibleFrom: Date | null;
    visibleUntil: Date | null;
    title: string | null;
    createdAt: Date;
    updatedAt: Date;
    organization: { id: string; name: string; slug: string };
    event: { id: string; name: string; slug: string; endsAt: Date | null; startsAt: Date | null } | null;
}) {
    const now = new Date();
    let statusLabel = 'Scheduled';
    if (!c.isActive) {
        statusLabel = 'Inactive';
    } else if (c.visibleFrom && now < c.visibleFrom) {
        statusLabel = 'Scheduled';
    } else if (c.visibleUntil && now > c.visibleUntil) {
        statusLabel = 'Ended';
    } else if (c.event && c.requireEventEnded) {
        statusLabel =
            c.event.endsAt && now >= c.event.endsAt ? 'Live (event ended)' : 'Waiting for event to end';
    } else {
        statusLabel = 'Live';
    }

    return {
        id: c.id,
        organizationId: c.organizationId,
        organizationName: c.organization.name,
        organizationSlug: c.organization.slug,
        eventId: c.eventId,
        eventName: c.event?.name ?? null,
        eventSlug: c.event?.slug ?? null,
        eventEndsAt: c.event?.endsAt ?? null,
        eventStartsAt: c.event?.startsAt ?? null,
        isActive: c.isActive,
        autoShowOnLogin: c.autoShowOnLogin,
        requireEventEnded: c.requireEventEnded,
        visibleFrom: c.visibleFrom,
        visibleUntil: c.visibleUntil,
        title: c.title,
        statusLabel,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
    };
}

export async function GET() {
    const gate = await requirePlatformFeedbackViewer();
    if (!gate.ok) {
        return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    try {
        const campaigns = await prisma.platformFeedbackCampaign.findMany({
            orderBy: { updatedAt: 'desc' },
            include: {
                organization: { select: { id: true, name: true, slug: true } },
                event: { select: { id: true, name: true, slug: true, endsAt: true, startsAt: true } },
            },
        });
        return NextResponse.json({
            data: campaigns.map(serializeCampaign),
        });
    } catch (e) {
        console.error('GET platform-feedback/campaigns', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const gate = await requirePlatformFeedbackViewer();
    if (!gate.ok) {
        return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    try {
        const body = await request.json();
        const organizationId = String(body.organizationId || '').trim();
        const eventId = body.eventId ? String(body.eventId).trim() : null;

        if (!organizationId) {
            return NextResponse.json({ error: 'organizationId required' }, { status: 400 });
        }

        const org = await prisma.organization.findUnique({ where: { id: organizationId } });
        if (!org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        if (eventId) {
            const event = await prisma.event.findFirst({
                where: { id: eventId, organizationId },
            });
            if (!event) {
                return NextResponse.json({ error: 'Event not found in organization' }, { status: 404 });
            }
        }

        const visibleFrom = body.visibleFrom ? new Date(body.visibleFrom) : null;
        const visibleUntil = body.visibleUntil ? new Date(body.visibleUntil) : null;

        const campaign = await prisma.platformFeedbackCampaign.create({
            data: {
                organizationId,
                eventId,
                isActive: Boolean(body.isActive),
                autoShowOnLogin: body.autoShowOnLogin !== false,
                requireEventEnded: body.requireEventEnded !== false,
                visibleFrom,
                visibleUntil,
                title: body.title ? String(body.title).trim() : null,
                createdByUserId: gate.userId,
            },
            include: {
                organization: { select: { id: true, name: true, slug: true } },
                event: { select: { id: true, name: true, slug: true, endsAt: true, startsAt: true } },
            },
        });

        return NextResponse.json({ data: serializeCampaign(campaign) });
    } catch (e) {
        console.error('POST platform-feedback/campaigns', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
