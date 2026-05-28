import { prisma } from '@/lib/prisma';
import type { OrgRole } from '@prisma/client';
import { ALL_ORG_PERMISSIONS } from '@/lib/org-permissions';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';

export type OrgContext = {
    organizationId: string;
    slug: string;
    role: OrgRole;
    permissions: string[];
};

async function hasPlatformAdminAccess(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
    });
    return hasPlatformElevatedAccess(user?.isPlatformSuperAdmin, user?.role?.name);
}

/**
 * Resolve organization by slug and verify user membership.
 */
export async function requireOrgMember(userId: string, orgSlug: string): Promise<OrgContext | null> {
    const org = await prisma.organization.findUnique({
        where: { slug: orgSlug },
    });
    if (!org) return null;

    if (await hasPlatformAdminAccess(userId)) {
        return {
            organizationId: org.id,
            slug: org.slug,
            role: 'OWNER',
            permissions: ALL_ORG_PERMISSIONS,
        };
    }

    const member = await prisma.organizationMember.findUnique({
        where: {
            organizationId_userId: {
                organizationId: org.id,
                userId,
            },
        },
    });
    if (!member) return null;

    const permissions =
        member.permissions.length > 0
            ? member.permissions
            : member.role === 'OWNER' || member.role === 'ADMIN'
              ? ALL_ORG_PERMISSIONS
              : [];

    return {
        organizationId: org.id,
        slug: org.slug,
        role: member.role,
        permissions,
    };
}

export async function requireOrgById(userId: string, organizationId: string): Promise<OrgContext | null> {
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
    });
    if (!org) return null;

    if (await hasPlatformAdminAccess(userId)) {
        return {
            organizationId: org.id,
            slug: org.slug,
            role: 'OWNER',
            permissions: ALL_ORG_PERMISSIONS,
        };
    }

    const member = await prisma.organizationMember.findUnique({
        where: {
            organizationId_userId: {
                organizationId: org.id,
                userId,
            },
        },
    });
    if (!member) return null;

    const permissions =
        member.permissions.length > 0
            ? member.permissions
            : member.role === 'OWNER' || member.role === 'ADMIN'
              ? ALL_ORG_PERMISSIONS
              : [];

    return {
        organizationId: org.id,
        slug: org.slug,
        role: member.role,
        permissions,
    };
}

export function hasOrgPermission(ctx: OrgContext, permission: string): boolean {
    if (ctx.role === 'OWNER' || ctx.role === 'ADMIN') {
        return true;
    }
    return ctx.permissions.includes(permission);
}
