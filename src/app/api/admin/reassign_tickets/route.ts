import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { assignTicketNumbers } from '@/lib/tickets';
import { NextRequest, NextResponse } from 'next/server';
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
        const orgId = orgRes.organizationId;

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { role: { include: { permissions: true } } }
        });
        const permissions = user?.role?.permissions.map(p => p.name) || [];
        if (!hasPlatformElevatedAccess(user?.isPlatformSuperAdmin, user?.role?.name) && !permissions.includes('manage_batches')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await prisma.$transaction([
            prisma.registration.updateMany({
                where: { organizationId: orgId },
                data: { ticketNumber: null },
            }),
            prisma.attendee.updateMany({
                where: { registration: { organizationId: orgId } },
                data: { ticketNumber: null },
            }),
        ]);

        const registrations = await prisma.registration.findMany({
            where: {
                organizationId: orgId,
                paymentStatus: 'PAY_SUCCESS',
                deletedAt: null,
            },
            orderBy: { createdAt: 'asc' }
        });

        // 3. Re-assign using the new batch logic
        for (const reg of registrations) {
            await assignTicketNumbers(reg.id);
        }

        return NextResponse.json({ message: 'All ticket numbers have been reassigned successfully' });
    } catch (error) {
        console.error('Reassignment error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
