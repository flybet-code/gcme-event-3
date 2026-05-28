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
        if (!ctx || ctx.organizationId !== form.organizationId || !hasOrgPermission(ctx, 'export_data')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const responses = await prisma.formResponse.findMany({
            where: { formId, organizationId: ctx.organizationId },
            orderBy: { createdAt: 'desc' },
            take: 5000,
        });

        const keys = new Set<string>();
        for (const r of responses) {
            const obj = r.responses as Record<string, unknown>;
            Object.keys(obj || {}).forEach((k) => keys.add(k));
        }
        const cols = ['id', 'createdAt', ...[...keys].sort()];

        const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
        const lines = [cols.join(',')];
        for (const r of responses) {
            const obj = (r.responses as Record<string, unknown>) || {};
            const row = cols.map((c) => {
                if (c === 'id') return escape(r.id);
                if (c === 'createdAt') return escape(r.createdAt.toISOString());
                const val = obj[c];
                if (val === undefined || val === null) return '""';
                return escape(typeof val === 'object' ? JSON.stringify(val) : String(val));
            });
            lines.push(row.join(','));
        }

        const csv = lines.join('\n');
        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="form-${formId}-export.csv"`,
            },
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
