import { prisma } from '@/lib/prisma';

export type FeedbackPromptResult = {
    shouldShow: boolean;
    campaignId?: string;
    title?: string;
    organizationName?: string;
    eventName?: string;
    reason?: string;
};

function isWithinSchedule(
    now: Date,
    visibleFrom: Date | null,
    visibleUntil: Date | null
): boolean {
    if (visibleFrom && now < visibleFrom) return false;
    if (visibleUntil && now > visibleUntil) return false;
    return true;
}

function eventEnded(event: { endsAt: Date | null }, now: Date): boolean {
    return Boolean(event.endsAt && now >= event.endsAt);
}

/**
 * Resolves whether the feedback modal should auto-open for a signed-in org member.
 */
export async function resolveFeedbackPromptForUser(userId: string): Promise<FeedbackPromptResult> {
    const existing = await prisma.platformFeedback.findUnique({
        where: { userId },
        select: { id: true },
    });
    if (existing) {
        return { shouldShow: false, reason: 'already_submitted' };
    }

    const pref = await prisma.userActiveOrganization.findUnique({
        where: { userId },
        include: { organization: { select: { id: true, name: true } } },
    });
    if (!pref?.organizationId) {
        return { shouldShow: false, reason: 'no_active_org' };
    }

    const now = new Date();
    const campaigns = await prisma.platformFeedbackCampaign.findMany({
        where: {
            organizationId: pref.organizationId,
            isActive: true,
            autoShowOnLogin: true,
        },
        include: {
            event: { select: { id: true, name: true, endsAt: true, startsAt: true } },
            organization: { select: { name: true } },
        },
        orderBy: [{ eventId: 'desc' }, { updatedAt: 'desc' }],
    });

    for (const campaign of campaigns) {
        if (!isWithinSchedule(now, campaign.visibleFrom, campaign.visibleUntil)) {
            continue;
        }

        if (campaign.eventId && campaign.event) {
            if (campaign.requireEventEnded && !eventEnded(campaign.event, now)) {
                continue;
            }
        }

        const dismissal = await prisma.platformFeedbackPromptDismissal.findUnique({
            where: {
                userId_campaignId: { userId, campaignId: campaign.id },
            },
        });
        if (dismissal?.dismissUntil && now < dismissal.dismissUntil) {
            continue;
        }

        return {
            shouldShow: true,
            campaignId: campaign.id,
            title: campaign.title ?? undefined,
            organizationName: campaign.organization.name,
            eventName: campaign.event?.name,
        };
    }

    return { shouldShow: false, reason: 'no_active_campaign' };
}
