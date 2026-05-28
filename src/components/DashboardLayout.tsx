'use client';

import React, { createContext, useContext, useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import {
    LayoutDashboard,
    Users,
    UserPlus,
    FileText,
    UserCheck,
    Tags,
    ShieldCheck,
    Settings,
    HelpCircle,
    UsersRound,
    Store,
    MessageSquare,
    LogOut,
    Calendar,
    ClipboardList,
    Building2,
    Mail,
    MessageSquareHeart,
} from 'lucide-react';
import DashboardAuthGuard from '@/components/auth/DashboardAuthGuard';
import {
    PlatformFeedbackModal,
    type PlatformFeedbackModalContext,
} from '@/components/PlatformFeedbackModal';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';

const SidebarContext = createContext<{ openSidebar: () => void } | null>(null);

export function useDashboardSidebar() {
    const ctx = useContext(SidebarContext);
    return ctx;
}

export function DashboardMobileMenuButton() {
    const ctx = useContext(SidebarContext);
    if (!ctx) return null;
    return (
        <button
            type="button"
            onClick={ctx.openSidebar}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-xl mr-2"
            aria-label="Open menu"
        >
            <LayoutDashboard className="w-6 h-6 text-gray-600" />
        </button>
    );
}

type SessionUser = {
    permissions?: string[];
    role?: string;
    legacyRole?: string;
    isPlatformSuperAdmin?: boolean;
    /** Global platform super-admin flag only — not org/event roles */
    canViewPlatformFeedback?: boolean;
    orgRole?: string | null;
    activeOrganizationSlug?: string | null;
};



function useOrgBase(): string | null {
    const pathname = usePathname();
    const { data: session } = authClient.useSession();
    // Match /{orgSlug}/ pattern (excluding special routes like /api, /login, etc.)
    const fromPath = pathname.match(/^\/([^\/]+)\//)?.[1];
    const fromSession = (session?.user as SessionUser | undefined)?.activeOrganizationSlug;
    const slug = fromPath ?? fromSession ?? null;
    return slug ? `/${slug}` : null;
}

function hasFullAccess(user: SessionUser | undefined): boolean {
    if (!user) return false;
    const appRole = user.legacyRole ?? user.role;
    if (hasPlatformElevatedAccess(user.isPlatformSuperAdmin, appRole)) return true;
    if (user.orgRole === 'OWNER' || user.orgRole === 'ADMIN') return true;
    return false;
}

function canSee(user: SessionUser | undefined, perm: string, permissions: string[]): boolean {
    if (hasFullAccess(user)) return true;
    if (perm === 'view_registrations') {
        return (
            permissions.includes('view_registrations') ||
            permissions.includes('edit_registrations')
        );
    }
    return permissions.includes(perm);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const [feedbackContext, setFeedbackContext] = useState<PlatformFeedbackModalContext | undefined>();
    const promptCheckedRef = useRef(false);
    const { data: session, isPending } = authClient.useSession();
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    const user = session?.user as SessionUser | undefined;
    const permissions = user?.permissions ?? [];
    const base = useOrgBase();

    const navItems = useMemo(() => {
        const items: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; perm: string }[] = [];

        const legacyOrScoped = (path: string, label: string, icon: React.ComponentType<{ className?: string }>, perm: string) => {
            items.push({ href: path, label, icon, perm });
        };

        // Legacy items first
        legacyOrScoped('/dashboard', 'Overview', LayoutDashboard, 'view_financials');
        legacyOrScoped('/admin-register', 'New Registration', UserPlus, 'register_participants');
        legacyOrScoped('/history', 'All Registration', Users, 'view_registrations');
        legacyOrScoped('/groups', 'Groups', UsersRound, 'manage_groups');
        legacyOrScoped('/vendors', 'Vendors', Store, 'manage_vendors');
        legacyOrScoped('/badges', 'Badges', FileText, 'view_registrations');
        legacyOrScoped('/attendance', 'Check-In', UserCheck, 'check_in_participants');
        legacyOrScoped('/batches', 'Batch and Prefix', Tags, 'manage_batches');
        legacyOrScoped('/users', 'User Management', ShieldCheck, 'manage_users');
        legacyOrScoped('/messages', 'Team email', Mail, 'manage_users');
        legacyOrScoped('/sms', 'Team SMS', MessageSquare, 'manage_users');

        // Then Events, Forms at the bottom
        if (base) {
            items.push(
                { href: `${base}/events`, label: 'Events', icon: Calendar, perm: 'manage_events' },
                { href: `${base}/forms`, label: 'Forms', icon: ClipboardList, perm: 'manage_forms' }
                // Registrations removed as requested
            );
        }

        // Organizations absolute last (platform Admin / Super Admin)
        if (hasPlatformElevatedAccess(user?.isPlatformSuperAdmin, user?.legacyRole ?? user?.role)) {
            items.push({ href: '/organizations', label: 'Organizations', icon: Building2, perm: '__platform__' });
        }

        if (user?.canViewPlatformFeedback) {
            items.push({
                href: '/platform-feedback',
                label: 'Platform feedback',
                icon: MessageSquareHeart,
                perm: '__platform_feedback__',
            });
        }

        return items;
    }, [base, user?.canViewPlatformFeedback, user?.isPlatformSuperAdmin, user?.legacyRole, user?.role]);

    const filteredNavItems = navItems.filter((item) => {
        if (item.perm === '__platform_feedback__') {
            return Boolean(user?.canViewPlatformFeedback);
        }
        if (item.perm === '__platform__') {
            return hasPlatformElevatedAccess(
                user?.isPlatformSuperAdmin,
                user?.legacyRole ?? user?.role
            );
        }
        return canSee(user, item.perm, permissions);
    });
    const isSettingsActive = pathname === '/settings' || pathname.startsWith('/settings/');

    const openFeedbackManual = () => {
        setFeedbackContext(undefined);
        setFeedbackOpen(true);
    };

    useEffect(() => {
        promptCheckedRef.current = false;
    }, [sessionUserId]);

    useEffect(() => {
        if (isPending || !sessionUserId || promptCheckedRef.current) return;
        promptCheckedRef.current = true;

        fetch('/api/platform-feedback/prompt', { credentials: 'include' })
            .then((r) => r.json())
            .then((data: {
                shouldShow?: boolean;
                campaignId?: string;
                title?: string;
                organizationName?: string;
                eventName?: string;
            }) => {
                if (!data.shouldShow || !data.campaignId) return;
                const sessionKey = `pf_prompt_${data.campaignId}`;
                if (typeof window !== 'undefined' && sessionStorage.getItem(sessionKey)) {
                    return;
                }
                if (typeof window !== 'undefined') {
                    sessionStorage.setItem(sessionKey, '1');
                }
                setFeedbackContext({
                    campaignId: data.campaignId,
                    title: data.title,
                    organizationName: data.organizationName,
                    eventName: data.eventName,
                    isAutoPrompt: true,
                });
                setFeedbackOpen(true);
            })
            .catch(() => {});
    }, [isPending, sessionUserId]);

    return (
        <DashboardAuthGuard>
            <SidebarContext.Provider value={{ openSidebar: () => setMobileMenuOpen(true) }}>
            <div className="min-h-screen bg-gray-50 flex">
                {mobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                        onClick={() => setMobileMenuOpen(false)}
                        aria-hidden
                    />
                )}

                <aside
                    className={`w-64 bg-white border-r border-gray-100 flex flex-col fixed h-full z-50 transform transition-transform duration-300 lg:transform-none print:hidden ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
                >
                    <div className="p-6 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-xl flex items-center justify-center">
                                 <Image src="/assets/cls_2025/logo_yotor.png" alt="Yotor Logo" width={40} height={40} />
                             </div>
                             <span className="font-bold text-xl text-gray-800">
                                 Yotor<span className="text-[#22C55E]"></span>
                             </span>
                        </div>
                        <OrgSwitcher />
                    </div>

                    <nav className="flex-1 p-4 overflow-y-auto">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-3">Main</p>
                        <ul className="space-y-1">
                            {filteredNavItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                                return (
                                    <li key={item.href + item.label}>
                                        <Link
                                            href={item.href}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${isActive ? 'bg-[#F0FDF4] text-[#22C55E]' : 'text-gray-600 hover:bg-gray-50'}`}
                                        >
                                            <Icon className="w-5 h-5 shrink-0" />
                                            <span>{item.label}</span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>

                    <div className="p-4 mt-auto">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-3">Support</p>
                        <ul className="space-y-1">
                            <li>
                                <Link
                                    href="/settings"
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                                        isSettingsActive ? 'bg-[#F0FDF4] text-[#22C55E]' : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    <Settings className="w-5 h-5" />
                                    <span className="font-medium">Settings</span>
                                </Link>
                            </li>
                            <li>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMobileMenuOpen(false);
                                        openFeedbackManual();
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 transition"
                                >
                                    <HelpCircle className="w-5 h-5" />
                                    <span className="font-medium">Send feedback</span>
                                </button>
                            </li>
                        </ul>
                        <div className="mt-8">
                            <div className="bg-gradient-to-br from-[#22C55E] to-[#16A34A] rounded-2xl p-5 text-white">
                                <h4 className="font-bold mb-1">Account</h4>
                                <p className="text-xs text-white/80 mb-4">Sign out of the dashboard</p>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        await authClient.signOut();
                                        window.location.href = '/';
                                    }}
                                    className="w-full bg-white text-[#22C55E] py-2 rounded-xl text-xs font-bold hover:bg-gray-50 transition flex items-center justify-center gap-2"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Logout
                                </button>
                            </div>
                        </div>
                    </div>
                </aside>

                <main className="flex-1 lg:ml-64 min-w-0 flex flex-col">{children}</main>
            </div>
            <PlatformFeedbackModal
                open={feedbackOpen}
                onClose={() => {
                    setFeedbackOpen(false);
                    setFeedbackContext(undefined);
                }}
                context={feedbackContext}
            />
            </SidebarContext.Provider>
        </DashboardAuthGuard>
    );
}

