import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { assignMembersToGroups } from '@/lib/groups';
import { resolveActiveOrganization } from '@/lib/tenancy/active-org-server';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';

export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const orgRes = await resolveActiveOrganization(session);
        if (!orgRes.ok) {
            return NextResponse.json({ error: orgRes.message }, { status: orgRes.status });
        }

        // Permission check
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

        const body = await request.json();
        const { groupId, registrationIds } = body;

        if (!groupId || !registrationIds || !Array.isArray(registrationIds)) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const group = await prisma.group.findFirst({
            where: { id: groupId, organizationId: orgRes.organizationId },
        });
        if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

        // Add new IDs to existing ones, avoiding duplicates
        const currentIds = group.registrationIds || [];
        const newIds = registrationIds.map((id: any) => parseInt(id));
        const updatedIds = Array.from(new Set([...currentIds, ...newIds]));

        await (prisma as any).group.update({
            where: { id: groupId },
            data: { registrationIds: updatedIds }
        });

        // Trigger re-assignment to update Registration and Attendee tables
        await assignMembersToGroups();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Bulk assign error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
