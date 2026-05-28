import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { token, name: nameInput } = body;

        if (!token) {
            return NextResponse.json({ error: 'Token required' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { id: true, email: true },
        });

        if (!user?.email) {
            return NextResponse.json({ error: 'User email missing' }, { status: 400 });
        }

        const displayName =
            typeof nameInput === 'string' && nameInput.trim() ? nameInput.trim() : null;
        if (displayName) {
            await prisma.user.update({
                where: { id: user.id },
                data: { name: displayName },
            });
        }

        const platformInv = await prisma.invitation.findUnique({
            where: { token },
        });

        if (platformInv) {
            if (platformInv.used) {
                return NextResponse.json({ error: 'Invalid invitation' }, { status: 400 });
            }

            if (user.email.toLowerCase() !== platformInv.email.toLowerCase()) {
                return NextResponse.json(
                    { error: 'Signed-in account must match the invitation email' },
                    { status: 403 }
                );
            }

            await prisma.invitation.update({
                where: { id: platformInv.id },
                data: { used: true }
            });

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    roleId: platformInv.roleId,
                    emailVerified: true,
                    ...(platformInv.grantPlatformSuperAdmin ? { isPlatformSuperAdmin: true } : {}),
                },
            });

            return NextResponse.json({ success: true, kind: 'platform' });
        }

        const orgInv = await prisma.organizationInvitation.findUnique({
            where: { token },
        });

        if (!orgInv) {
            return NextResponse.json({ error: 'Invalid invitation' }, { status: 400 });
        }

        if (orgInv.used) {
            return NextResponse.json({ error: 'Invalid invitation' }, { status: 400 });
        }

        if (user.email.toLowerCase() !== orgInv.email.toLowerCase()) {
            return NextResponse.json(
                { error: 'Signed-in account must match the invitation email' },
                { status: 403 }
            );
        }

        await prisma.organizationInvitation.update({
            where: { id: orgInv.id },
            data: { used: true },
        });

        await prisma.organizationMember.upsert({
            where: {
                organizationId_userId: {
                    organizationId: orgInv.organizationId,
                    userId: user.id,
                },
            },
            create: {
                organizationId: orgInv.organizationId,
                userId: user.id,
                role: orgInv.role,
                permissions: orgInv.permissions,
            },
            update: {
                role: orgInv.role,
                permissions: orgInv.permissions,
            },
        });

        await prisma.userActiveOrganization.upsert({
            where: { userId: user.id },
            update: { organizationId: orgInv.organizationId },
            create: {
                userId: user.id,
                organizationId: orgInv.organizationId,
            },
        });

        return NextResponse.json({ success: true, kind: 'org' });
    } catch (error) {
        console.error('Complete invite error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
