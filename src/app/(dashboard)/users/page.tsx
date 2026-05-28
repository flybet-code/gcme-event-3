'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { authClient } from "@/lib/auth-client";
import { Users, ShieldCheck, UserPlus, Mail, Trash2, CheckCircle2, ChevronRight, Plus, KeyRound, Loader2, MessageSquareHeart } from 'lucide-react';
import { PlatformFeedbackModal } from '@/components/PlatformFeedbackModal';
import { DashboardMobileMenuButton } from '@/components/DashboardLayout';
import { AuthGate } from '@/components/AuthGate';
import { hasPlatformElevatedAccess, hasStrictPlatformSuperAdminAccess } from '@/lib/platform-app-role';

interface Role {
    id: string;
    name: string;
    description: string;
    permissions: Permission[];
    _count: { users: number };
}

interface Permission {
    id: string;
    name: string;
    description: string;
}

interface User {
    id: string;
    name: string;
    email: string;
    role?: Role;
    createdAt: string;
    /** Active-organization membership (from /api/admin/users) */
    orgRole?: string;
    memberSince?: string;
}

interface Invitation {
    id: string;
    email: string;
    token: string;
    expiresAt: string;
    used: boolean;
    createdAt: string;
}

interface OrgInvitation {
    id: string;
    email: string;
    token: string;
    expiresAt: string;
    used: boolean;
    createdAt: string;
    role: string;
    organization?: { name: string; slug: string };
}

