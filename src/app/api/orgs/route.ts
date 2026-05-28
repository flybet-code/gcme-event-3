import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ALL_ORG_PERMISSIONS } from '@/lib/org-permissions';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';
export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const u = session.user as { isPlatformSuperAdmin?: boolean; id: string };

        const dbUser = await prisma.user.findUnique({
            where: { id: u.id },
            include: { role: true },
        });
        if (hasPlatformElevatedAccess(dbUser?.isPlatformSuperAdmin, dbUser?.role?.name)) {
            const orgs = await prisma.organization.findMany({
                orderBy: { name: 'asc' },
                include: {
                    _count: { select: { members: true, events: true } },
                },
            });
            return NextResponse.json({ organizations: orgs });
        }

        const memberships = await prisma.organizationMember.findMany({
            where: { userId: session.user.id },
            include: { organization: true },
        });

        return NextResponse.json({
            organizations: memberships.map((m) => ({
                ...m.organization,
                role: m.role,
                permissions: m.permissions,
            })),
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const name = String(body.name || '').trim();
        const slug = String(body.slug || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-');

        if (!name || !slug) {
            return NextResponse.json({ error: 'name and slug required' }, { status: 400 });
        }

        const org = await prisma.organization.create({
            data: {
                name,
                slug,
                ownerId: session.user.id,
                settings: body.settings ?? undefined,
            },
        });

        await prisma.organizationMember.create({
            data: {
                organizationId: org.id,
                userId: session.user.id,
                role: 'OWNER',
                permissions: ALL_ORG_PERMISSIONS,
            },
        });

        await prisma.userActiveOrganization.upsert({
            where: { userId: session.user.id },
            update: { organizationId: org.id },
            create: { userId: session.user.id, organizationId: org.id },
        });

        return NextResponse.json({ organization: org });
    } catch (e: unknown) {
        const msg = e && typeof e === 'object' && 'code' in e && e.code === 'P2002'
            ? 'Slug already taken'
            : 'Internal server error';
        console.error(e);
        return NextResponse.json({ error: msg }, { status: msg.includes('Slug') ? 409 : 500 });
    }
}
