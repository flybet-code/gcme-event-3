import { prisma } from '@/lib/prisma';
import { getDefaultRegistrationFormIdFromSettings } from '@/lib/org-settings';
import { formatSummitPersonName } from '@/lib/summit-registration-config';
import { getResolvedBadgeTemplateSrcForOrg } from '@/lib/badge-template-server';

export type ResolvedBadgeForImage = {
    badgeId: string;
    fullName: string;
    ticketNumber: number | null;
    templateSrc: string;
};

async function resolveShowTitleField(organizationId: string): Promise<boolean> {
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { settings: true },
    });
    const defaultFormId = getDefaultRegistrationFormIdFromSettings(org?.settings);
    if (!defaultFormId) return true;

    const metaForm = await prisma.form.findFirst({
        where: { id: defaultFormId, organizationId },
        select: { i18nMeta: true },
    });
    const rs = (metaForm?.i18nMeta as { registrationSettings?: { showTitleField?: boolean } } | null)
        ?.registrationSettings;
    return rs?.showTitleField !== false;
}

/**
 * Resolve badge display data from a dashboard badge id (CLS-123 or CLS-123-1).
 */
export async function resolveBadgeForImage(
    badgeId: string,
    organizationId: string
): Promise<ResolvedBadgeForImage | null> {
    const parts = badgeId.split('-');
    if (parts.length < 2 || parts[0] !== 'CLS') return null;

    const regId = parseInt(parts[1], 10);
    if (!Number.isFinite(regId)) return null;

    const reg = await prisma.registration.findFirst({
        where: { id: regId, organizationId },
        include: {
            attendees: { orderBy: { id: 'asc' } },
        },
    });
    if (!reg) return null;

    const showTitle = await resolveShowTitleField(organizationId);
    const templateSrc = await getResolvedBadgeTemplateSrcForOrg(organizationId);

    if (parts.length === 2) {
        return {
            badgeId,
            fullName: formatSummitPersonName(reg.fullName, reg.title ?? undefined, showTitle),
            ticketNumber: reg.ticketNumber,
            templateSrc,
        };
    }

    if (parts.length >= 3) {
        const attendeeId = parseInt(parts[2], 10);
        const att = reg.attendees.find((a) => a.id === attendeeId);
        if (!att) return null;
        return {
            badgeId,
            fullName: formatSummitPersonName(att.fullName, att.title ?? undefined, showTitle),
            ticketNumber: att.ticketNumber,
            templateSrc,
        };
    }

    return null;
}
