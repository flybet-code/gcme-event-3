'use client'
import React, { useEffect, useState } from 'react';
import { authClient } from "@/lib/auth-client";
import {
    UsersRound, Plus, Trash2, Save, RefreshCw, ArrowLeft,
    LayoutDashboard, Users, UserCheck, FileText,
    UserPlus, ShieldCheck, Settings, HelpCircle,
    Building2, CheckCircle2, AlertCircle, ChevronDown,
    Edit2, X, Check, Store, Info, Tags, Search, ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { DashboardMobileMenuButton } from '@/components/DashboardLayout';
import { AuthGate } from '@/components/AuthGate';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';

interface Group {
    id?: string;
    name: string;
    description: string;
    roles: string[];
    paymentStatuses: string[];
    coupons: string[];
    registrationIds: number[];
    vendorId?: string;
    vendor?: { name: string };
    _count?: {
        registrations: number;
        attendees: number;
    }
}

const AVAILABLE_ROLES = [
    'Student',
    'Church Leader/Minister',
    'Church Leader',
    'Professional',
    'Staff',
    'Ministry Partners',
    'Associates',
    'Women leaders',
    'Youths leaders',
    'Event Coordinators',
    'Media',
    'Speakers'
];

export default function GroupManagementPage() {
    const { data: session } = authClient.useSession();
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [assigning, setAssigning] = useState(false);
    const [permissions, setPermissions] = useState<string[]>([]);
    const [currentRole, setCurrentRole] = useState('');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Group>({
        name: '',
        description: '',
        roles: [],
        paymentStatuses: [],
        coupons: [],
        registrationIds: [],
        vendorId: ''
    });
    const [vendors, setVendors] = useState<{ id: string, name: string }[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [foundUsers, setFoundUsers] = useState<any[]>([]);
    const [searchingUsers, setSearchingUsers] = useState(false);
    const [couponInput, setCouponInput] = useState('');
    const [idInput, setIdInput] = useState('');

    const pathname = usePathname();

    const navItems = [
        { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
        { href: "/admin-register", label: "New Registration", icon: UserPlus },
        { href: "/history", label: "All Registration", icon: Users },
        { href: "/groups", label: "Groups", icon: UsersRound },
        { href: "/vendors", label: "Vendors", icon: Store },
        { href: "/badges", label: "Badges", icon: FileText },
        { href: "/attendance", label: "Check-In", icon: UserCheck },
        { href: "/batches", label: "Batch and Prefix", icon: Tags },
        { href: "/users", label: "User Management", icon: ShieldCheck },
    ];

    // Use session-based permissions instead of separate fetch
    useEffect(() => {
        if (session?.user) {
            setPermissions((session.user as any).permissions || []);
            setCurrentRole((session.user as any).role || '');
        }
        if (session) {
            fetchGroups();
            fetchVendors();
        }
    }, [sessionUserId]);

    const fetchVendors = async () => {
        try {
            const res = await fetch('/api/vendors');
            const data = await res.json();
            setVendors(data);
        } catch (error) {
            console.error('Error fetching vendors:', error);
        }
    };


    const fetchGroups = async () => {
        try {
            const res = await fetch('/api/groups');
            const data = await res.json();
            setGroups(data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching groups:', error);
            setLoading(false);
        }
    };

    const handleSaveGroup = async () => {
        if (!editingGroup.name) {
            alert('Please fill in Group Name');
            return;
        }

        try {
            const res = await fetch('/api/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingGroup)
            });
            if (res.ok) {
                alert('Group saved successfully');
                setShowModal(false);
                fetchGroups();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to save group');
            }
        } catch (error) {
            alert('Error saving group');
        }
    };

    const handleDeleteGroup = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete the group "${name}"? This will unassign all users from this group.`)) return;

        try {
            const res = await fetch(`/api/groups/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                alert('Group deleted successfully');
                fetchGroups();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete group');
            }
        } catch (error) {
            alert('Error deleting group');
        }
    };

    const handleRunAssignment = async () => {
        if (!confirm('This will re-evaluate all participants and assign them to groups based on the defined rules. Existing assignments will be overwritten. Proceed?')) return;

        setAssigning(true);
        try {
            const res = await fetch('/api/groups/assign', { method: 'POST' });
            if (res.ok) {
                alert('Group assignments updated successfully!');
                fetchGroups(); // Refresh to see counts
            } else {
                const data = await res.json();
                alert(data.error || 'Assignment failed');
            }
        } catch (error) {
            alert('Error during group assignment');
        } finally {
            setAssigning(false);
        }
    };

    const toggleRole = (role: string) => {
        setEditingGroup(prev => {
            const roles = prev.roles.includes(role)
                ? prev.roles.filter(r => r !== role)
                : [...prev.roles, role];
            return { ...prev, roles };
        });
    };

    const toggleStatus = (status: string) => {
        setEditingGroup(prev => {
            const paymentStatuses = prev.paymentStatuses.includes(status)
                ? prev.paymentStatuses.filter(s => s !== status)
                : [...prev.paymentStatuses, status];
            return { ...prev, paymentStatuses };
        });
    };

    const handleCouponsChange = (value: string) => {
        setCouponInput(value);
        const coupons = value.split(',').map(c => c.toUpperCase().trim()).filter(c => c !== '');
        setEditingGroup(prev => ({ ...prev, coupons }));
    };

    const handleIdsChange = (value: string) => {
        setIdInput(value);
        const registrationIds = value.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        setEditingGroup(prev => ({ ...prev, registrationIds }));
    };

    const searchUsers = async (query: string) => {
        setUserSearch(query);
        if (query.length < 2) {
            setFoundUsers([]);
            return;
        }
        setSearchingUsers(true);
        try {
            const res = await fetch(`/api/register_church_summit?search=${encodeURIComponent(query)}&limit=5`);
            const data = await res.json();
            setFoundUsers(data.data || []);
        } catch (error) {
            console.error('Error searching users:', error);
        } finally {
            setSearchingUsers(false);
        }
    };

    const toggleUserId = (id: number) => {
        setEditingGroup(prev => {
            const registrationIds = prev.registrationIds.includes(id)
                ? prev.registrationIds.filter(rid => rid !== id)
                : [...prev.registrationIds, id];
            return { ...prev, registrationIds };
        });
    };

    const openEditModal = (group: Group) => {
        setEditingGroup({ ...group });
        setCouponInput(group.coupons.join(', '));
        setIdInput(group.registrationIds.join(', '));
        setShowModal(true);
    };

    const openCreateModal = () => {
        setEditingGroup({
            name: '',
            description: '',
            roles: [],
            paymentStatuses: [],
            coupons: [],
            registrationIds: [],
            vendorId: ''
        });
        setCouponInput('');
        setIdInput('');
        setShowModal(true);
    };



    const su = session?.user as { isPlatformSuperAdmin?: boolean; legacyRole?: string; role?: string } | undefined;
    const isPlatformAdmin = hasPlatformElevatedAccess(su?.isPlatformSuperAdmin, su?.legacyRole ?? su?.role);
    const canManageGroups = isPlatformAdmin || permissions.includes('manage_groups') || permissions.includes('edit_registrations');

    return (
        <>
                <header className="bg-white border-b border-gray-100 px-8 py-6 sticky top-0 z-30 flex justify-between items-center flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <DashboardMobileMenuButton />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Group Management</h1>
                        <p className="text-gray-500 text-sm">Categorize participants automatically based on rules</p>
                    </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {canManageGroups && (
                            <>
                                <button
                                    onClick={openCreateModal}
                                    className="bg-[#22C55E] hover:bg-[#1DAE50] text-white px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-[#22C55E]/20"
                                >
                                    <Plus className="w-5 h-5" />
                                    New Group
                                </button>
                                <button
                                    onClick={handleRunAssignment}
                                    disabled={assigning}
                                    className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
                                >
                                    {assigning ? <RefreshCw className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                                    Sync Assignments
                                </button>
                            </>
                        )}
                    </div>
                </header>

                <div className="p-8">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <RefreshCw className="w-8 h-8 text-[#22C55E] animate-spin" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {groups.map((group) => (
                                <div key={group.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-[#F0FDF4] rounded-2xl flex items-center justify-center">
                                                    <UsersRound className="w-6 h-6 text-[#22C55E]" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-lg text-gray-800">{group.name}</h3>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-xs text-gray-400 truncate max-w-[120px]">{group.description || 'No description'}</p>
                                                        {group.vendor && (
                                                            <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                                                                <Store className="w-2.5 h-2.5" />
                                                                {group.vendor.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {canManageGroups && (
                                                <div className="flex gap-1">
                                                    <button onClick={() => openEditModal(group)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition">
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => group.id && handleDeleteGroup(group.id, group.name)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 mb-2">
                                            <div className="p-3 bg-gray-50 rounded-2xl text-center">
                                                <p className="text-xs text-gray-400 font-medium">Participants</p>
                                                <p className="text-lg font-bold text-gray-800">
                                                    {(group._count?.registrations || 0) + (group._count?.attendees || 0)}
                                                </p>
                                            </div>
                                            <div className="p-3 bg-gray-50 rounded-2xl text-center">
                                                <p className="text-xs text-gray-400 font-medium">Rules</p>
                                                <p className="text-lg font-bold text-[#22C55E]">
                                                    {(group.roles.length > 0 ? 1 : 0) + (group.paymentStatuses.length > 0 ? 1 : 0) + (group.coupons.length > 0 ? 1 : 0) + (group.registrationIds.length > 0 ? 1 : 0)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {group.roles.length > 0 && (
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Roles</label>
                                                    <div className="flex flex-wrap gap-1">
                                                        {group.roles.map((r, i) => <span key={i} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md border border-blue-100">{r}</span>)}
                                                    </div>
                                                </div>
                                            )}
                                            {group.coupons.length > 0 && (
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Coupons</label>
                                                    <div className="flex flex-wrap gap-1">
                                                        {group.coupons.map((c, i) => <span key={i} className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-md border border-purple-100">{c}</span>)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
                    <div className="relative bg-white w-full max-w-xl rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-8 border-b border-gray-50">
                            <h3 className="text-xl font-bold text-gray-900">{editingGroup.id ? 'Edit Group' : 'Create New Group'}</h3>
                            <p className="text-sm text-gray-500">Define criteria for automatic member assignment</p>
                        </div>

                        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Group Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., VIP Delegates"
                                        value={editingGroup.name}
                                        onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-[#22C55E] outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                                    <input
                                        type="text"
                                        placeholder="Optional description"
                                        value={editingGroup.description}
                                        onChange={(e) => setEditingGroup({ ...editingGroup, description: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-[#22C55E] outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-3">Filter by Roles</label>
                                    <div className="flex flex-wrap gap-2">
                                        {AVAILABLE_ROLES.map(role => {
                                            const isSelected = editingGroup.roles.includes(role);
                                            return (
                                                <button
                                                    key={role}
                                                    onClick={() => toggleRole(role)}
                                                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition ${isSelected ? 'bg-[#22C55E] border-[#22C55E] text-white' : 'bg-white border-gray-200 text-gray-600'}`}
                                                >
                                                    {role}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Filter by Coupons (Comma separated)</label>
                                    <input
                                        type="text"
                                        placeholder="FREE2026, SPONSOR"
                                        value={couponInput}
                                        onChange={(e) => handleCouponsChange(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-[#22C55E] outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Specific Registration IDs</label>
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {editingGroup.registrationIds.map(id => (
                                                <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-[#F0FDF4] text-[#22C55E] text-xs font-bold rounded-lg border border-[#BBF7D0]">
                                                    #{id}
                                                    <button onClick={() => toggleUserId(id)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                                                </span>
                                            ))}
                                        </div>
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Search by name or phone to add..."
                                                value={userSearch}
                                                onChange={(e) => searchUsers(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-[#22C55E] outline-none transition"
                                            />
                                            {searchingUsers && <RefreshCw className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#22C55E] animate-spin" />}
                                        </div>

                                        {foundUsers.length > 0 && (
                                            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
                                                {foundUsers.map(user => {
                                                    const isSelected = editingGroup.registrationIds.includes(user.id);
                                                    return (
                                                        <button
                                                            key={user.id}
                                                            onClick={() => {
                                                                toggleUserId(user.id);
                                                                setUserSearch('');
                                                                setFoundUsers([]);
                                                            }}
                                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between transition"
                                                        >
                                                            <div>
                                                                <p className="text-sm font-bold text-gray-800">{user.fullName}</p>
                                                                <p className="text-[10px] text-gray-400">{user.churchName} • {user.phoneNumber}</p>
                                                            </div>
                                                            {isSelected ? <Check className="w-4 h-4 text-[#22C55E]" /> : <Plus className="w-4 h-4 text-gray-300" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Payment Statuses</label>
                                    <div className="flex gap-2">
                                        {['PAY_SUCCESS', 'pending'].map(status => {
                                            const isSelected = editingGroup.paymentStatuses.includes(status);
                                            return (
                                                <button
                                                    key={status}
                                                    onClick={() => toggleStatus(status)}
                                                    className={`px-4 py-2 rounded-xl border text-xs font-bold transition ${isSelected ? 'bg-amber-100 border-amber-500 text-amber-700' : 'bg-white border-gray-200 text-gray-500'}`}
                                                >
                                                    {status === 'PAY_SUCCESS' ? 'Completed' : 'Pending'}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Automatic Vendor Allocation</label>
                                    <div className="relative">
                                        <select
                                            value={editingGroup.vendorId || ''}
                                            onChange={(e) => setEditingGroup({ ...editingGroup, vendorId: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-[#22C55E] outline-none transition appearance-none"
                                        >
                                            <option value="">No automatic allocation</option>
                                            {vendors.map(v => (
                                                <option key={v.id} value={v.id}>{v.name}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                                    </div>
                                    <p className="mt-2 text-[10px] text-gray-400 flex items-center gap-1">
                                        <Info className="w-3 h-3" />
                                        Members assigned to this group will be automatically allocated to this vendor.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 border-t border-gray-50 flex gap-3">
                            <button onClick={handleSaveGroup} className="flex-1 bg-[#22C55E] text-white py-3 rounded-2xl font-bold shadow-lg shadow-[#22C55E]/10">
                                Save Group
                            </button>
                            <button onClick={() => setShowModal(false)} className="px-6 bg-gray-100 text-gray-600 rounded-2xl font-bold">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
