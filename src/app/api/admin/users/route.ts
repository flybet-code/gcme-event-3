import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { resolveActiveOrganization, canManageOrgMembers } from '@/lib/tenancy/active-org-server';
import { hasStrictPlatformSuperAdminAccess } from '@/lib/platform-app-role';

/** Strict super-admin only (DB flag or app role "Super Admin"). */
async function canManageAppRoles(userId: string): Promise<boolean> {
    const me = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
    });
    return hasStrictPlatformSuperAdminAccess(me?.isPlatformSuperAdmin, me?.role?.name);
}

/**
 * Lists users who are members of the **active** organization only (same data as org switcher context).
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const orgRes = await resolveActiveOrganization(session);
        if (!orgRes.ok) {
            return NextResponse.json({ error: orgRes.message }, { status: orgRes.status });
        }

        const members = await prisma.organizationMember.findMany({
            where: { organizationId: orgRes.organizationId },
            include: {
                user: {
                    include: {
                        role: {
                            include: {
                                permissions: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const data = members.map((m) => ({
            id: m.user.id,
            name: m.user.name,
            email: m.user.email,
            createdAt: m.user.createdAt,
            role: m.user.role,
            orgRole: m.role,
            memberSince: m.createdAt,
        }));

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Fetch users error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * Removes a user from the **active** organization (does not delete their account).
 * Full account deletion remains a separate platform-level concern.
 */
export async function DELETE(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const orgRes = await resolveActiveOrganization(session);
        if (!orgRes.ok) {
            return NextResponse.json({ error: orgRes.message }, { status: orgRes.status });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('id');

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        if (userId === session.user.id) {
            return NextResponse.json({ error: 'You cannot remove yourself from the organization' }, { status: 400 });
        }

        const allowed = await canManageOrgMembers(session.user.id, orgRes.organizationId);
        if (!allowed) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const membership = await prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId: orgRes.organizationId,
                    userId,
                },
            },
        });

        if (!membership) {
            return NextResponse.json({ error: 'User is not a member of this organization' }, { status: 404 });
        }

        await prisma.organizationMember.delete({
            where: {
                organizationId_userId: {
                    organizationId: orgRes.organizationId,
                    userId,
                },
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete user error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * Updates a member's role in the active organization.
 */
export async function PATCH(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const orgRes = await resolveActiveOrganization(session);
        if (!orgRes.ok) {
            return NextResponse.json({ error: orgRes.message }, { status: orgRes.status });
        }

        const body = await request.json();
        const userId = String(body.userId || '').trim();
        const hasOrgRoleInput = body.orgRole !== undefined && body.orgRole !== null;
        const hasAppRoleInput = body.appRoleId !== undefined;
        const orgRole = hasOrgRoleInput ? String(body.orgRole || '').trim().toUpperCase() : '';
        const appRoleId = hasAppRoleInput ? String(body.appRoleId || '').trim() : '';

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }
        if (!hasOrgRoleInput && !hasAppRoleInput) {
            return NextResponse.json({ error: 'orgRole or appRoleId is required' }, { status: 400 });
        }
        if (hasOrgRoleInput && !['ADMIN', 'STAFF'].includes(orgRole)) {
            return NextResponse.json({ error: 'orgRole must be ADMIN or STAFF' }, { status: 400 });
        }

        const target = await prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId: orgRes.organizationId,
                    userId,
                },
            },
        });
        if (!target) {
            return NextResponse.json({ error: 'User is not a member of this organization' }, { status: 404 });
        }
        if (hasOrgRoleInput && target.role === 'OWNER') {
            return NextResponse.json({ error: 'Owner role cannot be changed' }, { status: 400 });
        }

        if (hasOrgRoleInput) {
            const allowedOrgRole = await canManageOrgMembers(session.user.id, orgRes.organizationId);
            if (!allowedOrgRole) {
                return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
            }
            await prisma.organizationMember.update({
                where: {
                    organizationId_userId: {
                        organizationId: orgRes.organizationId,
                        userId,
                    },
                },
                data: {
                    role: orgRole as 'ADMIN' | 'STAFF',
                },
            });
        }

        if (hasAppRoleInput) {
            const allowedAppRole = await canManageAppRoles(session.user.id);
            if (!allowedAppRole) {
                return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
            }
            const roleId = appRoleId || null;
            if (roleId) {
                const roleExists = await prisma.role.findUnique({ where: { id: roleId } });
                if (!roleExists) {
                    return NextResponse.json({ error: 'Invalid appRoleId' }, { status: 400 });
                }
            }
            await prisma.user.update({
                where: { id: userId },
                data: { roleId },
            });
        }

        const updated = await prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId: orgRes.organizationId,
                    userId,
                },
            },
            include: {
                user: {
                    include: {
                        role: true,
                    },
                },
            },
        });

        return NextResponse.json({ data: updated });
    } catch (error) {
        console.error('Update user role error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
