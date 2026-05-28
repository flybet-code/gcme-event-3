import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resolveActiveOrganization, canAccessBadgesInOrg } from '@/lib/tenancy/active-org-server';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';
import { prisma } from '@/lib/prisma';
import { resolveBadgeForImage } from '@/lib/badge-resolve';
import { generateBadgeImage } from '@/lib/generate-badge-image';

export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { role: true },
        });
        const isPlatformAdmin = hasPlatformElevatedAccess(
            user?.isPlatformSuperAdmin,
            user?.role?.name
        );

        const orgRes = await resolveActiveOrganization(session);
        if (!isPlatformAdmin && !orgRes.ok) {
            return NextResponse.json({ error: orgRes.message }, { status: orgRes.status });
        }

        const canDownload =
            isPlatformAdmin ||
            (orgRes.ok &&
                (await canAccessBadgesInOrg(session.user.id, orgRes.organizationId)));

        if (!canDownload) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const badgeId = request.nextUrl.searchParams.get('badgeId')?.trim();
        if (!badgeId) {
            return NextResponse.json({ error: 'badgeId is required' }, { status: 400 });
        }

        if (!orgRes.ok) {
            return NextResponse.json({ error: 'No active organization' }, { status: 403 });
        }

        const resolved = await resolveBadgeForImage(badgeId, orgRes.organizationId);
        if (!resolved) {
            return NextResponse.json({ error: 'Badge not found' }, { status: 404 });
        }

        const ticketNo = resolved.ticketNumber
            ? resolved.ticketNumber.toString().padStart(4, '0')
            : '0000';

        const png = await generateBadgeImage(
            resolved.fullName,
            ticketNo,
            resolved.badgeId,
            resolved.templateSrc
        );

        const safeName = resolved.fullName
            .replace(/[^\w\s-]/g, '')
            .trim()
            .replace(/\s+/g, '_')
            .slice(0, 48) || 'attendee';

        return new NextResponse(new Uint8Array(png), {
            status: 200,
            headers: {
                'Content-Type': 'image/png',
                'Content-Disposition': `attachment; filename="badge_${safeName}_${badgeId.replace(/[^a-zA-Z0-9-_]/g, '_')}.png"`,
                'Cache-Control': 'private, no-cache',
            },
        });
    } catch (error) {
        console.error('Badge image download error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
