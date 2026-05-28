import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { assignMembersToGroups } from '@/lib/groups';
import { resolveActiveOrganization } from '@/lib/tenancy/active-org-server';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';

export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const orgRes = await resolveActiveOrganization(session);
        if (!orgRes.ok) {
            return NextResponse.json({ error: orgRes.message }, { status: orgRes.status });
        }

        const groups = await prisma.group.findMany({
            where: orgRes.isPlatformSuperAdmin 
                ? { 
                    OR: [
                        { organizationId: orgRes.organizationId },
                        { organizationId: null }
                    ]
                  }
                : { 
                    OR: [
                        { organizationId: orgRes.organizationId },
                        { organizationId: null } // Temporary: allow seeing legacy groups
                    ]
                  },
            orderBy: { createdAt: 'desc' },
            include: {
                vendor: true,
                _count: {
                    select: { registrations: true, attendees: true }
                }
            }
        });
        return NextResponse.json(groups);
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const orgRes = await resolveActiveOrganization(session);
        if (!orgRes.ok) {
            return NextResponse.json({ error: orgRes.message }, { status: orgRes.status });
        }
        const orgId = orgRes.organizationId;

        // Permission check: manage_groups or edit_registrations or platform Admin / Super Admin OR Org OWNER/ADMIN
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

        const body = await request.json();
        const { id, name, description, roles, paymentStatuses, coupons, registrationIds, vendorId } = body;

        const data: any = {
            name,
            description,
            roles: roles || [],
            paymentStatuses: paymentStatuses || [],
            coupons: (coupons || []).map((c: string) => c.toUpperCase().trim()),
            registrationIds: (registrationIds || []).map((rid: string | number) => parseInt(rid.toString(), 10)),
            vendorId: vendorId || null,
            organizationId: orgId, // Always ensure orgId is set/updated
        };

        let group;
        const existingId = id && id !== 'new' ? String(id) : null;

        if (existingId) {
            const existing = await prisma.group.findFirst({
                where: { 
                    id: existingId,
                    OR: [
                        { organizationId: orgId },
                        { organizationId: null }
                    ]
                },
            });
            if (!existing) {
                return NextResponse.json({ error: 'Group not found' }, { status: 404 });
            }
            group = await prisma.group.update({
                where: { id: existingId },
                data,
            });
        } else {
            // Check if name already exists in this org
            const nameExists = await prisma.group.findFirst({
                where: { name, organizationId: orgId }
            });
            if (nameExists) {
                return NextResponse.json({ error: 'A group with this name already exists' }, { status: 400 });
            }

            group = await prisma.group.create({
                data,
            });
        }

        await assignMembersToGroups(orgId);

        return NextResponse.json(group);
    } catch (error) {
        console.error('Group POST error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}


