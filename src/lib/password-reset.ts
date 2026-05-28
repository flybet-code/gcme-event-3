import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getPasswordResetRedirectUrl } from '@/lib/app-url';
import { getDefaultOrganizationId } from '@/lib/tenancy/active-org-server';

export type PasswordResetEmailContext = {
    organizationId: string;
    organizationName: string;
    eventId: string | null;
};

/** Short-lived org/event context when an admin triggers reset (consumed when the email is sent). */
const pendingContextByEmail = new Map<
    string,
    { organizationId: string; eventId: string | null; expiresAt: number }
>();

const PENDING_TTL_MS = 10 * 60 * 1000;

export function setPasswordResetEmailContext(
    email: string,
    organizationId: string,
    eventId?: string | null
): void {
    pendingContextByEmail.set(email.trim().toLowerCase(), {
        organizationId,
        eventId: eventId ?? null,
        expiresAt: Date.now() + PENDING_TTL_MS,
    });
}

export function consumePasswordResetEmailContext(email: string): {
    organizationId: string;
    eventId: string | null;
} | null {
    const key = email.trim().toLowerCase();
    const entry = pendingContextByEmail.get(key);
    if (!entry) return null;
    pendingContextByEmail.delete(key);
    if (entry.expiresAt < Date.now()) return null;
    return { organizationId: entry.organizationId, eventId: entry.eventId };
}

async function resolvePrimaryEventId(organizationId: string): Promise<string | null> {
    const defaultSlug =
        process.env.DEFAULT_EVENT_SLUG || process.env.NEXT_PUBLIC_DEFAULT_EVENT_SLUG || null;
    if (defaultSlug) {
        const bySlug = await prisma.event.findFirst({
            where: { organizationId, slug: defaultSlug },
            select: { id: true },
        });
        if (bySlug) return bySlug.id;
    }

    const latest = await prisma.event.findFirst({
        where: { organizationId },
        orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
        select: { id: true },
    });
    return latest?.id ?? null;
}

/** Resolve org + event for password-reset email branding. */
export async function resolvePasswordResetEmailContext(
    userId: string,
    preferredOrganizationId?: string | null
): Promise<PasswordResetEmailContext> {
    let organizationId = preferredOrganizationId?.trim() || null;

    if (!organizationId) {
        const pref = await prisma.userActiveOrganization.findUnique({
            where: { userId },
            select: { organizationId: true },
        });
        organizationId = pref?.organizationId ?? null;
    }

    if (!organizationId) {
        const member = await prisma.organizationMember.findFirst({
            where: { userId },
            orderBy: { createdAt: 'asc' },
            select: { organizationId: true },
        });
        organizationId = member?.organizationId ?? null;
    }

    if (!organizationId) {
        organizationId = await getDefaultOrganizationId();
    }

    if (!organizationId) {
        return {
            organizationId: '',
            organizationName: process.env.EVENT_NAME || 'Event Management',
            eventId: null,
        };
    }

    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, slug: true },
    });

    const eventId = await resolvePrimaryEventId(organizationId);

    return {
        organizationId,
        organizationName: org?.name?.trim() || 'Your organization',
        eventId,
    };
}

export type RequestPasswordResetOptions = {
    organizationId?: string | null;
    eventId?: string | null;
};

/** Triggers better-auth password reset email for the given address. */
export async function requestPasswordResetForEmail(
    email: string,
    options?: RequestPasswordResetOptions
): Promise<void> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
        throw new Error('Email is required');
    }

    if (options?.organizationId) {
        setPasswordResetEmailContext(normalized, options.organizationId, options.eventId);
    }

    await auth.api.requestPasswordReset({
        body: {
            email: normalized,
            redirectTo: getPasswordResetRedirectUrl(),
        },
    });
}
