import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireOrgMember, hasOrgPermission } from '@/lib/tenancy/require-org';

type Params = { params: Promise<{ eventId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { eventId } = await params;

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: {
                registrationForm: { include: { fields: { orderBy: { order: 'asc' } } } },
            },
        });

        if (!event) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const orgSlug =
            request.nextUrl.searchParams.get('orgSlug') ||
            (session.user as { activeOrganizationSlug?: string }).activeOrganizationSlug;
        if (!orgSlug) {
            return NextResponse.json({ error: 'orgSlug required' }, { status: 400 });
        }

        const ctx = await requireOrgMember(session.user.id, orgSlug);
        if (!ctx || ctx.organizationId !== event.organizationId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json({ event });
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
        const { eventId } = await params;
        const body = await request.json();

        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const orgSlug = String(body.orgSlug || '').trim() || (session.user as { activeOrganizationSlug?: string }).activeOrganizationSlug;
        if (!orgSlug) {
            return NextResponse.json({ error: 'orgSlug required' }, { status: 400 });
        }

        const ctx = await requireOrgMember(session.user.id, orgSlug);
        if (!ctx || ctx.organizationId !== event.organizationId || !hasOrgPermission(ctx, 'manage_events')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        let nextSlug: string | undefined;
        if (body.slug !== undefined) {
            const raw = String(body.slug || '')
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            if (!raw) {
                return NextResponse.json({ error: 'slug cannot be empty' }, { status: 400 });
            }
            const clash = await prisma.event.findFirst({
                where: {
                    organizationId: ctx.organizationId,
                    slug: raw,
                    NOT: { id: eventId },
                },
            });
            if (clash) {
                return NextResponse.json({ error: 'Event slug already taken in this organization' }, { status: 409 });
            }
            nextSlug = raw;
        }

        let nextRegistrationFormId: string | null | undefined;
        if (body.registrationFormId !== undefined) {
            if (body.registrationFormId === null || body.registrationFormId === '') {
                nextRegistrationFormId = null;
            } else {
                const formId = String(body.registrationFormId).trim();
                const form = await prisma.form.findFirst({
                    where: { id: formId, organizationId: ctx.organizationId },
                });
                if (!form) {
                    return NextResponse.json(
                        { error: 'Registration form not found in this organization' },
                        { status: 400 }
                    );
                }
                nextRegistrationFormId = formId;
            }
        }

        let mergedSettings: object | undefined;
        if (body.settings !== undefined) {
            const prev =
                event.settings && typeof event.settings === 'object' && !Array.isArray(event.settings)
                    ? (event.settings as object)
                    : {};
            const next =
                body.settings && typeof body.settings === 'object' && !Array.isArray(body.settings)
                    ? (body.settings as object)
                    : {};
            mergedSettings = { ...prev, ...next };
        }

        const updated = await prisma.event.update({
            where: { id: eventId },
            data: {
                name: body.name !== undefined ? String(body.name) : undefined,
                ...(nextSlug !== undefined ? { slug: nextSlug } : {}),
                description: body.description,
                startsAt: body.startsAt !== undefined ? (body.startsAt ? new Date(body.startsAt) : null) : undefined,
                endsAt: body.endsAt !== undefined ? (body.endsAt ? new Date(body.endsAt) : null) : undefined,
                ...(nextRegistrationFormId !== undefined ? { registrationFormId: nextRegistrationFormId } : {}),
                ...(mergedSettings !== undefined ? { settings: mergedSettings } : {}),
            },
            include: {
                registrationForm: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json({ event: updated });
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
        const { eventId } = await params;

        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const orgSlug = request.nextUrl.searchParams.get('orgSlug') || (session.user as { activeOrganizationSlug?: string }).activeOrganizationSlug;
        if (!orgSlug) {
            return NextResponse.json({ error: 'orgSlug required' }, { status: 400 });
        }

        const ctx = await requireOrgMember(session.user.id, orgSlug);
        if (!ctx || ctx.organizationId !== event.organizationId || !hasOrgPermission(ctx, 'manage_events')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await prisma.event.delete({ where: { id: eventId } });
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
