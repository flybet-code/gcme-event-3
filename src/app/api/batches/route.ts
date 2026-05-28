import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
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

        const batches = await prisma.batch.findMany({
            where: { organizationId: orgRes.organizationId },
            orderBy: { prefix: 'asc' }
        });
        return NextResponse.json(batches);
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

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { role: { include: { permissions: true } } }
        });
        const permissions = user?.role?.permissions.map(p => p.name) || [];
        const isOrgAdmin = orgRes.orgRole === 'OWNER' || orgRes.orgRole === 'ADMIN';

        if (!hasPlatformElevatedAccess(user?.isPlatformSuperAdmin, user?.role?.name) && 
            !permissions.includes('manage_batches') &&
            !isOrgAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { id, name, prefix, roles, paymentStatuses, coupons, registrationIds } = body;

        const data = {
            name,
            prefix: parseInt(prefix.toString(), 10),
            roles: roles || [],
            paymentStatuses: paymentStatuses || [],
            coupons: (coupons || []).map((c: string) => c.toUpperCase().trim()),
            registrationIds: (registrationIds || []).map((rid: string | number) => parseInt(rid.toString(), 10))
        };

        let batch;
        const existingId = id && id !== 'new' ? String(id) : null;

        if (existingId) {
            const existing = await prisma.batch.findFirst({
                where: { id: existingId, organizationId: orgId },
            });
            if (!existing) {
                return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
            }
            batch = await prisma.batch.update({
                where: { id: existingId },
                data,
            });
        } else {
            batch = await prisma.batch.create({
                data: {
                    ...data,
                    organizationId: orgId,
                },
            });
        }

        return NextResponse.json(batch);
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
