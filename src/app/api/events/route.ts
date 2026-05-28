import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireOrgMember, hasOrgPermission } from '@/lib/tenancy/require-org';
import { getDefaultRegistrationFormIdFromSettings } from '@/lib/org-settings';

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
            return NextResponse.json({ error: 'orgSlug or active organization required' }, { status: 400 });
        }

        const ctx = await requireOrgMember(session.user.id, orgSlug);
        if (!ctx) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const events = await prisma.event.findMany({
            where: { organizationId: ctx.organizationId },
            orderBy: { createdAt: 'desc' },
            include: {
                registrationForm: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json({ events });
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
        if (!ctx || !hasOrgPermission(ctx, 'manage_events')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const name = String(body.name || '').trim();
        const slug = String(body.slug || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        if (!name || !slug) {
            return NextResponse.json({ error: 'name and slug required' }, { status: 400 });
        }

        const rawFormId = body.registrationFormId;
        let registrationFormId: string | undefined;

        if (rawFormId !== undefined && rawFormId !== null && String(rawFormId).trim() !== '') {
            const formId = String(rawFormId).trim();
            const form = await prisma.form.findFirst({
                where: { id: formId, organizationId: ctx.organizationId },
            });
            if (!form) {
                return NextResponse.json(
                    { error: 'Registration form not found in this organization' },
                    { status: 400 }
                );
            }
            registrationFormId = formId;
        } else if (rawFormId === undefined) {
            const org = await prisma.organization.findUnique({
                where: { id: ctx.organizationId },
                select: { settings: true },
            });
            const defaultId = getDefaultRegistrationFormIdFromSettings(org?.settings);
            if (defaultId) {
                const form = await prisma.form.findFirst({
                    where: { id: defaultId, organizationId: ctx.organizationId },
                });
                if (form) {
                    registrationFormId = defaultId;
                }
            }
        }
        /* rawFormId === null or "" → leave registrationFormId undefined (no form) */

        const event = await prisma.event.create({
            data: {
                organizationId: ctx.organizationId,
                name,
                slug,
                description: body.description ?? undefined,
                startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
                endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
                settings: body.settings ?? undefined,
                ...(registrationFormId !== undefined ? { registrationFormId } : {}),
            },
            include: {
                registrationForm: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json({ event });
    } catch (e: unknown) {
        if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
            return NextResponse.json({ error: 'Event slug already taken in this organization' }, { status: 409 });
        }
        console.error(e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
