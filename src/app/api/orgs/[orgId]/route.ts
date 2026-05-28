import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageOrgMembers } from '@/lib/tenancy/active-org-server';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';
import { DEFAULT_REGISTRATION_FORM_ID_KEY } from '@/lib/org-settings';

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ orgId: string }> }
) {
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { orgId } = await context.params;
        const body = await request.json();
        const name = body.name != null ? String(body.name).trim() : undefined;
        const slugRaw = body.slug != null ? String(body.slug).trim() : undefined;
        const settings = body.settings !== undefined ? body.settings : undefined;

        const allowed = await canManageOrgMembers(session.user.id, orgId);
        if (!allowed) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const slug =
            slugRaw !== undefined
                ? slugRaw
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, '-')
                    .replace(/-+/g, '-')
                    .replace(/^-|-$/g, '')
                : undefined;

        if (slug) {
            const clash = await prisma.organization.findFirst({
                where: { slug, NOT: { id: orgId } },
            });
            if (clash) {
                return NextResponse.json({ error: 'That URL slug is already taken' }, { status: 409 });
            }
        }

        let mergedSettings: object | undefined;
        if (settings !== undefined) {
            const existing = await prisma.organization.findUnique({
                where: { id: orgId },
                select: { settings: true },
            });
            const prev =
                existing?.settings && typeof existing.settings === 'object' && !Array.isArray(existing.settings)
                    ? (existing.settings as object)
                    : {};
            const next =
                settings && typeof settings === 'object' && !Array.isArray(settings) ? (settings as object) : {};
            mergedSettings = { ...prev, ...next };

            const defKey = DEFAULT_REGISTRATION_FORM_ID_KEY;
            if (Object.prototype.hasOwnProperty.call(mergedSettings, defKey)) {
                const v = (mergedSettings as Record<string, unknown>)[defKey];
                if (v === null || v === '') {
                    (mergedSettings as Record<string, unknown>)[defKey] = null;
                } else if (typeof v === 'string' && v.trim()) {
                    const form = await prisma.form.findFirst({
                        where: { id: v.trim(), organizationId: orgId },
                    });
                    if (!form) {
                        return NextResponse.json(
                            { error: 'Default registration form not found in this organization' },
                            { status: 400 }
                        );
                    }
                    (mergedSettings as Record<string, unknown>)[defKey] = v.trim();
                } else {
                    return NextResponse.json(
                        { error: 'Invalid defaultRegistrationFormId' },
                        { status: 400 }
                    );
                }
            }
        }

        const organization = await prisma.organization.update({
            where: { id: orgId },
            data: {
                ...(name !== undefined && name.length > 0 ? { name } : {}),
                ...(slug !== undefined && slug.length > 0 ? { slug } : {}),
                ...(mergedSettings !== undefined ? { settings: mergedSettings } : {}),
            },
        });

        return NextResponse.json({ organization });
    } catch (e) {
        console.error('PATCH org', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ orgId: string }> }
) {
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const dbUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { role: true },
        });
        if (!hasPlatformElevatedAccess(dbUser?.isPlatformSuperAdmin, dbUser?.role?.name)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { orgId } = await context.params;

        const organization = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { id: true, name: true },
        });
        if (!organization) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        await prisma.organization.delete({
            where: { id: orgId },
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('DELETE org', e);
        return NextResponse.json({ error: 'Could not delete organization' }, { status: 500 });
    }
}