function OrgSwitcher() {
    const router = useRouter();
    const { data: session } = authClient.useSession();
    const [orgs, setOrgs] = React.useState<{ id: string; name: string; slug: string }[]>([]);
    const [loading, setLoading] = React.useState(true);
    const activeSlug = (session?.user as SessionUser)?.activeOrganizationSlug;

    React.useEffect(() => {
        setLoading(true);
        fetch('/api/orgs', { credentials: 'include' })
            .then((r) => r.json())
            .then((d) => {
                if (d.organizations) {
                    setOrgs(
                        d.organizations.map((o: { id: string; name: string; slug: string }) => ({
                            id: o.id,
                            name: o.name,
                            slug: o.slug,
                        }))
                    );
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <p className="text-xs text-gray-400 mt-3">Loading orgs…</p>;
    }

    if (orgs.length === 0) {
        return (
            <div className="mt-3 space-y-1">
                <p className="text-xs text-gray-500">No organization yet.</p>
                <Link
                    href="/settings"
                    className="text-xs font-medium text-[#22C55E] hover:underline"
                >
                    Create in Settings
                </Link>
            </div>
        );
    }

    const resolvedSlug =
        activeSlug && orgs.some((o) => o.slug === activeSlug) ? activeSlug : orgs[0].slug;
    const activeOrg = orgs.find((o) => o.slug === resolvedSlug) ?? orgs[0];

    return (
        <div className="mt-3 space-y-1">
            <label htmlFor="org-switch" className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Active organization
            </label>
            <select
                id="org-switch"
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white text-gray-900"
                value={activeOrg.slug}
                onChange={async (e) => {
                    const org = orgs.find((o) => o.slug === e.target.value);
                    if (!org) return;
                    await fetch('/api/orgs/switch', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ organizationId: org.id }),
                    });
                    router.refresh();
                    window.location.href = `/${org.slug}/events`;
                }}
            >
                {orgs.map((o) => (
                    <option key={o.id} value={o.slug}>
                        {o.name}
                    </option>
                ))}
            </select>
            <Link href="/settings" className="block text-xs text-gray-500 hover:text-[#22C55E]">
                Manage organizations
            </Link>
        </div>

    );
}

export { PERMISSION_MAP, NAV_ITEMS } from './dashboard-nav-legacy';
