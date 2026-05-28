/** Org-scoped permissions (aligned with OrganizationMember.permissions and API checks) */
export const ORG_PERMISSIONS = [
    'manage_events',
    'manage_forms',
    'view_registrations',
    'register_participants',
    'check_in_participants',
    'view_financials',
    'manage_payments',
    'delete_registrations',
    'edit_registrations',
    'manage_batches',
    'manage_groups',
    'manage_vendors',
    'manage_users',
    'manage_roles',
    'export_data',
] as const;

export type OrgPermission = (typeof ORG_PERMISSIONS)[number];

/** Full set for OWNER / ADMIN bootstrap */
export const ALL_ORG_PERMISSIONS: string[] = [...ORG_PERMISSIONS];

/** Map legacy global Permission names (seed) to org permission strings */
export const LEGACY_TO_ORG_PERMISSION: Record<string, string> = {
    manage_users: 'manage_users',
    manage_roles: 'manage_roles',
    view_registrations: 'view_registrations',
    manage_payments: 'manage_payments',
    register_participants: 'register_participants',
    check_in_participants: 'check_in_participants',
    view_financials: 'view_financials',
    delete_registrations: 'delete_registrations',
    edit_registrations: 'edit_registrations',
    manage_batches: 'manage_batches',
    manage_groups: 'manage_groups',
    manage_vendors: 'manage_vendors',
};

export function legacyPermissionsToOrg(legacy: string[]): string[] {
    const out = new Set<string>();
    for (const p of legacy) {
        const m = LEGACY_TO_ORG_PERMISSION[p];
        if (m) out.add(m);
    }
    out.add('manage_events');
    out.add('manage_forms');
    out.add('export_data');
    return [...out];
}
