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

        const form = await prisma.form.findUnique({
            where: { id: formId },
            include: { fields: { orderBy: { order: 'asc' } } },
        });
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
        if (!ctx || ctx.organizationId !== form.organizationId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json({ form });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { formId } = await params;
        const body = await request.json();

        const form = await prisma.form.findUnique({ where: { id: formId } });
        if (!form) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const orgSlug = String(body.orgSlug || '').trim() || (session.user as { activeOrganizationSlug?: string }).activeOrganizationSlug;
        if (!orgSlug) {
            return NextResponse.json({ error: 'orgSlug required' }, { status: 400 });
        }

        const ctx = await requireOrgMember(session.user.id, orgSlug);
        if (!ctx || ctx.organizationId !== form.organizationId || !hasOrgPermission(ctx, 'manage_forms')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const updated = await prisma.form.update({
            where: { id: formId },
            data: {
                name: body.name !== undefined ? String(body.name) : undefined,
                isActive: body.isActive,
                defaultLocale: body.defaultLocale,
                supportedLocales: body.supportedLocales,
                i18nMeta: body.i18nMeta,
                eventId: body.eventId,
            },
        });

        return NextResponse.json({ form: updated });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: Params) {
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
        if (!ctx || ctx.organizationId !== form.organizationId || !hasOrgPermission(ctx, 'manage_forms')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const inUse = await prisma.event.count({
            where: {
                organizationId: ctx.organizationId,
                registrationFormId: formId,
            },
        });
        if (inUse > 0) {
            return NextResponse.json(
                {
                    error: 'Detach this form from all events first (it is still linked as a registration form).',
                },
                { status: 409 }
            );
        }

        await prisma.form.delete({ where: { id: formId } });
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
