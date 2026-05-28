import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireOrgMember, hasOrgPermission } from '@/lib/tenancy/require-org';

type Params = { params: Promise<{ formId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { formId } = await params;

        const form = await prisma.form.findUnique({ where: { id: formId } });
        if (!form) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const orgSlug =
            request.nextUrl.searchParams.get('orgSlug') ||
            (session.user as { activeOrganizationSlug?: string }).activeOrganizationSlug;
        if (!orgSlug) {
            return NextResponse.json({ error: 'orgSlug required' }, { status: 400 });
        }

        const ctx = await requireOrgMember(session.user.id, orgSlug);
        if (!ctx || ctx.organizationId !== form.organizationId || !hasOrgPermission(ctx, 'view_registrations')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const take = Math.min(Number(request.nextUrl.searchParams.get('take')) || 50, 200);
        const skip = Number(request.nextUrl.searchParams.get('skip')) || 0;

        const where = {
            formId,
            organizationId: ctx.organizationId,
        };

        const [responses, total] = await Promise.all([
            prisma.formResponse.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take,
                skip,
            }),
            prisma.formResponse.count({ where }),
        ]);

        return NextResponse.json({ responses, total, take, skip });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
