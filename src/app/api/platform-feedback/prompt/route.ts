import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { resolveFeedbackPromptForUser } from '@/lib/platform-feedback-prompt';

export async function GET() {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const result = await resolveFeedbackPromptForUser(session.user.id);
        return NextResponse.json(result);
    } catch (e) {
        console.error('GET platform-feedback/prompt', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/** Snooze auto-popup for this campaign (e.g. "Remind me later"). */
export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const campaignId = String(body.campaignId || '').trim();
        if (!campaignId) {
            return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
        }

        const campaign = await prisma.platformFeedbackCampaign.findUnique({
            where: { id: campaignId },
        });
        if (!campaign?.isActive) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        const member = await prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId: campaign.organizationId,
                    userId: session.user.id,
                },
            },
        });
        const me = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { role: true },
        });
        const isSuper = Boolean(me?.isPlatformSuperAdmin);
        if (!member && !isSuper) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const days = Number(body.snoozeDays) || 1;
        const dismissUntil = new Date();
        dismissUntil.setDate(dismissUntil.getDate() + Math.min(Math.max(days, 1), 30));

        await prisma.platformFeedbackPromptDismissal.upsert({
            where: {
                userId_campaignId: {
                    userId: session.user.id,
                    campaignId,
                },
            },
            create: {
                userId: session.user.id,
                campaignId,
                dismissUntil,
            },
            update: { dismissUntil },
        });

        return NextResponse.json({ success: true, dismissUntil });
    } catch (e) {
        console.error('POST platform-feedback/prompt', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
