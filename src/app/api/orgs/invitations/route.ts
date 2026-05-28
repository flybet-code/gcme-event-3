import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { OrgRole } from '@prisma/client';
import crypto from 'crypto';
import { resolveActiveOrganization, canManageOrgMembers } from '@/lib/tenancy/active-org-server';
import { ALL_ORG_PERMISSIONS } from '@/lib/org-permissions';

/** Default capabilities for STAFF when no custom list is sent */
const DEFAULT_STAFF_PERMISSIONS = [
    'view_registrations',
    'register_participants',
    'check_in_participants',
];

const INVITEABLE_ORG_ROLES: OrgRole[] = ['ADMIN', 'STAFF'];

export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const orgRes = await resolveActiveOrganization(session);
        if (!orgRes.ok) {
            return NextResponse.json({ error: orgRes.message }, { status: orgRes.status });
        }

        const organizationId = orgRes.organizationId;

        const allowed = await canManageOrgMembers(session.user.id, organizationId);
        if (!allowed) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const invitations = await prisma.organizationInvitation.findMany({
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
            include: { organization: { select: { name: true, slug: true } } },
        });

        return NextResponse.json({ data: invitations });
    } catch (e) {
        console.error('GET org invitations', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const email = String(body.email || '')
            .trim()
            .toLowerCase();
        const role = body.role as OrgRole | undefined;
        const permissionsInput = body.permissions as string[] | undefined;

        if (!email || !role) {
            return NextResponse.json({ error: 'email and role are required' }, { status: 400 });
        }

        if (!INVITEABLE_ORG_ROLES.includes(role)) {
            return NextResponse.json(
                { error: 'Only ADMIN or STAFF can be assigned via invitation' },
                { status: 400 }
            );
        }

        const orgRes = await resolveActiveOrganization(session);
        if (!orgRes.ok) {
            return NextResponse.json({ error: orgRes.message }, { status: orgRes.status });
        }

        const organizationId = orgRes.organizationId;

        const allowed = await canManageOrgMembers(session.user.id, organizationId);
        if (!allowed) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const org = await prisma.organization.findUnique({ where: { id: organizationId } });
        if (!org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            const already = await prisma.organizationMember.findUnique({
                where: {
                    organizationId_userId: {
                        organizationId,
                        userId: existingUser.id,
                    },
                },
            });
            if (already) {
                return NextResponse.json(
                    { error: 'This user is already a member of this organization' },
                    { status: 409 }
                );
            }
        }

        const permissions =
            role === 'ADMIN'
                ? [...ALL_ORG_PERMISSIONS]
                : permissionsInput && permissionsInput.length > 0
                  ? permissionsInput
                  : [...DEFAULT_STAFF_PERMISSIONS];

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const invitation = await prisma.organizationInvitation.create({
            data: {
                organizationId,
                email,
                role,
                permissions,
                token,
                expiresAt,
            },
        });

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
        const inviteLink = `${baseUrl}/auth/accept-invite?token=${token}`;

        const { sendOrgInvitationEmail } = await import('@/lib/emailService');
        sendOrgInvitationEmail(email, org.name, role, inviteLink).catch((err) =>
            console.error('Org invite email failed', err)
        );

        return NextResponse.json({
            message: 'Invitation created',
            data: invitation,
            inviteLink,
        });
    } catch (e) {
        console.error('POST org invitations', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const id = request.nextUrl.searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'id required' }, { status: 400 });
        }

        const inv = await prisma.organizationInvitation.findUnique({
            where: { id },
        });
        if (!inv) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const allowed = await canManageOrgMembers(session.user.id, inv.organizationId);
        if (!allowed) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await prisma.organizationInvitation.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('DELETE org invitation', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
