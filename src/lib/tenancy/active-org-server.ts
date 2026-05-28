import { prisma } from '@/lib/prisma';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';
import { OrgRole } from '@prisma/client';

type SessionLike = { user?: { id: string } } | null;

export type ActiveOrgResult =
    | { ok: true; organizationId: string; isPlatformSuperAdmin: boolean; orgRole?: OrgRole; orgPermissions: string[] }
    | { ok: false; status: 401 | 403; message: string };

/**
 * Resolves the active organization for API routes from UserActiveOrganization.
 * Non–platform users must be members of that org (OrganizationMember).
 */
export async function resolveActiveOrganization(
    session: SessionLike
): Promise<ActiveOrgResult> {
    if (!session?.user?.id) {
        return { ok: false, status: 401, message: 'Unauthorized' };
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { role: true },
    });

    const pref = await prisma.userActiveOrganization.findUnique({
        where: { userId: session.user.id },
        include: { organization: true },
    });

    const isPlatformSuperAdmin = hasPlatformElevatedAccess(user?.isPlatformSuperAdmin, user?.role?.name);

    if (!pref?.organizationId) {
        if (isPlatformSuperAdmin) {
            const fallbackId = await getDefaultOrganizationId();
            if (fallbackId) {
                return {
                    ok: true,
                    organizationId: fallbackId,
                    isPlatformSuperAdmin,
                    orgRole: 'ADMIN', // Fallback for platform super admins
                    orgPermissions: [],
                };
            }
        }
        return { ok: false, status: 403, message: 'No active organization. Open Settings or use the org switcher.' };
    }

    const member = await prisma.organizationMember.findUnique({
        where: {
            organizationId_userId: {
                organizationId: pref.organizationId,
                userId: session.user.id,
            },
        },
    });

    if (!isPlatformSuperAdmin && !member) {
        return { ok: false, status: 403, message: 'You are not a member of this organization' };
    }

    return {
        ok: true,
        organizationId: pref.organizationId,
        isPlatformSuperAdmin,
        orgRole: member?.role,
        orgPermissions: member?.permissions || [],
    };
}

const REGISTRATION_ORG_ACTIONS = {
    edit: 'edit_registrations',
    delete: 'delete_registrations',
    view: 'view_registrations',
} as const;

/**
 * Whether the user may edit or soft-delete registrations scoped to `organizationId`.
 * Allows platform elevation, matching app-role permissions, or org OWNER/ADMIN / org-scoped permission strings.
 */
export async function canModifyRegistrationInOrg(
    userId: string,
    organizationId: string,
    action: keyof typeof REGISTRATION_ORG_ACTIONS
): Promise<boolean> {
    const perm = REGISTRATION_ORG_ACTIONS[action];
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            role: {
                include: { permissions: true },
            },
        },
    });
    if (!user) return false;
    if (hasPlatformElevatedAccess(user.isPlatformSuperAdmin, user.role?.name)) {
        return true;
    }
    const appPerms = user.role?.permissions.map((p) => p.name) ?? [];
    if (appPerms.includes(perm)) return true;

    const m = await prisma.organizationMember.findUnique({
        where: {
            organizationId_userId: { organizationId, userId },
        },
    });
    if (!m) return false;
    if (m.role === 'OWNER' || m.role === 'ADMIN') return true;
    return m.permissions.includes(perm);
}

/** View participant lists / badges (same org rules as edit, but `view_registrations`). */
export async function canViewRegistrationsInOrg(
    userId: string,
    organizationId: string
): Promise<boolean> {
    return canModifyRegistrationInOrg(userId, organizationId, 'view');
}

/**
 * Download or print badges: anyone who may view or edit registrations in the org.
 */
export async function canAccessBadgesInOrg(
    userId: string,
    organizationId: string
): Promise<boolean> {
    const canView = await canViewRegistrationsInOrg(userId, organizationId);
    if (canView) return true;
    return canModifyRegistrationInOrg(userId, organizationId, 'edit');
}

/** Whether the user may manage org membership (invite/remove) for this org */
export async function canManageOrgMembers(
    userId: string,
    organizationId: string
): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
    });
    if (hasPlatformElevatedAccess(user?.isPlatformSuperAdmin, user?.role?.name)) {
        return true;
    }

    const m = await prisma.organizationMember.findUnique({
        where: {
            organizationId_userId: { organizationId, userId },
        },
    });
    if (!m) return false;
    if (m.role === 'OWNER' || m.role === 'ADMIN') return true;
    return m.permissions.includes('manage_users');
}

/** Default org for unauthenticated legacy public routes (search/check-in) */
export async function getDefaultOrganizationId(): Promise<string | null> {
    const slug = process.env.DEFAULT_ORG_SLUG || 'gcme';
    const org = await prisma.organization.findUnique({ where: { slug } });
    return org?.id ?? null;
}
