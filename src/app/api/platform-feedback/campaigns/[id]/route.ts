import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePlatformFeedbackViewer } from '@/lib/platform-feedback-admin';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
    const gate = await requirePlatformFeedbackViewer();
    if (!gate.ok) {
        return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    try {
        const { id } = await params;
        const existing = await prisma.platformFeedbackCampaign.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const body = await request.json();
        const data: Record<string, unknown> = {};

        if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
        if (body.autoShowOnLogin !== undefined) data.autoShowOnLogin = Boolean(body.autoShowOnLogin);
        if (body.requireEventEnded !== undefined) data.requireEventEnded = Boolean(body.requireEventEnded);
        if (body.title !== undefined) data.title = body.title ? String(body.title).trim() : null;
        if (body.visibleFrom !== undefined) {
            data.visibleFrom = body.visibleFrom ? new Date(body.visibleFrom) : null;
        }
        if (body.visibleUntil !== undefined) {
            data.visibleUntil = body.visibleUntil ? new Date(body.visibleUntil) : null;
        }
        if (body.eventId !== undefined) {
            const eventId = body.eventId ? String(body.eventId).trim() : null;
            if (eventId) {
                const event = await prisma.event.findFirst({
                    where: { id: eventId, organizationId: existing.organizationId },
                });
                if (!event) {
                    return NextResponse.json({ error: 'Event not found in organization' }, { status: 404 });
                }
            }
            data.eventId = eventId;
        }

        const updated = await prisma.platformFeedbackCampaign.update({
            where: { id },
            data,
            include: {
                organization: { select: { id: true, name: true, slug: true } },
                event: { select: { id: true, name: true, slug: true, endsAt: true, startsAt: true } },
            },
        });

        return NextResponse.json({ data: updated });
    } catch (e) {
        console.error('PATCH platform-feedback/campaigns/[id]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
    const gate = await requirePlatformFeedbackViewer();
    if (!gate.ok) {
        return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    try {
        const { id } = await params;
        await prisma.platformFeedbackCampaign.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('DELETE platform-feedback/campaigns/[id]', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
