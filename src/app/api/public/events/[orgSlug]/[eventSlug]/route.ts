import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveEffectiveRegistrationFields } from '@/lib/forms/effective-registration-fields';
import { isSummitLegacyForm } from '@/lib/form-templates';
import { getDefaultRegistrationFormIdFromSettings } from '@/lib/org-settings';
import { buildSummitClientPayload } from '@/lib/summit-registration-config';

type Params = { params: Promise<{ orgSlug: string; eventSlug: string }> };

/** Public: load event + registration form schema for dynamic registration UI */
export async function GET(_request: NextRequest, { params }: Params) {
    try {
        const { orgSlug, eventSlug } = await params;

        const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
        if (!org) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const event = await prisma.event.findUnique({
            where: {
                organizationId_slug: {
                    organizationId: org.id,
                    slug: eventSlug,
                },
            },
            include: {
                registrationForm: {
                    include: { fields: { orderBy: { order: 'asc' } } },
                },
            },
        });

        if (!event?.registrationForm?.isActive) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        const fields = await resolveEffectiveRegistrationFields(
            org.id,
            org.settings,
            event.registrationForm
        );

        let i18nMeta = event.registrationForm.i18nMeta;
        if (
            event.registrationForm.fields.length === 0 &&
            fields.length > 0 &&
            !isSummitLegacyForm(event.registrationForm)
        ) {
            const defId = getDefaultRegistrationFormIdFromSettings(org.settings);
            if (defId && defId !== event.registrationForm.id) {
                const tmpl = await prisma.form.findFirst({
                    where: { id: defId, organizationId: org.id },
                });
                if (tmpl && isSummitLegacyForm(tmpl)) {
                    i18nMeta = tmpl.i18nMeta;
                }
            }
        }

        const summitRegistration = buildSummitClientPayload(org, event, true, i18nMeta, fields);

        return NextResponse.json({
            organization: { id: org.id, name: org.name, slug: org.slug },
            event: {
                id: event.id,
                name: event.name,
                slug: event.slug,
                startsAt: event.startsAt,
                endsAt: event.endsAt,
            },
            form: { ...event.registrationForm, fields, i18nMeta },
            summitRegistration,
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
