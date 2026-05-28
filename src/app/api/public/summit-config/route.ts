import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDefaultOrganizationId } from '@/lib/tenancy/active-org-server';
import { buildSummitClientPayload } from '@/lib/summit-registration-config';

/** Public: summit UI config for standalone `/register` (default org + default event from env). */
export async function GET() {
    try {
        const orgId = await getDefaultOrganizationId();
        if (!orgId) {
            return NextResponse.json({ error: 'No default organization' }, { status: 503 });
        }

        const org = await prisma.organization.findUnique({ where: { id: orgId } });
        if (!org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const eventSlug =
            process.env.NEXT_PUBLIC_DEFAULT_EVENT_SLUG ||
            process.env.DEFAULT_EVENT_SLUG ||
            'church-leadership-summit';

        const event = await prisma.event.findFirst({
            where: { organizationId: orgId, slug: eventSlug },
            include: {
                registrationForm: {
                    include: { fields: { orderBy: { order: 'asc' } } },
                },
            },
        });

        const summitRegistration = buildSummitClientPayload(
            org,
            event,
            true,
            event?.registrationForm?.i18nMeta,
            event?.registrationForm?.fields
        );

        return NextResponse.json({ summitRegistration });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
