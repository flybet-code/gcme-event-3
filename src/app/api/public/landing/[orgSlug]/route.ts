import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildPublicLandingPayload } from '@/lib/landing-page-config';

type Params = { params: Promise<{ orgSlug: string }> };

/** Public: org-level landing (merged org settings only); register → /{slug}/register */
export async function GET(_request: NextRequest, { params }: Params) {
    try {
        const { orgSlug } = await params;
        const org = await prisma.organization.findUnique({
            where: { slug: orgSlug },
        });
        if (!org) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const payload = buildPublicLandingPayload(org, null);
        return NextResponse.json(payload);
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
