import { prisma } from './prisma';

/**
 * Assigns sequential ticket numbers to a registration and its attendees.
 * Only if the registration is paid (PAY_SUCCESS).
 */
export async function assignTicketNumbers(registrationId: number) {
    return await prisma.$transaction(async (tx) => {
        // 1. Fetch the registration with attendees and all batches
        const [reg, batches] = await Promise.all([
            tx.registration.findUnique({
                where: { id: registrationId },
                include: {
                    attendees: {
                        orderBy: { id: 'asc' }
                    }
                }
            }),
            // @ts-ignore
            tx.batch.findMany()
        ]);

        if (!reg || reg.paymentStatus !== 'PAY_SUCCESS') {
            return null;
        }

        // 2. Helper to find prefix for a role/registration
        const getBatchInfo = (role: string, registration: any) => {
            // Sort batches: batches with any specific criteria should be checked first
            // We can sort them so that batches with more specific filters (role, status, coupon, ids) come first.
            const sortedBatches = [...batches].sort((a, b) => {
                const aCount = (a.roles?.length || 0) + (a.paymentStatuses?.length || 0) + (a.coupons?.length || 0) + (a.registrationIds?.length || 0);
                const bCount = (b.roles?.length || 0) + (b.paymentStatuses?.length || 0) + (b.coupons?.length || 0) + (b.registrationIds?.length || 0);
                return bCount - aCount; // More criteria first
            });

            const match = sortedBatches.find(b => {
                const roleMatch = b.roles.length === 0 || b.roles.includes(role);
                const statusMatch = b.paymentStatuses.length === 0 || b.paymentStatuses.includes(registration.paymentStatus);
                const couponMatch = b.coupons.length === 0 || (registration.couponCode && b.coupons.includes(registration.couponCode.toUpperCase().trim()));
                const idMatch = b.registrationIds.length === 0 || b.registrationIds.includes(registration.id);

                return roleMatch && statusMatch && couponMatch && idMatch;
            });

            return match || { prefix: 0, name: 'Default' };
        };

        // 3. Assign numbers
        if (reg.isGroup) {
            for (const attendee of reg.attendees) {
                // Skip if already has a ticket number
                if (attendee.ticketNumber) continue;

                const { prefix } = getBatchInfo(attendee.role, reg);
                const nextNumber = await getNextTicketInBatch(tx, prefix);

                await tx.attendee.update({
                    where: { id: attendee.id },
                    data: { ticketNumber: nextNumber }
                });
            }
        } else {
            // Individual registration
            if (!reg.ticketNumber) {
                const { prefix } = getBatchInfo(reg.serviceRole, reg);
                const nextNumber = await getNextTicketInBatch(tx, prefix);

                await tx.registration.update({
                    where: { id: reg.id },
                    data: { ticketNumber: nextNumber }
                });
            }
        }

        return await tx.registration.findUnique({
            where: { id: registrationId },
            include: { attendees: true }
        });
    });
}

/**
 * Finds the next available ticket number in a specific batch range.
 */
async function getNextTicketInBatch(tx: any, prefix: number) {
    const rangeMin = prefix;
    const rangeMax = prefix + 9999;

    const [maxReg, maxAtt] = await Promise.all([
        tx.registration.aggregate({
            where: { ticketNumber: { gte: rangeMin, lte: rangeMax } },
            _max: { ticketNumber: true }
        }),
        tx.attendee.aggregate({
            where: { ticketNumber: { gte: rangeMin, lte: rangeMax } },
            _max: { ticketNumber: true }
        })
    ]);

    const currentMax = Math.max(
        maxReg._max.ticketNumber || rangeMin,
        maxAtt._max.ticketNumber || rangeMin
    );

    return currentMax + 1;
}

/**
 * Backfills ticket numbers for all existing PAY_SUCCESS registrations.
 */
export async function backfillTicketNumbers() {
    const paidRegistrations = await prisma.registration.findMany({
        where: {
            paymentStatus: 'PAY_SUCCESS',
            ticketNumber: null,
            attendees: {
                none: { ticketNumber: { not: null } }
            }
        },
        orderBy: { updatedAt: 'asc' }, // Assign in order of payment completion
        include: { attendees: true }
    });

    console.log(`Backfilling ticket numbers for ${paidRegistrations.length} registrations...`);

    for (const reg of paidRegistrations) {
        await assignTicketNumbers(reg.id);
    }
}
