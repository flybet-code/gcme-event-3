import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireOrgMember, hasOrgPermission } from '@/lib/tenancy/require-org';

export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const orgSlug =
            request.nextUrl.searchParams.get('orgSlug') ||
            (session.user as { activeOrganizationSlug?: string }).activeOrganizationSlug;
        if (!orgSlug) {
            return NextResponse.json({ error: 'orgSlug required' }, { status: 400 });
        }

        const ctx = await requireOrgMember(session.user.id, orgSlug);
        if (!ctx) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const eventId = request.nextUrl.searchParams.get('eventId');
        const forms = await prisma.form.findMany({
            where: {
                organizationId: ctx.organizationId,
                ...(eventId ? { eventId } : {}),
            },
            orderBy: { updatedAt: 'desc' },
            include: {
                _count: { select: { fields: true, responses: true } },
            },
        });

        return NextResponse.json({ forms });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const orgSlug = String(body.orgSlug || '').trim() || (session.user as { activeOrganizationSlug?: string }).activeOrganizationSlug;
        if (!orgSlug) {
            return NextResponse.json({ error: 'orgSlug required' }, { status: 400 });
        }

        const ctx = await requireOrgMember(session.user.id, orgSlug);
        if (!ctx || !hasOrgPermission(ctx, 'manage_forms')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const name = String(body.name || '').trim();
        if (!name) {
            return NextResponse.json({ error: 'name required' }, { status: 400 });
        }

        const form = await prisma.form.create({
            data: {
                organizationId: ctx.organizationId,
                eventId: body.eventId || null,
                name,
                isActive: body.isActive !== false,
                defaultLocale: body.defaultLocale || 'en',
                supportedLocales: Array.isArray(body.supportedLocales) ? body.supportedLocales : ['en'],
                i18nMeta: body.i18nMeta,
            },
        });

        return NextResponse.json({ form });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
