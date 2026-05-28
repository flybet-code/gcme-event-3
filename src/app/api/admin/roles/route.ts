import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';

async function canManageRoles(userId: string): Promise<boolean> {
    const me = await prisma.user.findUnique({
        where: { id: userId },
        select: { isPlatformSuperAdmin: true, role: { select: { name: true } } },
    });
    if (hasPlatformElevatedAccess(me?.isPlatformSuperAdmin, me?.role?.name)) return true;

    const active = await prisma.userActiveOrganization.findUnique({
        where: { userId },
        select: { organizationId: true },
    });
    if (!active?.organizationId) return false;

    const member = await prisma.organizationMember.findUnique({
        where: {
            organizationId_userId: {
                organizationId: active.organizationId,
                userId,
            },
        },
        select: { role: true, permissions: true },
    });
    if (!member) return false;
    return (
        member.role === 'OWNER' ||
        member.role === 'ADMIN' ||
        member.permissions.includes('manage_roles')
    );
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!(await canManageRoles(session.user.id))) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }

        const roles = await prisma.role.findMany({
            include: {
                permissions: true,
                _count: {
                    select: { users: true }
                }
            }
        });

        return NextResponse.json({ data: roles });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!(await canManageRoles(session.user.id))) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }

        const body = await request.json();
        const { name, description, permissionIds } = body;

        const role = await prisma.role.create({
            data: {
                name,
                description,
                permissions: {
                    connect: (permissionIds || []).map((id: string) => ({ id }))
                }
            },
            include: {
                permissions: true
            }
        });

        return NextResponse.json({ data: role });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!(await canManageRoles(session.user.id))) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }

        const body = await request.json();
        const { id, name, description, permissionIds } = body;

        if (!id) {
            return NextResponse.json({ error: 'Role ID is required' }, { status: 400 });
        }

        // Update role and replace permissions
        const role = await prisma.role.update({
            where: { id },
            data: {
                name: name,
                description: description,
                permissions: {
                    set: [], // Disconnect all existing
                    connect: (permissionIds || []).map((pid: string) => ({ id: pid })) // Connect new ones
                }
            },
            include: {
                permissions: true
            }
        });

        return NextResponse.json({ data: role });
    } catch (error) {
        console.error('Update role error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!(await canManageRoles(session.user.id))) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Role ID is required' }, { status: 400 });
        }

        await prisma.role.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete role error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
