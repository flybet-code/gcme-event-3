import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';

/**
 * Global (app) invitations: only platform super admins may create them.
 * Optional `roleId` selects the application Role; if omitted, Super Admin is used.
 * `grantPlatformSuperAdmin` is set when the assigned role is named "Super Admin".
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const me = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { role: true },
        });

        const hasPlatformAdminAccess = hasPlatformElevatedAccess(me?.isPlatformSuperAdmin, me?.role?.name);

        if (!hasPlatformAdminAccess) {
            return NextResponse.json(
                {
                    error: 'Only platform super admins can send global invitations. Use organization invitations for your team.',
                },
                { status: 403 }
            );
        }

        const body = await request.json();
        const email = String(body.email || '')
            .trim()
            .toLowerCase();

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const superAdminRole = await prisma.role.findUnique({
            where: { name: 'Super Admin' },
        });
        if (!superAdminRole) {
            return NextResponse.json({ error: 'Super Admin role not found in database' }, { status: 500 });
        }

        const requestedRoleId = body.roleId ? String(body.roleId) : superAdminRole.id;
        const assignedRole = await prisma.role.findUnique({
            where: { id: requestedRoleId },
        });
        if (!assignedRole) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        const grantPlatformSuperAdmin = assignedRole.name === 'Super Admin';

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const invitation = await prisma.invitation.create({
            data: {
                email,
                roleId: assignedRole.id,
                grantPlatformSuperAdmin,
                token,
                expiresAt,
            },
        });

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
        const inviteLink = `${baseUrl}/auth/accept-invite?token=${token}`;

        const { sendInvitationEmail } = await import('@/lib/emailService');
        sendInvitationEmail(email, assignedRole.name, inviteLink).catch((err) =>
            console.error('Failed to send invite email:', err)
        );

        return NextResponse.json({
            message: 'Invitation created successfully',
            data: invitation,
            inviteLink
        });
    } catch (error) {
        console.error('Invite error:', error);
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

        const me = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { role: true },
        });
        const hasPlatformAdminAccess = hasPlatformElevatedAccess(me?.isPlatformSuperAdmin, me?.role?.name);
        if (!hasPlatformAdminAccess) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        await prisma.invitation.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete invite error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const me = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { role: true },
        });
        const hasPlatformAdminAccess = hasPlatformElevatedAccess(me?.isPlatformSuperAdmin, me?.role?.name);
        if (!hasPlatformAdminAccess) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const invitations = await prisma.invitation.findMany({
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ data: invitations });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
