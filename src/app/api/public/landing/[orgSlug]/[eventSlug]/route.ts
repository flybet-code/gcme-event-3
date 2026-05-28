import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildPublicLandingPayload } from '@/lib/landing-page-config';

type Params = { params: Promise<{ orgSlug: string; eventSlug: string }> };

/** Public: event landing (org + event merged); register → /{org}/{event}/register */
export async function GET(_request: NextRequest, { params }: Params) {
    try {
        const { orgSlug, eventSlug } = await params;
        const org = await prisma.organization.findUnique({
            where: { slug: orgSlug },
        });
        if (!org) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const event = await prisma.event.findFirst({
            where: {
                organizationId: org.id,
                slug: eventSlug,
            },
        });
        if (!event) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const payload = buildPublicLandingPayload(org, event);
        return NextResponse.json(payload);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
