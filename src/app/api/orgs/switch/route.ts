import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireOrgById } from '@/lib/tenancy/require-org';

export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const organizationId = String(body.organizationId || '').trim();
        if (!organizationId) {
            return NextResponse.json({ error: 'organizationId required' }, { status: 400 });
        }

        const ctx = await requireOrgById(session.user.id, organizationId);
        if (!ctx) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await prisma.userActiveOrganization.upsert({
            where: { userId: session.user.id },
            update: { organizationId: ctx.organizationId },
            create: { userId: session.user.id, organizationId: ctx.organizationId },
        });

        return NextResponse.json({ ok: true, organizationId: ctx.organizationId, slug: ctx.slug });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
