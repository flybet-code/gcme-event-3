/**
 * Canonical application role for platform operators (seed/UI). All checks are case-insensitive.
 * Legacy "Super Admin" is treated the same as ADMIN for elevation.
 */
export const PLATFORM_ADMIN_APP_ROLE_CANONICAL = 'ADMIN' as const;

export function normalizeAppRoleName(name: string | null | undefined): string {
    return (name ?? '').trim().toLowerCase();
}

/** True for application roles Admin (any casing) and legacy Super Admin. */
export function isPlatformAdminAppRole(name: string | null | undefined): boolean {
    const n = normalizeAppRoleName(name);
    return n === normalizeAppRoleName(PLATFORM_ADMIN_APP_ROLE_CANONICAL) || n === 'super admin';
}

/** True when the user has the platform super-admin flag or an elevated app role (Admin / Super Admin). */
export function hasPlatformElevatedAccess(
    isPlatformSuperAdmin: boolean | null | undefined,
    appRoleName: string | null | undefined
): boolean {
    return Boolean(isPlatformSuperAdmin) || isPlatformAdminAppRole(appRoleName);
}

/** Strict check used where only true platform super-admins should pass. */
export function hasStrictPlatformSuperAdminAccess(
    isPlatformSuperAdmin: boolean | null | undefined,
    appRoleName: string | null | undefined
): boolean {
    return Boolean(isPlatformSuperAdmin) || normalizeAppRoleName(appRoleName) === 'super admin';
}

/**
 * Platform feedback responses / campaigns — only the global `isPlatformSuperAdmin` user flag.
 * Org OWNER/ADMIN/STAFF and global Admin app role must not pass.
 */
export function canViewPlatformFeedbackResponses(
    isPlatformSuperAdminFlag: boolean | null | undefined
): boolean {
    return Boolean(isPlatformSuperAdminFlag);
}
