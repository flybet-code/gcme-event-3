import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { resolveActiveOrganization, canManageOrgMembers } from '@/lib/tenancy/active-org-server';
import { headers } from 'next/headers';

export type OrgEmailSession = {
    userId: string;
    organizationId: string;
};

export async function requireOrgEmailAccess(): Promise<
    | { ok: true; session: OrgEmailSession }
    | { ok: false; status: number; message: string }
> {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
        return { ok: false, status: 401, message: 'Unauthorized' };
    }

    const orgRes = await resolveActiveOrganization(session);
    if (!orgRes.ok) {
        return { ok: false, status: orgRes.status, message: orgRes.message };
    }

    // Strict membership guard: only users actually invited/joined in this org may use Email/SMS tools.
    // This prevents platform fallback org visibility in event dropdowns.
    const membership = await prisma.organizationMember.findUnique({
        where: {
            organizationId_userId: {
                organizationId: orgRes.organizationId,
                userId: session.user.id,
            },
        },
    });
    if (!membership) {
        return {
            ok: false,
            status: 403,
            message: 'Switch to an organization you are invited to before sending email or SMS',
        };
    }

    const allowed = await canManageOrgMembers(session.user.id, orgRes.organizationId);
    if (!allowed) {
        return {
            ok: false,
            status: 403,
            message: 'You do not have permission to send team emails',
        };
    }

    return {
        ok: true,
        session: {
            userId: session.user.id,
            organizationId: orgRes.organizationId,
        },
    };
}

export async function resolveRecipientEmails(
    organizationId: string,
    userIds: string[],
    extraToRaw: string
): Promise<string[]> {
    const { parseEmailList } = await import('@/lib/org-bulk-email');
    const fromManual = parseEmailList(extraToRaw);
    const seen = new Set<string>(fromManual);

    if (userIds.length > 0) {
        const members = await prisma.organizationMember.findMany({
            where: {
                organizationId,
                userId: { in: userIds },
            },
            include: { user: { select: { email: true } } },
        });
        for (const m of members) {
            const e = m.user.email?.trim().toLowerCase();
            if (e && e.includes('@') && !seen.has(e)) {
                seen.add(e);
                fromManual.push(e);
            }
        }
    }

    return fromManual;
}

export type EmailBatch = {
    batchNumber: number;
    start: number;
    end: number;
    count: number;
    emails: string[];
};

export type SmsBatch = {
    batchNumber: number;
    start: number;
    end: number;
    count: number;
    phones: string[];
};

/** Build recipient batches from registration emails (99 per batch by default). */
export async function getRegistrationEmailBatches(
    organizationId: string,
    eventId: string | null,
    batchSize = 99
): Promise<EmailBatch[]> {
    const registrations = await prisma.registration.findMany({
        where: {
            organizationId,
            ...(eventId ? { eventId } : {}),
            deletedAt: null,
            email: { not: null },
        },
        select: { email: true },
        orderBy: { id: 'asc' },
    });

    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const row of registrations) {
        const email = row.email?.trim().toLowerCase();
        if (!email || !email.includes('@') || seen.has(email)) continue;
        seen.add(email);
        deduped.push(email);
    }

    const batches: EmailBatch[] = [];
    for (let i = 0; i < deduped.length; i += batchSize) {
        const slice = deduped.slice(i, i + batchSize);
        batches.push({
            batchNumber: Math.floor(i / batchSize) + 1,
            start: i + 1,
            end: i + slice.length,
            count: slice.length,
            emails: slice,
        });
    }
    return batches;
}

/** Build SMS recipient batches from registration + attendee phone numbers (99 per batch). */
export async function getRegistrationSmsBatches(
    organizationId: string,
    eventId: string | null,
    batchSize = 99
): Promise<SmsBatch[]> {
    const registrations = await prisma.registration.findMany({
        where: {
            organizationId,
            ...(eventId ? { eventId } : {}),
            deletedAt: null,
        },
        select: {
            phoneNumber: true,
            attendees: {
                select: { phoneNumber: true },
            },
        },
        orderBy: { id: 'asc' },
    });

    const deduped: string[] = [];
    const seen = new Set<string>();
    const normalize = (raw: string) => raw.trim().replace(/\s+/g, '');

    for (const reg of registrations) {
        const phones = [reg.phoneNumber, ...reg.attendees.map((a) => a.phoneNumber || '')];
        for (const p of phones) {
            if (!p) continue;
            const phone = normalize(p);
            if (phone.length < 6 || seen.has(phone)) continue;
            seen.add(phone);
            deduped.push(phone);
        }
    }

    const batches: SmsBatch[] = [];
    for (let i = 0; i < deduped.length; i += batchSize) {
        const slice = deduped.slice(i, i + batchSize);
        batches.push({
            batchNumber: Math.floor(i / batchSize) + 1,
            start: i + 1,
            end: i + slice.length,
            count: slice.length,
            phones: slice,
        });
    }
    return batches;
}
