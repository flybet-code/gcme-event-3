import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { canViewPlatformFeedbackResponses } from '@/lib/platform-app-role';
import { PLATFORM_EASE_LABELS, type PlatformEaseRating } from '@/lib/platform-feedback';

const VALID_EASE = new Set<PlatformEaseRating>(['EASY', 'MEDIUM', 'HARD']);

/** Any signed-in user may submit or update their own feedback. */
export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const easeRating = String(body.easeRating || '').toUpperCase() as PlatformEaseRating;
        const recommendScore = Number(body.recommendScore);
        const additionalText =
            body.additionalText === undefined || body.additionalText === null
                ? null
                : String(body.additionalText).trim() || null;

        if (!VALID_EASE.has(easeRating)) {
            return NextResponse.json(
                { error: 'easeRating must be Easy, Medium, or Hard' },
                { status: 400 }
            );
        }
        if (!Number.isInteger(recommendScore) || recommendScore < 1 || recommendScore > 10) {
            return NextResponse.json(
                { error: 'recommendScore must be an integer from 1 to 10' },
                { status: 400 }
            );
        }

        const campaignId = body.campaignId ? String(body.campaignId).trim() : null;
        let organizationId: string | null = null;
        let eventId: string | null = null;

        if (campaignId) {
            const campaign = await prisma.platformFeedbackCampaign.findUnique({
                where: { id: campaignId },
            });
            if (!campaign) {
                return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
            }
            organizationId = campaign.organizationId;
            eventId = campaign.eventId;
        }

        const feedback = await prisma.platformFeedback.upsert({
            where: { userId: session.user.id },
            create: {
                userId: session.user.id,
                campaignId,
                organizationId,
                eventId,
                easeRating,
                recommendScore,
                additionalText,
            },
            update: {
                campaignId: campaignId ?? undefined,
                organizationId,
                eventId,
                easeRating,
                recommendScore,
                additionalText,
            },
        });

        if (campaignId) {
            await prisma.platformFeedbackPromptDismissal.deleteMany({
                where: { userId: session.user.id, campaignId },
            });
        }

        return NextResponse.json({
            success: true,
            thankYou: true,
            message: 'Thank you for your feedback! Your responses help us improve the platform.',
            feedback: {
                ...feedback,
                easeLabel: PLATFORM_EASE_LABELS[easeRating],
            },
        });
    } catch (e) {
        console.error('POST platform-feedback', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/** Platform super admins only — all user feedback. */
export async function GET() {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const me = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { isPlatformSuperAdmin: true },
        });
        if (!canViewPlatformFeedbackResponses(me?.isPlatformSuperAdmin)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const rows = await prisma.platformFeedback.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: { select: { name: true } },
                    },
                },
                organization: { select: { name: true, slug: true } },
                event: { select: { name: true, slug: true } },
                campaign: { select: { title: true } },
            },
        });

        return NextResponse.json({
            data: rows.map((r) => ({
                id: r.id,
                userId: r.userId,
                userName: r.user.name,
                userEmail: r.user.email,
                appRole: r.user.role?.name ?? null,
                organizationName: r.organization?.name ?? null,
                eventName: r.event?.name ?? null,
                campaignTitle: r.campaign?.title ?? null,
                easeRating: r.easeRating,
                easeLabel: PLATFORM_EASE_LABELS[r.easeRating],
                recommendScore: r.recommendScore,
                additionalText: r.additionalText,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
            })),
        });
    } catch (e) {
        console.error('GET platform-feedback', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
