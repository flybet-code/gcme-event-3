import {
    LayoutDashboard,
    UserPlus,
    Users,
    UsersRound,
    Store,
    FileText,
    UserCheck,
    Tags,
    ShieldCheck,
} from 'lucide-react';

/** @deprecated Use DashboardLayout nav builder; kept for imports */
export const NAV_ITEMS = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/admin-register', label: 'New Registration', icon: UserPlus },
    { href: '/history', label: 'All Registration', icon: Users },
    { href: '/groups', label: 'Groups', icon: UsersRound },
    { href: '/vendors', label: 'Vendors', icon: Store },
    { href: '/badges', label: 'Badges', icon: FileText },
    { href: '/attendance', label: 'Check-In', icon: UserCheck },
    { href: '/batches', label: 'Batch and Prefix', icon: Tags },
    { href: '/users', label: 'User Management', icon: ShieldCheck },
];

export const PERMISSION_MAP: Record<string, string> = {
    '/users': 'manage_users',
    '/admin-register': 'register_participants',
    '/attendance': 'check_in_participants',
    '/history': 'view_registrations',
    '/badges': 'view_registrations',
    '/batches': 'manage_batches',
    '/groups': 'manage_groups',
    '/vendors': 'manage_vendors',
    '/dashboard': 'view_financials',
};
