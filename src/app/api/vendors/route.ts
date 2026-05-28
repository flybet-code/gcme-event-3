import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { assignMembersToGroups } from '@/lib/groups';
import { NextRequest, NextResponse } from 'next/server';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';
import { resolveActiveOrganization } from '@/lib/tenancy/active-org-server';

export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const orgRes = await resolveActiveOrganization(session);
        if (!orgRes.ok) {
            return NextResponse.json({ error: orgRes.message }, { status: orgRes.status });
        }

        const vendors = await prisma.vendor.findMany({
            where: { 
                OR: [
                    { organizationId: orgRes.organizationId },
                    { organizationId: null } // Allow seeing legacy vendors
                ]
            },
            include: {
                _count: {
                    select: { registrations: true, attendees: true }
                }
            },
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(vendors);
    } catch (error) {
        console.error('Vendors GET error:', error);
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

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { role: { include: { permissions: true } } }
        });
        const permissions = user?.role?.permissions.map(p => p.name) || [];
        const isOrgAdmin = orgRes.orgRole === 'OWNER' || orgRes.orgRole === 'ADMIN';

        if (!hasPlatformElevatedAccess(user?.isPlatformSuperAdmin, user?.role?.name) && 
            !permissions.includes('manage_vendors') && 
            !isOrgAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { id, name, capacity } = body;

        let vendor;
        if (id && id !== 'new') {
            const existing = await prisma.vendor.findFirst({
                where: { 
                    id, 
                    OR: [
                        { organizationId: orgId },
                        { organizationId: null }
                    ]
                },
            });
            if (!existing) {
                return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
            }
            vendor = await prisma.vendor.update({
                where: { id },
                data: { 
                    name, 
                    capacity: parseInt(capacity.toString(), 10),
                    organizationId: orgId // Adopt to active org
                },
            });
        } else {
            // Check if name already exists in this org
            const nameExists = await prisma.vendor.findFirst({
                where: { name, organizationId: orgId }
            });
            if (nameExists) {
                return NextResponse.json({ error: 'A vendor with this name already exists' }, { status: 400 });
            }

            vendor = await prisma.vendor.create({
                data: {
                    name,
                    capacity: parseInt(capacity.toString(), 10),
                    organizationId: orgId,
                },
            });
        }

        // Trigger automatic re-allocation after capacity change
        await assignMembersToGroups(orgId);

        return NextResponse.json(vendor);
    } catch (error) {
        console.error('Vendor POST error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}


