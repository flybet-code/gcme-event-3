import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { assignMembersToGroups } from '@/lib/groups';
import { resolveActiveOrganization } from '@/lib/tenancy/active-org-server';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const orgRes = await resolveActiveOrganization(session);
        if (!orgRes.ok) {
            return NextResponse.json({ error: orgRes.message }, { status: orgRes.status });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { role: { include: { permissions: true } } }
        });
        const permissions = user?.role?.permissions.map(p => p.name) || [];
        const isOrgAdmin = orgRes.orgRole === 'OWNER' || orgRes.orgRole === 'ADMIN';

        if (!hasPlatformElevatedAccess(user?.isPlatformSuperAdmin, user?.role?.name) && 
            !permissions.includes('manage_groups') &&
            !isOrgAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await context.params;

        const grp = await prisma.group.findFirst({
            where: { id, organizationId: orgRes.organizationId },
        });
        if (!grp) {
            return NextResponse.json({ error: 'Group not found' }, { status: 404 });
        }

        // Reset groupId and vendorId for all participants in this group before deleting
        await prisma.$transaction([
            (prisma as any).registration.updateMany({
                where: { groupId: id },
                data: { groupId: null, vendorId: null }
            }),
            (prisma as any).attendee.updateMany({
                where: { groupId: id },
                data: { groupId: null, vendorId: null }
            }),
            (prisma as any).group.delete({
                where: { id }
            })
        ]);

        // Re-evaluate assignments after a group is removed
        await assignMembersToGroups(orgRes.organizationId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Group DELETE error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
