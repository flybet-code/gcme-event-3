import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';

async function canManageRoles(userId: string): Promise<boolean> {
    const me = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true },
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
    return member.role === 'OWNER' || member.role === 'ADMIN' || member.permissions.includes('manage_roles');
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

        const permissions = await prisma.permission.findMany();
        return NextResponse.json({ data: permissions });
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
        const name = String(body.name || '').trim();
        const description = String(body.description || '').trim();
        if (!name) {
            return NextResponse.json({ error: 'Permission name is required' }, { status: 400 });
        }

        const permission = await prisma.permission.create({
            data: { name, description: description || null },
        });
        return NextResponse.json({ data: permission });
    } catch (error: unknown) {
        const isDup = Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');
        return NextResponse.json({ error: isDup ? 'Permission name already exists' : 'Internal Server Error' }, { status: isDup ? 409 : 500 });
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
        const id = String(body.id || '').trim();
        const name = String(body.name || '').trim();
        const description = String(body.description || '').trim();
        if (!id || !name) {
            return NextResponse.json({ error: 'id and name are required' }, { status: 400 });
        }

        const permission = await prisma.permission.update({
            where: { id },
            data: {
                name,
                description: description || null,
            },
        });
        return NextResponse.json({ data: permission });
    } catch (error: unknown) {
        const isDup = Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');
        return NextResponse.json({ error: isDup ? 'Permission name already exists' : 'Internal Server Error' }, { status: isDup ? 409 : 500 });
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

        const id = request.nextUrl.searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        await prisma.permission.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
