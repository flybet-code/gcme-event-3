/** Prisma where helpers for tenant isolation */

export function whereOrg(organizationId: string) {
    return { organizationId };
}

export function whereOrgAndEvent(organizationId: string, eventId: string) {
    return { organizationId, eventId };
}
