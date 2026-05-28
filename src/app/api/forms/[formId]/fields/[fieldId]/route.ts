import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FormFieldType } from '@prisma/client';
import { requireOrgMember, hasOrgPermission } from '@/lib/tenancy/require-org';

type Params = { params: Promise<{ formId: string; fieldId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { formId, fieldId } = await params;
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

        const updated = await prisma.formField.update({
            where: { id: fieldId, formId },
            data: {
                label: body.label !== undefined ? String(body.label) : undefined,
                labelI18n: body.labelI18n,
                required: body.required !== undefined ? Boolean(body.required) : undefined,
                order: typeof body.order === 'number' ? body.order : undefined,
                options: body.options,
                validation: body.validation,
            },
        });

        return NextResponse.json({ field: updated });
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
        const { formId, fieldId } = await params;

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

        await prisma.formField.delete({ where: { id: fieldId, formId } });
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
