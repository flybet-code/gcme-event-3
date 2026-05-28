import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ orgSlug: string }> };

/** Public: list events that have a registration form (for org-level registration hub). */
export async function GET(_request: NextRequest, { params }: Params) {
    try {
        const { orgSlug } = await params;
        const org = await prisma.organization.findUnique({
            where: { slug: orgSlug },
        });
        if (!org) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const events = await prisma.event.findMany({
            where: {
                organizationId: org.id,
                registrationForm: { is: { isActive: true } },
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                startsAt: true,
                endsAt: true,
            },
        });

        return NextResponse.json({
            organization: { id: org.id, name: org.name, slug: org.slug },
            events,
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
