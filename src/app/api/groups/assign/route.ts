import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';
import { assignMembersToGroups } from '@/lib/groups';
import { resolveActiveOrganization } from '@/lib/tenancy/active-org-server';

export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const orgRes = await resolveActiveOrganization(session);
        if (!orgRes.ok) {
            return NextResponse.json({ error: orgRes.message }, { status: orgRes.status });
        }
        const orgId = orgRes.organizationId;

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { role: { include: { permissions: true } } }
        });
        const permissions = user?.role?.permissions.map(p => p.name) || [];
        const isOrgAdmin = orgRes.orgRole === 'OWNER' || orgRes.orgRole === 'ADMIN';

        if (!hasPlatformElevatedAccess(user?.isPlatformSuperAdmin, user?.role?.name) && 
            !permissions.includes('manage_groups') && 
            !permissions.includes('edit_registrations') &&
            !isOrgAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Run the shared assignment engine for this org
        await assignMembersToGroups(orgId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Group Assign error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

