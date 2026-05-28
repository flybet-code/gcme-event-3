import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

async function withAccountStatus<T extends { email: string }>(payload: T) {
    const existing = await prisma.user.findUnique({
        where: { email: payload.email.trim().toLowerCase() },
        select: { id: true, name: true },
    });
    return {
        ...payload,
        accountExists: Boolean(existing),
        existingUserName: existing?.name ?? null,
    };
}

export async function GET(request: NextRequest) {
    try {
        const token = request.nextUrl.searchParams.get('token');

        if (!token) {
            return NextResponse.json({ error: 'Token is required' }, { status: 400 });
        }

        const platformInv = await prisma.invitation.findUnique({
            where: { token }
        });

        if (platformInv) {
            if (platformInv.used) {
                return NextResponse.json({ error: 'This invitation has already been used' }, { status: 400 });
            }

            if (new Date() > platformInv.expiresAt) {
                return NextResponse.json({ error: 'This invitation has expired' }, { status: 400 });
            }

            const role = await prisma.role.findUnique({
                where: { id: platformInv.roleId }
            });

            return NextResponse.json(
                await withAccountStatus({
                    inviteKind: 'platform' as const,
                    email: platformInv.email,
                    roleId: platformInv.roleId,
                    role,
                    grantPlatformSuperAdmin: platformInv.grantPlatformSuperAdmin,
                })
            );
        }

        const orgInv = await prisma.organizationInvitation.findUnique({
            where: { token },
            include: { organization: { select: { id: true, name: true, slug: true } } },
        });

        if (!orgInv) {
            return NextResponse.json({ error: 'Invalid invitation token' }, { status: 404 });
        }

        if (orgInv.used) {
            return NextResponse.json({ error: 'This invitation has already been used' }, { status: 400 });
        }

        if (new Date() > orgInv.expiresAt) {
            return NextResponse.json({ error: 'This invitation has expired' }, { status: 400 });
        }

        return NextResponse.json(
            await withAccountStatus({
                inviteKind: 'org' as const,
                email: orgInv.email,
                orgRole: orgInv.role,
                organizationId: orgInv.organizationId,
                organizationName: orgInv.organization.name,
                organizationSlug: orgInv.organization.slug,
            })
        );

    } catch (error) {
        console.error('Validate invite error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
