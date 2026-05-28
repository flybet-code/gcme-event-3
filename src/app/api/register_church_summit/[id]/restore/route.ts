import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { canModifyRegistrationInOrg, resolveActiveOrganization } from '@/lib/tenancy/active-org-server';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const id = parseInt(params.id);

        if (isNaN(id)) {
            return NextResponse.json({ error: 'Valid ID is required' }, { status: 400 });
        }

        // --- Security Check: Super Admin or specific permission ---
        const session = await auth.api.getSession({
            headers: request.headers
        });


        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch user from DB to get role and permissions
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                role: {
                    include: { permissions: true }
                }
            }
        });

        const isSuperAdmin = hasPlatformElevatedAccess(user?.isPlatformSuperAdmin, user?.role?.name);

        const orgRes = await resolveActiveOrganization(session);
        if (!isSuperAdmin && !orgRes.ok) {
            return NextResponse.json({ error: orgRes.message }, { status: orgRes.status });
        }

        // Restore follows same org-aware policy as edit/delete.
        const canRestore =
            isSuperAdmin ||
            (orgRes.ok &&
                ((await canModifyRegistrationInOrg(session.user.id, orgRes.organizationId, 'delete')) ||
                    (await canModifyRegistrationInOrg(session.user.id, orgRes.organizationId, 'edit'))));

        if (!canRestore) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }
        // -----------------------------------------

        const existing = await prisma.registration.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
        }
        if (!isSuperAdmin && (!orgRes.ok || existing.organizationId !== orgRes.organizationId)) {
            return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
        }

        const restoredRegistration = await prisma.registration.update({
            where: { id },
            data: {
                deletedAt: null
            }
        });

        return NextResponse.json({
            message: 'Registration restored successfully',
            data: restoredRegistration
        }, { status: 200 });

    } catch (error) {
        console.error('Error restoring registration:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
