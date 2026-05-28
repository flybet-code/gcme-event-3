import { prisma } from './prisma';

export async function assignMembersToGroups(targetOrgId?: string) {
    // Fetch groups, optionally filtered by organization
    const groups = await (prisma as any).group.findMany({
        where: targetOrgId ? { organizationId: targetOrgId } : undefined
    });

    // Sort groups by specificity (more criteria first)
    const sortedGroups = [...groups].sort((a: any, b: any) => {
        const aCount = (a.roles?.length || 0) + (a.paymentStatuses?.length || 0) + (a.coupons?.length || 0) + (a.registrationIds?.length || 0);
        const bCount = (b.roles?.length || 0) + (b.paymentStatuses?.length || 0) + (b.coupons?.length || 0) + (b.registrationIds?.length || 0);
        return bCount - aCount;
    });

    const orgIds = targetOrgId 
        ? [targetOrgId] 
        : [...new Set(sortedGroups.map((g: any) => g.organizationId).filter(Boolean))] as string[];

    // Reset group assignments per organization (multi-tenant safe).
    if (orgIds.length > 0) {
        await prisma.$transaction(
            orgIds.flatMap((oid) => [
                (prisma as any).registration.updateMany({
                    where: {
                        organizationId: oid,
                        OR: [{ NOT: { groupId: null } }, { NOT: { deletedAt: null } }],
                    },
                    data: { groupId: null, vendorId: null },
                }),
                (prisma as any).attendee.updateMany({
                    where: {
                        registration: { organizationId: oid },
                        OR: [
                            { NOT: { groupId: null } },
                            { registration: { NOT: { deletedAt: null } } },
                        ],
                    },
                    data: { groupId: null, vendorId: null },
                }),
            ])
        );
    }

    // Fetch all vendors with their current counts to track capacity.
    const vendors = await (prisma as any).vendor.findMany({
        where: orgIds.length ? { organizationId: { in: orgIds } } : undefined,
        include: {
            _count: {
                select: { registrations: true, attendees: true }
            }
        }
    });

    // Create a map for quick vendor capacity lookup and tracking
    const vendorCapacityMap = new Map<string, { capacity: number, used: number }>();
    vendors.forEach((v: any) => {
        vendorCapacityMap.set(v.id, {
            capacity: v.capacity,
            used: (v._count.registrations || 0) + (v._count.attendees || 0)
        });
    });

    // Process each group from most specific to least specific
    for (const group of sortedGroups) {
        let availableSlots = Infinity;
        let vendorInfo = null;

        // Check vendor capacity
        if (group.vendorId) {
            vendorInfo = vendorCapacityMap.get(group.vendorId);
            if (vendorInfo) {
                availableSlots = vendorInfo.capacity - vendorInfo.used;
                if (availableSlots <= 0) {
                    continue; // Skip this group if vendor is full (try next specific group)
                }
            }
        }

        // --- 1. PROCESS REGISTRATIONS ---
        const regWhere: any = {
            groupId: null,
            deletedAt: null,
            isGroup: false
        };

        // CRITICAL: If group has an org, only assign registrations from that org.
        // If it's a global group (legacy), and we have a targetOrgId, only use that.
        if (group.organizationId) {
            regWhere.organizationId = group.organizationId;
        } else if (targetOrgId) {
            regWhere.organizationId = targetOrgId;
        }

        if (group.roles && group.roles.length > 0) {
            regWhere.serviceRole = { in: group.roles };
        }
        if (group.paymentStatuses && group.paymentStatuses.length > 0) {
            regWhere.paymentStatus = { in: group.paymentStatuses };
        }
        if (group.coupons && group.coupons.length > 0) {
            regWhere.couponCode = { in: group.coupons.map((c: string) => c.toUpperCase().trim()) };
        }
        if (group.registrationIds && group.registrationIds.length > 0) {
            regWhere.id = { in: group.registrationIds.map((id: any) => parseInt(id)) };
        }

        const updateData: any = { groupId: group.id };
        if (group.vendorId) {
            updateData.vendorId = group.vendorId;
        }

        let regsToUpdate: any[] = [];
        if (group.vendorId && availableSlots !== Infinity) {
            regsToUpdate = await (prisma as any).registration.findMany({
                where: regWhere,
                take: availableSlots,
                select: { id: true }
            });
        } else {
            regsToUpdate = await (prisma as any).registration.findMany({
                where: regWhere,
                select: { id: true }
            });
        }

        if (regsToUpdate.length > 0) {
            await (prisma as any).registration.updateMany({
                where: { id: { in: regsToUpdate.map(r => r.id) } },
                data: updateData
            });

            if (vendorInfo) {
                vendorInfo.used += regsToUpdate.length;
                availableSlots -= regsToUpdate.length;
                vendorCapacityMap.set(group.vendorId, vendorInfo);
            }
        }

        // --- 2. PROCESS ATTENDEES ---
        if (group.vendorId && availableSlots <= 0) {
            continue;
        }

        const attWhere: any = {
            groupId: null,
            registration: {
                deletedAt: null
            }
        };

        if (group.organizationId) {
            attWhere.registration.organizationId = group.organizationId;
        } else if (targetOrgId) {
            attWhere.registration.organizationId = targetOrgId;
        }

        if (group.roles && group.roles.length > 0) {
            attWhere.role = { in: group.roles };
        }
        if (group.paymentStatuses && group.paymentStatuses.length > 0) {
            attWhere.registration.paymentStatus = { in: group.paymentStatuses };
        }
        if (group.coupons && group.coupons.length > 0) {
            attWhere.registration.couponCode = { in: group.coupons.map((c: string) => c.toUpperCase().trim()) };
        }
        if (group.registrationIds && group.registrationIds.length > 0) {
            attWhere.registrationId = { in: group.registrationIds.map((id: any) => parseInt(id)) };
        }

        let attsToUpdate: any[] = [];
        if (group.vendorId && availableSlots !== Infinity) {
            attsToUpdate = await (prisma as any).attendee.findMany({
                where: attWhere,
                take: availableSlots,
                select: { id: true }
            });
        } else {
            attsToUpdate = await (prisma as any).attendee.findMany({
                where: attWhere,
                select: { id: true }
            });
        }

        if (attsToUpdate.length > 0) {
            await (prisma as any).attendee.updateMany({
                where: { id: { in: attsToUpdate.map(a => a.id) } },
                data: updateData
            });

            if (vendorInfo) {
                vendorInfo.used += attsToUpdate.length;
                vendorCapacityMap.set(group.vendorId, vendorInfo);
            }
        }
    }
}

