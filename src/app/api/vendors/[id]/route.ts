import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { assignMembersToGroups } from '@/lib/groups';
import { resolveActiveOrganization } from '@/lib/tenancy/active-org-server';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';

export async function GET(
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

        const { id } = await context.params;
        const vendor = await prisma.vendor.findFirst({
            where: { id, organizationId: orgRes.organizationId },
            include: {
                _count: {
                    select: {
                        registrations: true,
                        attendees: true
                    }
                }
            }
        });

        if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

        // Calculate usage summary for all 3 days
        const [registrations, attendees] = await Promise.all([
            prisma.registration.findMany({
                where: {
                    organizationId: orgRes.organizationId,
                    vendorId: id,
                    paymentStatus: 'PAY_SUCCESS',
                    deletedAt: null,
                },
                select: { activities: true }
            }),
            prisma.attendee.findMany({
                where: {
                    OR: [
                        { vendorId: id },
                        { AND: [{ vendorId: null }, { registration: { vendorId: id } }] }
                    ],
                    registration: {
                        organizationId: orgRes.organizationId,
                        paymentStatus: 'PAY_SUCCESS',
                        deletedAt: null,
                    },
                },
                select: { activities: true }
            })
        ]);

        const summary: Record<string, number> = {};
        const process = (items: any[]) => {
            items.forEach(item => {
                const activities = (item.activities as any) || {};
                Object.keys(activities).forEach(act => {
                    if (act.startsWith('lunch_') || act.startsWith('tea_break_')) {
                        summary[act] = (summary[act] || 0) + 1;
                    }
                });
            });
        };

        process(registrations);
        process(attendees);

        return NextResponse.json({
            ...vendor,
            stats: summary
        });
    } catch (error) {
        console.error('Fetch vendor details error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

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
            !permissions.includes('manage_vendors') &&
            !isOrgAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await context.params;

        const vendorOk = await prisma.vendor.findFirst({
            where: { id, organizationId: orgRes.organizationId },
        });
        if (!vendorOk) {
            return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
        }

        // Reset vendorId on all registrations, attendees and groups associated with this vendor
        await prisma.$transaction([
            (prisma as any).registration.updateMany({
                where: { vendorId: id },
                data: { vendorId: null }
            }),
            (prisma as any).attendee.updateMany({
                where: { vendorId: id },
                data: { vendorId: null }
            }),
            (prisma as any).group.updateMany({
                where: { vendorId: id },
                data: { vendorId: null }
            }),
            (prisma as any).vendor.delete({
                where: { id }
            })
        ]);

        // Re-evaluate assignments after a vendor is removed
        await assignMembersToGroups(orgRes.organizationId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete vendor error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