export default function UserManagementPage() {
    const { data: session } = authClient.useSession();
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'invites'>('users');
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [invites, setInvites] = useState<Invitation[]>([]);
    const [orgInvites, setOrgInvites] = useState<OrgInvitation[]>([]);
    const [loading, setLoading] = useState(true);

    // Form states
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [inviteMode, setInviteMode] = useState<'platform' | 'org'>('org');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('');
    const [orgInviteRole, setOrgInviteRole] = useState<'ADMIN' | 'STAFF'>('STAFF');

    // Role Form states
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
    const [roleName, setRoleName] = useState('');
    const [roleDescription, setRoleDescription] = useState('');
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [isSubmittingRole, setIsSubmittingRole] = useState(false);
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [editingPermissionId, setEditingPermissionId] = useState<string | null>(null);
    const [permissionName, setPermissionName] = useState('');
    const [permissionDescription, setPermissionDescription] = useState('');
    const [isSubmittingPermission, setIsSubmittingPermission] = useState(false);

    // Auth Check
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<string>('');
    const [isPlatformSuperAdmin, setIsPlatformSuperAdmin] = useState(false);
    const [canViewPlatformFeedback, setCanViewPlatformFeedback] = useState(false);
    const [canInviteOrg, setCanInviteOrg] = useState(false);
    const [canManageRoles, setCanManageRoles] = useState(false);
    const [canRequestPasswordReset, setCanRequestPasswordReset] = useState(false);
    const [resettingUserId, setResettingUserId] = useState<string | null>(null);
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

    useEffect(() => {
        if (session?.user) {
            const u = session.user as {
                permissions?: string[];
                role?: string;
                legacyRole?: string;
                orgRole?: string | null;
                orgPermissions?: string[];
                isPlatformSuperAdmin?: boolean;
            };
            const userPerms = u.permissions || [];
            const legacyRole = u.legacyRole || u.role || '';
            setCurrentUserRole(legacyRole);
            const plat = hasPlatformElevatedAccess(u.isPlatformSuperAdmin, legacyRole);
            const strictSuperAdmin = hasStrictPlatformSuperAdminAccess(u.isPlatformSuperAdmin, legacyRole);
            setIsPlatformSuperAdmin(strictSuperAdmin);
            setCanViewPlatformFeedback(
                Boolean((u as { canViewPlatformFeedback?: boolean }).canViewPlatformFeedback)
            );
            const orgRole = u.orgRole;
            const orgPerms = u.orgPermissions || [];
            const hasOrgInvite =
                orgRole === 'OWNER' ||
                orgRole === 'ADMIN' ||
                orgPerms.includes('manage_users');
            setCanInviteOrg(hasOrgInvite || plat);
            const hasRoleAccess =
                orgRole === 'OWNER' ||
                orgRole === 'ADMIN' ||
                orgPerms.includes('manage_roles');
            setCanManageRoles(hasRoleAccess || plat);
            setCanRequestPasswordReset(hasOrgInvite || plat);

            const canAccess = plat || hasOrgInvite || userPerms.includes('manage_users');

            if (canAccess) {
                setIsAuthorized(true);
                fetchData();
            } else {
                setIsAuthorized(false);
            }
        }
    }, [sessionUserId]);

    const fetchData = async () => {
        setLoading(true);
        const u = session?.user as {
            isPlatformSuperAdmin?: boolean;
            legacyRole?: string;
            role?: string;
            orgRole?: string | null;
            orgPermissions?: string[];
        } | undefined;
        const plat = hasPlatformElevatedAccess(u?.isPlatformSuperAdmin, u?.legacyRole ?? u?.role);
        const strictSuperAdmin = hasStrictPlatformSuperAdminAccess(
            u?.isPlatformSuperAdmin,
            u?.legacyRole ?? u?.role
        );
        const orgPerms = u?.orgPermissions || [];
        const orgRole = u?.orgRole;
        const inviteOrg =
            plat ||
            orgRole === 'OWNER' ||
            orgRole === 'ADMIN' ||
            orgPerms.includes('manage_users');

        try {
            const usersRes = await fetch('/api/admin/users', { credentials: 'include' });
            const usersData = await usersRes.json();
            setUsers(usersData.data || []);

            if (plat || inviteOrg || orgPerms.includes('manage_roles')) {
                const [rolesRes, permsRes] = await Promise.all([
                    fetch('/api/admin/roles', { credentials: 'include' }),
                    fetch('/api/admin/permissions', { credentials: 'include' }),
                ]);
                const rolesData = await rolesRes.json();
                const permsData = await permsRes.json();
                setRoles(rolesData.data || []);
                setPermissions(permsData.data || []);
            } else {
                setRoles([]);
                setPermissions([]);
            }

            if (strictSuperAdmin) {
                const invitesRes = await fetch('/api/admin/invitations', { credentials: 'include' });
                const invitesData = await invitesRes.json();
                setInvites(invitesData.data || []);
            } else {
                setInvites([]);
            }

            if (inviteOrg) {
                const orgRes = await fetch('/api/orgs/invitations', { credentials: 'include' });
                if (orgRes.ok) {
                    const orgData = await orgRes.json();
                    setOrgInvites(orgData.data || []);
                } else {
                    setOrgInvites([]);
                }
            } else {
                setOrgInvites([]);
            }
        } catch (error) {
            console.error('Error fetching admin data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSendInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (inviteMode === 'platform') {
                const roleId = inviteRole || roles[0]?.id;
                if (!roleId) {
                    console.error('No app roles loaded yet');
                    return;
                }
                const res = await fetch('/api/admin/invitations', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: inviteEmail, roleId }),
                });
                if (res.ok) {
                    setShowInviteModal(false);
                    setInviteEmail('');
                    setInviteRole('');
                    fetchData();
                }
            } else {
                const res = await fetch('/api/orgs/invitations', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: inviteEmail, role: orgInviteRole }),
                });
                if (res.ok) {
                    setShowInviteModal(false);
                    setInviteEmail('');
                    fetchData();
                }
            }
        } catch (error) {
            console.error('Invite error:', error);
        }
    };

    const handleSaveRole = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmittingRole(true);
        try {
            const method = editingRoleId ? 'PUT' : 'POST';
            const body = {
                id: editingRoleId,
                name: roleName,
                description: roleDescription,
                permissionIds: selectedPermissions
            };

            const res = await fetch('/api/admin/roles', {
                method,
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                setShowRoleModal(false);
                setEditingRoleId(null);
                setRoleName('');
                setRoleDescription('');
                setSelectedPermissions([]);
                fetchData();
            }
        } catch (error) {
            console.error('Save role error:', error);
        } finally {
            setIsSubmittingRole(false);
        }
    };

    const openCreateRoleModal = () => {
        setEditingRoleId(null);
        setRoleName('');
        setRoleDescription('');
        setSelectedPermissions([]);
        setShowRoleModal(true);
    };

    const handleEditRole = (role: Role) => {
        setEditingRoleId(role.id);
        setRoleName(role.name);
        setRoleDescription(role.description);
        setSelectedPermissions(role.permissions.map(p => p.id));
        setShowRoleModal(true);
    };

    const handleDeleteRole = async (roleId: string) => {
        if (!confirm('Are you sure you want to delete this role?')) return;
        try {
            const res = await fetch(`/api/admin/roles?id=${roleId}`, { method: 'DELETE', credentials: 'include' });
            if (res.ok) fetchData();
        } catch (error) {
            console.error('Delete role error:', error);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Remove this member from the active organization? Their login account is not deleted.')) return;
        try {
            const res = await fetch(`/api/admin/users?id=${userId}`, { method: 'DELETE', credentials: 'include' });
            if (res.ok) fetchData();
        } catch (error) {
            console.error('Delete user error:', error);
        }
    };

    const handleRequestPasswordReset = async (user: User) => {
        if (
            !confirm(
                `Send a password reset email to ${user.email}? They will choose a new password from the link in that email.`
            )
        ) {
            return;
        }
        setResettingUserId(user.id);
        try {
            const res = await fetch('/api/admin/users/request-password-reset', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                alert((data as { error?: string }).error || 'Could not send password reset email');
                return;
            }
            alert((data as { message?: string }).message || 'Password reset email sent.');
        } catch (error) {
            console.error('Password reset request error:', error);
            alert('Could not send password reset email');
        } finally {
            setResettingUserId(null);
        }
    };

    const handleUpdateUserAppRole = async (userId: string, appRoleId: string) => {
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, appRoleId }),
            });
            if (res.ok) fetchData();
        } catch (error) {
            console.error('Update app role error:', error);
        }
    };

    const openCreatePermissionModal = () => {
        setEditingPermissionId(null);
        setPermissionName('');
        setPermissionDescription('');
        setShowPermissionModal(true);
    };

    const openEditPermissionModal = (permission: Permission) => {
        setEditingPermissionId(permission.id);
        setPermissionName(permission.name);
        setPermissionDescription(permission.description || '');
        setShowPermissionModal(true);
    };

    const handleSavePermission = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmittingPermission(true);
        try {
            const method = editingPermissionId ? 'PUT' : 'POST';
            const body = {
                id: editingPermissionId,
                name: permissionName,
                description: permissionDescription,
            };
            const res = await fetch('/api/admin/permissions', {
                method,
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                setShowPermissionModal(false);
                setEditingPermissionId(null);
                setPermissionName('');
                setPermissionDescription('');
                fetchData();
            }
        } catch (error) {
            console.error('Save permission error:', error);
        } finally {
            setIsSubmittingPermission(false);
        }
    };

    const handleDeletePermission = async (permissionId: string) => {
        if (!confirm('Are you sure you want to delete this permission?')) return;
        try {
            const res = await fetch(`/api/admin/permissions?id=${permissionId}`, { method: 'DELETE', credentials: 'include' });
            if (res.ok) fetchData();
        } catch (error) {
            console.error('Delete permission error:', error);
        }
    };

    const handleUpdateUserOrgRole = async (userId: string, orgRole: 'ADMIN' | 'STAFF') => {
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, orgRole }),
            });
            if (res.ok) fetchData();
        } catch (error) {
            console.error('Update org role error:', error);
        }
    };

    const handleDeleteInvite = async (inviteId: string, kind: 'platform' | 'org') => {
        if (!confirm('Are you sure you want to revoke this invitation?')) return;
        try {
            const url =
                kind === 'platform'
                    ? `/api/admin/invitations?id=${inviteId}`
                    : `/api/orgs/invitations?id=${inviteId}`;
            const res = await fetch(url, { method: 'DELETE', credentials: 'include' });
            if (res.ok) fetchData();
        } catch (error) {
            console.error('Delete invite error:', error);
        }
    };

    const togglePermission = (permId: string) => {
        setSelectedPermissions(prev =>
            prev.includes(permId)
                ? prev.filter(id => id !== permId)
                : [...prev, permId]
        );
    };

    useEffect(() => {
        if (!canManageRoles && activeTab === 'roles') {
            setActiveTab('users');
        }
    }, [canManageRoles, activeTab]);


    if (isAuthorized === null) return <div className="p-10 text-center">Loading permissions...</div>;
    if (isAuthorized === false) return (
        <AuthGate
            variant="forbidden"
            title="Access denied"
            message="You do not have permission to manage users."
            actionLabel="Back to Dashboard"
            actionHref="/dashboard"
        />
    );

    return (
        <>
                <header className="bg-white border-b border-gray-100 px-4 lg:px-8 py-6 sticky top-0 z-30 flex justify-between items-center flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <DashboardMobileMenuButton />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
                            <p className="text-gray-500 text-sm">
                                Team list and org invitations follow your <strong>active organization</strong>. Global roles
                                and platform invites are available to platform super admins.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setShowFeedbackModal(true)}
                            className="bg-white border border-slate-200 hover:border-[#22C55E] hover:text-[#22C55E] text-slate-700 px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2"
                        >
                            <MessageSquareHeart className="w-5 h-5" />
                            Share feedback
                        </button>
                        {canViewPlatformFeedback && (
                            <Link
                                href="/platform-feedback"
                                className="bg-slate-700 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2"
                            >
                                <MessageSquareHeart className="w-5 h-5" />
                                View all feedback
                            </Link>
                        )}
                        {canInviteOrg && (
                            <button
                                type="button"
                                onClick={() => {
                                    setInviteMode('org');
                                    setShowInviteModal(true);
                                }}
                                className="bg-[#22C55E] hover:bg-[#1DAE50] text-white px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-[#22C55E]/20"
                            >
                                <UserPlus className="w-5 h-5" />
                                Invite to organization
                            </button>
                        )}
                        {isPlatformSuperAdmin && (
                            <button
                                type="button"
                                onClick={() => {
                                    setInviteMode('platform');
                                    setInviteRole((prev) => prev || roles[0]?.id || '');
                                    setShowInviteModal(true);
                                }}
                                className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2"
                            >
                                <UserPlus className="w-5 h-5" />
                                Global invite (app role)
                            </button>
                        )}
                        {canInviteOrg && selectedMemberIds.length > 0 && (
                            <Link
                                href={`/messages?userIds=${selectedMemberIds.join(',')}`}
                                className="bg-slate-700 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2"
                            >
                                <Mail className="w-5 h-5" />
                                Email selected ({selectedMemberIds.length})
                            </Link>
                        )}
                    </div>
                </header>

                <div className="max-w-7xl px-4 lg:px-8 py-6 lg:py-10">
                    {/* Tabs */}
                    <div className="flex flex-wrap bg-slate-100 p-1.5 rounded-[20px] w-fit mb-6 lg:mb-8 gap-1">
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`px-4 lg:px-8 py-2 lg:py-2.5 rounded-[16px] text-xs lg:text-sm font-bold transition flex items-center gap-1 lg:gap-2 ${activeTab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Users className="w-4 h-4" /> <span className="hidden sm:inline">Team </span>Members
                        </button>
                        {canManageRoles && (
                            <button
                                type="button"
                                onClick={() => setActiveTab('roles')}
                                className={`px-4 lg:px-8 py-2 lg:py-2.5 rounded-[16px] text-xs lg:text-sm font-bold transition flex items-center gap-1 lg:gap-2 ${activeTab === 'roles' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <ShieldCheck className="w-4 h-4" /> Roles
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab('invites')}
                            className={`px-4 lg:px-8 py-2 lg:py-2.5 rounded-[16px] text-xs lg:text-sm font-bold transition flex items-center gap-1 lg:gap-2 ${activeTab === 'invites' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Mail className="w-4 h-4" /> <span className="hidden sm:inline">Pending </span>Invites
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="bg-white rounded-2xl lg:rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                        {activeTab === 'users' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-[#FBFCFD] border-b border-slate-100">
                                        <tr>
                                            <th className="px-4 py-5 w-10"></th><th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Member Info</th>
                                            {isPlatformSuperAdmin && (
                                                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">App role</th>
                                            )}
                                            <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Org role</th>
                                            <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">In org since</th>
                                            <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {users.map(user => (
                                            <tr key={user.id} className="hover:bg-[#F8FAFC] transition">
                                                <td className="px-4 py-6">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedMemberIds.includes(user.id)}
                                                        onChange={() => {
                                                            setSelectedMemberIds((prev) =>
                                                                prev.includes(user.id)
                                                                    ? prev.filter((id) => id !== user.id)
                                                                    : [...prev, user.id]
                                                            );
                                                        }}
                                                        className="w-4 h-4 accent-[#22C55E]"
                                                    />
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-600">
                                                            {user.name?.[0] || user.email[0].toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-900">{user.name || 'No Name'}</div>
                                                            <div className="text-sm text-slate-500">{user.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                {isPlatformSuperAdmin && (
                                                    <td className="px-8 py-6">
                                                        <select
                                                            value={user.role?.id || ''}
                                                            onChange={(e) => handleUpdateUserAppRole(user.id, e.target.value)}
                                                            className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white"
                                                        >
                                                            <option value="">No role</option>
                                                            {roles.map((r) => (
                                                                <option key={r.id} value={r.id}>
                                                                    {r.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                )}
                                                <td className="px-8 py-6">
                                                    {canManageRoles && user.id !== sessionUserId && user.orgRole !== 'OWNER' ? (
                                                        <select
                                                            value={(user.orgRole as 'ADMIN' | 'STAFF' | undefined) || 'STAFF'}
                                                            onChange={(e) =>
                                                                handleUpdateUserOrgRole(user.id, e.target.value as 'ADMIN' | 'STAFF')
                                                            }
                                                            className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white"
                                                        >
                                                            <option value="STAFF">STAFF</option>
                                                            <option value="ADMIN">ADMIN</option>
                                                        </select>
                                                    ) : (
                                                        <span className="bg-slate-50 text-slate-800 px-3 py-1 rounded-full text-xs font-bold border border-slate-200">
                                                            {user.orgRole ?? '—'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-8 py-6 text-sm text-slate-500 font-medium">
                                                    {user.memberSince
                                                        ? new Date(user.memberSince).toLocaleDateString()
                                                        : '—'}
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-2">
                                                        {canRequestPasswordReset && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRequestPasswordReset(user)}
                                                                disabled={resettingUserId === user.id}
                                                                className="text-slate-400 hover:text-[#22C55E] transition disabled:opacity-50"
                                                                title="Send password reset email"
                                                            >
                                                                {resettingUserId === user.id ? (
                                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                                ) : (
                                                                    <KeyRound className="w-5 h-5" />
                                                                )}
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteUser(user.id)}
                                                            className="text-slate-400 hover:text-red-500 transition"
                                                            title="Remove from organization"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {users.length === 0 && !loading && (
                                            <tr>
                                                <td colSpan={isPlatformSuperAdmin ? 6 : 5} className="px-8 py-12 text-center text-slate-500">
                                                    No members in the active organization, or choose an organization in the sidebar.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'roles' && canManageRoles && (
                            <div className="p-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {roles.map(role => (
                                        <div key={role.id} className="border border-slate-100 rounded-[24px] p-6 hover:border-[#22C55E]/30 transition group flex flex-col">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="w-12 h-12 bg-[#F0FDF4] rounded-2xl flex items-center justify-center text-[#22C55E] group-hover:scale-110 transition">
                                                    <ShieldCheck className="w-6 h-6" />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-slate-400">{role._count?.users || 0} Members</span>
                                                    <button
                                                        onClick={() => handleDeleteRole(role.id)}
                                                        className="p-1 text-slate-300 hover:text-red-500 transition"
                                                        title="Delete Role"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <h3 className="font-black text-xl text-slate-900 mb-2">{role.name}</h3>
                                            <p className="text-sm text-slate-500 mb-6 leading-relaxed flex-grow">{role.description}</p>

                                            <div className="pt-6 border-t border-slate-50 flex items-center justify-between mt-auto">
                                                <button
                                                    onClick={() => handleEditRole(role)}
                                                    className="text-sm font-bold text-[#22C55E] hover:underline flex items-center gap-1"
                                                >
                                                    Edit Permissions <ChevronRight className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        onClick={openCreateRoleModal}
                                        className="border-2 border-dashed border-slate-200 rounded-[24px] p-6 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-[#22C55E] hover:text-[#22C55E] transition group min-h-[250px]"
                                    >
                                        <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center group-hover:border-[#22C55E]">
                                            <Plus className="w-6 h-6" />
                                        </div>
                                        <span className="font-bold">Create New Role</span>
                                    </button>
                                    <button
                                        onClick={openCreatePermissionModal}
                                        className="border-2 border-dashed border-slate-200 rounded-[24px] p-6 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-[#22C55E] hover:text-[#22C55E] transition group min-h-[250px]"
                                    >
                                        <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center group-hover:border-[#22C55E]">
                                            <Plus className="w-6 h-6" />
                                        </div>
                                        <span className="font-bold">Create Permission</span>
                                    </button>
                                </div>
                                {permissions.length > 0 && (
                                    <div className="mt-8">
                                        <h3 className="text-lg font-bold text-slate-900 mb-3">Permissions</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {permissions.map((perm) => (
                                                <div key={perm.id} className="rounded-xl border border-slate-100 p-4 flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="font-semibold text-slate-900">{perm.name}</p>
                                                        <p className="text-xs text-slate-500">{perm.description || 'No description'}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            className="text-xs text-[#22C55E] font-bold hover:underline"
                                                            onClick={() => openEditPermissionModal(perm)}
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="text-xs text-red-500 font-bold hover:underline"
                                                            onClick={() => handleDeletePermission(perm.id)}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'invites' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-[#FBFCFD] border-b border-slate-100">
                                        <tr>
                                            <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Email / Scope</th>
                                            <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Expires In</th>
                                            <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                                            <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {isPlatformSuperAdmin && invites.length > 0 && (
                                            <tr className="bg-slate-50">
                                                <td colSpan={4} className="px-8 py-3 text-xs font-black text-slate-400 uppercase tracking-widest">
                                                    Global (app invitation)
                                                </td>
                                            </tr>
                                        )}
                                        {isPlatformSuperAdmin &&
                                            invites.map((invite) => (
                                                <tr key={`p-${invite.id}`} className="hover:bg-[#F8FAFC] transition">
                                                    <td className="px-8 py-6 font-bold text-slate-900">{invite.email}</td>
                                                    <td className="px-8 py-6 text-sm text-slate-500 font-medium">
                                                        {Math.ceil(
                                                            (new Date(invite.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                                                        )}{' '}
                                                        Days
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <span
                                                            className={`px-3 py-1 rounded-full text-xs font-bold border ${invite.used ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}
                                                        >
                                                            {invite.used ? 'Used' : 'Pending'}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteInvite(invite.id, 'platform')}
                                                            className="text-slate-400 hover:text-red-500 transition"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        {canInviteOrg && orgInvites.length > 0 && (
                                            <tr className="bg-slate-50">
                                                <td colSpan={4} className="px-8 py-3 text-xs font-black text-slate-400 uppercase tracking-widest">
                                                    Active organization
                                                </td>
                                            </tr>
                                        )}
                                        {canInviteOrg &&
                                            orgInvites.map((invite) => (
                                                <tr key={`o-${invite.id}`} className="hover:bg-[#F8FAFC] transition">
                                                    <td className="px-8 py-6">
                                                        <div className="font-bold text-slate-900">{invite.email}</div>
                                                        <div className="text-xs text-slate-500 mt-1">
                                                            {invite.organization?.name ?? 'Org'} · {invite.role}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6 text-sm text-slate-500 font-medium">
                                                        {Math.ceil(
                                                            (new Date(invite.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                                                        )}{' '}
                                                        Days
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <span
                                                            className={`px-3 py-1 rounded-full text-xs font-bold border ${invite.used ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}
                                                        >
                                                            {invite.used ? 'Used' : 'Pending'}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteInvite(invite.id, 'org')}
                                                            className="text-slate-400 hover:text-red-500 transition"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        {invites.length === 0 && orgInvites.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-8 py-12 text-center text-slate-500">
                                                    No pending invitations.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Invite Modal */}
                {showInviteModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowInviteModal(false)}></div>
                        <div className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                            <div className="p-10">
                                <h2 className="text-2xl font-black text-slate-900 mb-2">
                                    {inviteMode === 'platform' ? 'Global invite (app role)' : 'Invite to organization'}
                                </h2>
                                <p className="text-slate-500 mb-8 leading-relaxed">
                                    {inviteMode === 'platform'
                                        ? 'Platform super admins only. Assign an application role; the invite email will include a sign-up link.'
                                        : 'Invite someone to the active organization with an org role (ADMIN or STAFF).'}
                                </p>

                                <form onSubmit={handleSendInvite} className="space-y-6">
                                    <div>
                                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-2">Email Address</label>
                                        <input
                                            type="email"
                                            required
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-[#22C55E]/10 focus:border-[#22C55E] outline-none font-bold transition"
                                            placeholder="colleague@example.com"
                                        />
                                    </div>
                                    {inviteMode === 'platform' && (
                                        <div>
                                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-2">Assign app role</label>
                                            <select
                                                required
                                                value={inviteRole}
                                                onChange={(e) => setInviteRole(e.target.value)}
                                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-[#22C55E]/10 focus:border-[#22C55E] outline-none font-bold transition appearance-none"
                                            >
                                                <option value="">Select a role...</option>
                                                {roles.map((r) => (
                                                    <option key={r.id} value={r.id}>
                                                        {r.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {inviteMode === 'org' && (
                                        <div>
                                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-2">Organization role</label>
                                            <select
                                                value={orgInviteRole}
                                                onChange={(e) => setOrgInviteRole(e.target.value as 'ADMIN' | 'STAFF')}
                                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-[#22C55E]/10 focus:border-[#22C55E] outline-none font-bold transition appearance-none"
                                            >
                                                <option value="STAFF">Staff</option>
                                                <option value="ADMIN">Org admin</option>
                                            </select>
                                        </div>
                                    )}
                                    <div className="flex gap-4 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowInviteModal(false)}
                                            className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 transition"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 bg-[#22C55E] text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-[#22C55E]/20 hover:scale-[1.02] active:scale-[0.98] transition"
                                        >
                                            Send Invitation
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* Role Modal (Create/Edit) */}
                {showRoleModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowRoleModal(false)}></div>
                        <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                            <div className="p-10">
                                <h2 className="text-2xl font-black text-slate-900 mb-2">{editingRoleId ? 'Edit Role' : 'Create New Role'}</h2>
                                <p className="text-slate-500 mb-8 leading-relaxed">Define role details and permissions.</p>

                                <form onSubmit={handleSaveRole} className="space-y-6">
                                    <div>
                                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-2">Role Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={roleName}
                                            onChange={(e) => setRoleName(e.target.value)}
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-[#22C55E]/10 focus:border-[#22C55E] outline-none font-bold transition"
                                            placeholder="e.g. Editor"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-2">Description</label>
                                        <input
                                            type="text"
                                            required
                                            value={roleDescription}
                                            onChange={(e) => setRoleDescription(e.target.value)}
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-[#22C55E]/10 focus:border-[#22C55E] outline-none font-bold transition"
                                            placeholder="Briefly describe what this role can do"
                                        />
                                    </div>

                                    <div className="pt-2">
                                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-2">Permissions</label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {permissions.map(perm => (
                                                <div
                                                    key={perm.id}
                                                    onClick={() => togglePermission(perm.id)}
                                                    className={`p-4 rounded-xl border-2 flex items-start gap-3 cursor-pointer transition ${selectedPermissions.includes(perm.id) ? 'border-[#22C55E] bg-[#F0FDF4]' : 'border-slate-100 hover:border-slate-200'}`}
                                                >
                                                    <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${selectedPermissions.includes(perm.id) ? 'bg-[#22C55E] border-[#22C55E] text-white' : 'border-slate-300'}`}>
                                                        {selectedPermissions.includes(perm.id) && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                    </div>
                                                    <div>
                                                        <div className={`font-bold text-sm ${selectedPermissions.includes(perm.id) ? 'text-slate-900' : 'text-slate-600'}`}>{perm.name}</div>
                                                        <div className="text-xs text-slate-400 mt-1">{perm.description}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-6 border-t border-slate-50 mt-6">
                                        <button
                                            type="button"
                                            onClick={() => setShowRoleModal(false)}
                                            className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 transition"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSubmittingRole}
                                            className="flex-1 bg-[#22C55E] text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-[#22C55E]/20 hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50"
                                        >
                                            {isSubmittingRole ? 'Saving...' : (editingRoleId ? 'Update Role' : 'Create Role')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {showPermissionModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowPermissionModal(false)}></div>
                        <div className="relative bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                            <div className="p-8">
                                <h2 className="text-2xl font-black text-slate-900 mb-2">
                                    {editingPermissionId ? 'Edit Permission' : 'Create Permission'}
                                </h2>
                                <p className="text-slate-500 mb-6 leading-relaxed">Permission can be assigned to any role.</p>
                                <form onSubmit={handleSavePermission} className="space-y-5">
                                    <div>
                                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-2">Permission Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={permissionName}
                                            onChange={(e) => setPermissionName(e.target.value)}
                                            className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-[#22C55E]/10 focus:border-[#22C55E] outline-none font-bold transition"
                                            placeholder="e.g. approve_refunds"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-2">Description</label>
                                        <input
                                            type="text"
                                            value={permissionDescription}
                                            onChange={(e) => setPermissionDescription(e.target.value)}
                                            className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-[#22C55E]/10 focus:border-[#22C55E] outline-none font-bold transition"
                                            placeholder="Describe what this permission allows"
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowPermissionModal(false)}
                                            className="flex-1 px-6 py-3 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 transition"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSubmittingPermission}
                                            className="flex-1 bg-[#22C55E] text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-[#22C55E]/20 disabled:opacity-50"
                                        >
                                            {isSubmittingPermission ? 'Saving...' : (editingPermissionId ? 'Update Permission' : 'Create Permission')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                <PlatformFeedbackModal
                    open={showFeedbackModal}
                    onClose={() => setShowFeedbackModal(false)}
                />
        </>
    );
}
