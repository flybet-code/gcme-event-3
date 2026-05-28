import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { FormFieldType } from '@prisma/client';
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

        return NextResponse.json({ fields: form.fields });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest, { params }: Params) {
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

        const fieldKey = String(body.fieldKey || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_');
        const type = body.type as FormFieldType;
        if (!fieldKey || !type || !Object.values(FormFieldType).includes(type)) {
            return NextResponse.json({ error: 'fieldKey and valid type required' }, { status: 400 });
        }

        const field = await prisma.formField.create({
            data: {
                formId,
                fieldKey,
                label: String(body.label || fieldKey),
                labelI18n: body.labelI18n,
                type,
                required: Boolean(body.required),
                order: typeof body.order === 'number' ? body.order : 0,
                options: body.options,
                validation: body.validation,
            },
        });

        return NextResponse.json({ field });
    } catch (e: unknown) {
        if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
            return NextResponse.json({ error: 'fieldKey already exists on this form' }, { status: 409 });
        }
        console.error(e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
