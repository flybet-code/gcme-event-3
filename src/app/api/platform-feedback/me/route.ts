import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { PLATFORM_EASE_LABELS } from '@/lib/platform-feedback';

export async function GET() {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const row = await prisma.platformFeedback.findUnique({
            where: { userId: session.user.id },
        });

        if (!row) {
            return NextResponse.json({ submitted: false, feedback: null });
        }

        return NextResponse.json({
            submitted: true,
            feedback: {
                easeRating: row.easeRating,
                easeLabel: PLATFORM_EASE_LABELS[row.easeRating],
                recommendScore: row.recommendScore,
                additionalText: row.additionalText,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
            },
        });
    } catch (e) {
        console.error('GET platform-feedback/me', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
