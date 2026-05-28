import type { Session } from 'better-auth/types';

type UserWithOrg = {
    id: string;
    activeOrganizationId?: string | null;
    activeOrganizationSlug?: string | null;
};

export function getActiveOrgSlugFromSession(session: Session | null): string | null {
    if (!session?.user) return null;
    const u = session.user as UserWithOrg;
    return u.activeOrganizationSlug ?? null;
}
