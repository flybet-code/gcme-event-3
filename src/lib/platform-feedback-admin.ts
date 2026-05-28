import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { canViewPlatformFeedbackResponses } from '@/lib/platform-app-role';

export async function requirePlatformFeedbackViewer() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
        return { ok: false as const, status: 401, error: 'Unauthorized' };
    }
    const me = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isPlatformSuperAdmin: true },
    });
    if (!canViewPlatformFeedbackResponses(me?.isPlatformSuperAdmin)) {
        return { ok: false as const, status: 403, error: 'Forbidden' };
    }
    return { ok: true as const, userId: session.user.id };
}
