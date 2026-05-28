import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { resolveActiveOrganization } from '@/lib/tenancy/active-org-server';

export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers
        });

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const orgRes = await resolveActiveOrganization(session);
        if (!orgRes.ok) {
            return NextResponse.json({ error: orgRes.message }, { status: orgRes.status });
        }
        const orgId = orgRes.organizationId;

        const body = await request.json();
        const { badgeIds, status } = body;
        const isPrinted = status !== undefined ? !!status : true;

        if (!badgeIds || !Array.isArray(badgeIds)) {
            return NextResponse.json({ error: 'badgeIds array is required' }, { status: 400 });
        }

        const now = isPrinted ? new Date() : null;

        for (const fullId of badgeIds) {
            // IDs are in format CLS-123 or CLS-123-1
            const parts = fullId.split('-');
            const regId = parseInt(parts[1]);

            if (parts.length === 2) {
                // Individual registration
                await prisma.registration.update({
                    where: { id: regId, organizationId: orgId },
                    data: {
                        // @ts-ignore
                        isBadgePrinted: isPrinted,
                        // @ts-ignore
                        badgePrintedAt: now
                    }
                });
            } else if (parts.length === 3) {
                // Group attendee
                const attendeeIndex = parseInt(parts[2]) - 1;

                const reg = await prisma.registration.findFirst({
                    where: { id: regId, organizationId: orgId },
                });
                if (!reg) continue;

                const attendees = await prisma.attendee.findMany({
                    where: { registrationId: regId },
                    orderBy: { id: 'asc' }
                });

                if (attendees[attendeeIndex]) {
                    await prisma.attendee.update({
                        where: { id: attendees[attendeeIndex].id },
                        data: {
                            // @ts-ignore
                            isBadgePrinted: isPrinted,
                            // @ts-ignore
                            badgePrintedAt: now
                        }
                    });
                }

                // If unprinting, we should check if other attendees are still printed before unmarking parent?
                // For simplicity, if we mark an attendee as printed, the parent is printed.
                // If we unmark an attendee, we'll only unmark the parent if ALL attendees are unprinted.
                if (!isPrinted) {
                    const otherPrinted = await prisma.attendee.count({
                        where: {
                            registrationId: regId,
                            // @ts-ignore
                            isBadgePrinted: true
                        }
                    });

                    if (otherPrinted === 0) {
                        await prisma.registration.update({
                            where: { id: regId, organizationId: orgId },
                            data: {
                                // @ts-ignore
                                isBadgePrinted: false,
                                // @ts-ignore
                                badgePrintedAt: null
                            }
                        });
                    }
                } else {
                    await prisma.registration.update({
                        where: { id: regId, organizationId: orgId },
                        data: {
                            // @ts-ignore
                            isBadgePrinted: true,
                            // @ts-ignore
                            badgePrintedAt: now
                        }
                    });
                }
            }
        }

        return NextResponse.json({ message: `Badges ${isPrinted ? 'marked as printed' : 'unmarked'} successfully` }, { status: 200 });
    } catch (error) {
        console.error('Error marking badges as printed:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
