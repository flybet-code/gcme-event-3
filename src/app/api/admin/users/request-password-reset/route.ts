import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { resolveActiveOrganization, canManageOrgMembers } from '@/lib/tenancy/active-org-server';
import { requestPasswordResetForEmail } from '@/lib/password-reset';

/**
 * Sends a password reset email to a user in the active organization.
 * Allowed for platform admins, org owners/admins, and members with manage_users.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const orgRes = await resolveActiveOrganization(session);
        if (!orgRes.ok) {
            return NextResponse.json({ error: orgRes.message }, { status: orgRes.status });
        }

        const allowed = await canManageOrgMembers(session.user.id, orgRes.organizationId);
        if (!allowed) {
            return NextResponse.json(
                {
                    error: 'Only organization owners, admins, or users with manage-users permission can send password reset emails',
                },
                { status: 403 }
            );
        }

        const body = await request.json();
        const userId = String(body.userId || '').trim();
        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const membership = await prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId: orgRes.organizationId,
                    userId,
                },
            },
            include: { user: true },
        });

        if (!membership?.user?.email) {
            return NextResponse.json({ error: 'User is not a member of this organization' }, { status: 404 });
        }

        await requestPasswordResetForEmail(membership.user.email, {
            organizationId: orgRes.organizationId,
        });

        return NextResponse.json({
            success: true,
            message: 'If an account exists for this email, a password reset link has been sent.',
        });
    } catch (error) {
        console.error('Admin password reset request error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
