'use client'
import React, { useEffect, useState } from 'react';
import { authClient } from "@/lib/auth-client";
import {
    Tags, Plus, Trash2, Save, RefreshCw, ArrowLeft,
    LayoutDashboard, Users, UserCheck, FileText,
    UserPlus, ShieldCheck, Settings, HelpCircle,
    Building2, CheckCircle2, AlertCircle, ChevronDown,
    Edit2, X, Check, Store, UsersRound
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { DashboardMobileMenuButton } from '@/components/DashboardLayout';
import { AuthGate } from '@/components/AuthGate';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';

interface Batch {
    id?: string;
    name: string;
    prefix: number;
    roles: string[];
    paymentStatuses: string[];
    coupons: string[];
    registrationIds: number[];
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
    'Speakers',
    'Guest'
];

export default function BatchManagementPage() {
    const { data: session } = authClient.useSession();
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    const [batches, setBatches] = useState<Batch[]>([]);
    const [loading, setLoading] = useState(true);
    const [reassigning, setReassigning] = useState(false);
    const [permissions, setPermissions] = useState<string[]>([]);
    const [currentRole, setCurrentRole] = useState('');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingBatch, setEditingBatch] = useState<Batch>({
        name: '',
        prefix: 1000,
        roles: [],
        paymentStatuses: [],
        coupons: [],
        registrationIds: []
    });
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
            fetchBatches();
        }
    }, [sessionUserId]);


    const fetchBatches = async () => {
        try {
            const res = await fetch('/api/batches');
            const data = await res.json();
            setBatches(data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching batches:', error);
            setLoading(false);
        }
    };

    const handleSaveBatch = async () => {
        if (!editingBatch.name || isNaN(editingBatch.prefix)) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            const res = await fetch('/api/batches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingBatch)
            });
            if (res.ok) {
                alert('Batch saved successfully');
                setShowModal(false);
                fetchBatches();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to save batch');
            }
        } catch (error) {
            alert('Error saving batch');
        }
    };

    const handleDeleteBatch = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete the batch "${name}"? This will not remove tickets from users, but they won't follow this rule anymore.`)) return;

        try {
            const res = await fetch(`/api/batches/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                alert('Batch deleted successfully');
                fetchBatches();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete batch');
            }
        } catch (error) {
            alert('Error deleting batch');
        }
    };

    const handleReassign = async () => {
        if (!confirm('CRITICAL ACTION: This will recalculate all ticket numbers for ALL registered users based on current batches. Are you sure?')) return;

        setReassigning(true);
        try {
            const res = await fetch('/api/admin/reassign_tickets', { method: 'POST' });
            if (res.ok) {
                alert('All ticket numbers reassigned successfully!');
            } else {
                const data = await res.json();
                alert(data.error || 'Reassignment failed');
            }
        } catch (error) {
            alert('Error during reassignment');
        } finally {
            setReassigning(false);
        }
    };

    const toggleRole = (role: string) => {
        setEditingBatch(prev => {
            const roles = prev.roles.includes(role)
                ? prev.roles.filter(r => r !== role)
                : [...prev.roles, role];
            return { ...prev, roles };
        });
    };

    const toggleStatus = (status: string) => {
        setEditingBatch(prev => {
            const paymentStatuses = prev.paymentStatuses.includes(status)
                ? prev.paymentStatuses.filter(s => s !== status)
                : [...prev.paymentStatuses, status];
            return { ...prev, paymentStatuses };
        });
    };

    const handleCouponsChange = (value: string) => {
        setCouponInput(value);
        const coupons = value.split(',').map(c => c.toUpperCase().trim()).filter(c => c !== '');
        setEditingBatch(prev => ({ ...prev, coupons }));
    };

    const handleIdsChange = (value: string) => {
        setIdInput(value);
        const registrationIds = value.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        setEditingBatch(prev => ({ ...prev, registrationIds }));
    };

    const openEditModal = (batch: Batch) => {
        setEditingBatch({ ...batch });
        setCouponInput(batch.coupons.join(', '));
        setIdInput(batch.registrationIds.join(', '));
        setShowModal(true);
    };

    const openCreateModal = () => {
        setEditingBatch({
            name: '',
            prefix: 1000,
            roles: [],
            paymentStatuses: [],
            coupons: [],
            registrationIds: []
        });
        setCouponInput('');
        setIdInput('');
        setShowModal(true);
    };



    const su = session?.user as { isPlatformSuperAdmin?: boolean; legacyRole?: string; role?: string } | undefined;
    const isPlatformAdmin = hasPlatformElevatedAccess(su?.isPlatformSuperAdmin, su?.legacyRole ?? su?.role);
    const canManage = isPlatformAdmin || permissions.includes('manage_batches');

    return (
        <>
                <header className="bg-white border-b border-gray-100 px-8 py-6 sticky top-0 z-30 flex justify-between items-center flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <DashboardMobileMenuButton />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Group & Batch Management</h1>
                        <p className="text-gray-500 text-sm">Configure ticket rules and categorization groups</p>
                    </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {canManage && (
                            <>
                                <button
                                    onClick={openCreateModal}
                                    className="bg-[#22C55E] hover:bg-[#1DAE50] text-white px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-[#22C55E]/20"
                                >
                                    <Plus className="w-5 h-5" />
                                    New Batch
                                </button>
                                <button
                                    onClick={handleReassign}
                                    disabled={reassigning}
                                    className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
                                >
                                    {reassigning ? <RefreshCw className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                                    Update Existing Badges
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
                    ) : !canManage ? (
                        <div className="bg-red-50 p-6 rounded-2xl border border-red-100 text-red-700 flex items-center gap-3">
                            <AlertCircle className="w-6 h-6" />
                            <p className="font-medium">You do not have permission to modify batch settings. Please contact a Super Admin.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {batches.map((batch) => (
                                <div key={batch.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center">
                                                    <Tags className="w-6 h-6 text-[#22C55E]" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-lg text-gray-800">{batch.name}</h3>
                                                    <p className="text-xs text-gray-400">Prefix: <span className="text-[#22C55E] font-bold">{batch.prefix}</span></p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => openEditModal(batch)}
                                                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => batch.id && handleDeleteBatch(batch.id, batch.name)}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Mapped Roles</label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {batch.roles.length > 0 ? batch.roles.map((role, idx) => (
                                                        <span key={idx} className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-blue-100">
                                                            {role}
                                                        </span>
                                                    )) : (
                                                        <span className="text-xs text-gray-400 italic">All Roles</span>
                                                    )}
                                                </div>
                                            </div>

                                            {(batch.paymentStatuses?.length || 0) > 0 && (
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Payment Statuses</label>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {batch.paymentStatuses.map((status, idx) => (
                                                            <span key={idx} className="bg-amber-50 text-amber-600 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-amber-100">
                                                                {status}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {(batch.coupons?.length || 0) > 0 && (
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Coupons</label>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {batch.coupons.map((coupon, idx) => (
                                                            <span key={idx} className="bg-purple-50 text-purple-600 px-2.5 py-1 rounded-lg text-[11px] font-medium border border-purple-100">
                                                                {coupon}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                    </div>

                                    <div className="mt-6 pt-4 border-t border-gray-50 flex justify-between items-center">
                                        <p className="text-[10px] text-gray-400">Prefix: <span className="font-bold text-[#22C55E]">{batch.prefix}</span></p>
                                        <p className="text-[10px] text-gray-400">Range: <span className="font-medium">{batch.prefix} - {batch.prefix + 9999}</span></p>
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
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-[#F0FDF4] rounded-2xl flex items-center justify-center text-[#22C55E]">
                                        <Tags className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">{editingBatch.id ? 'Edit Batch' : 'Create New Batch'}</h3>
                                        <p className="text-sm text-gray-500">Define ranges for ticket numbering</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition">
                                    <X className="w-6 h-6 text-gray-400" />
                                </button>
                            </div>
                        </div>

                        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Batch Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Students Group"
                                        value={editingBatch.name}
                                        onChange={(e) => setEditingBatch({ ...editingBatch, name: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-[#22C55E] outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Prefix Number</label>
                                    <input
                                        type="number"
                                        placeholder="1000"
                                        value={editingBatch.prefix}
                                        onChange={(e) => setEditingBatch({ ...editingBatch, prefix: parseInt(e.target.value) })}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-[#22C55E] outline-none transition"
                                    />
                                    <p className="mt-1 text-xs text-gray-400 italic text-right">Example tickets: {editingBatch.prefix + 1}, {editingBatch.prefix + 2}...</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Target Payment Statuses</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['pending', 'PAY_SUCCESS', 'PAY_FAILED', 'deleted'].map(status => {
                                            const isSelected = editingBatch.paymentStatuses.includes(status);
                                            return (
                                                <button
                                                    key={status}
                                                    onClick={() => toggleStatus(status)}
                                                    className={`px-4 py-2 rounded-xl border transition text-sm font-medium ${isSelected
                                                        ? 'bg-amber-50 border-amber-500 text-amber-700 font-bold'
                                                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                                        }`}
                                                >
                                                    {status === 'PAY_SUCCESS' ? 'Completed' : status}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Specific Coupons / Sponsors</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. FREE100, SPONSOR2026 (comma separated)"
                                        value={couponInput}
                                        onChange={(e) => handleCouponsChange(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-[#22C55E] outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Specific Registration IDs</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 101, 105, 220 (comma separated)"
                                        value={idInput}
                                        onChange={(e) => handleIdsChange(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-[#22C55E] outline-none transition"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-4">Select Assigned Roles</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {AVAILABLE_ROLES.map(role => {
                                            const isSelected = editingBatch.roles.includes(role);
                                            return (
                                                <button
                                                    key={role}
                                                    onClick={() => toggleRole(role)}
                                                    className={`flex items-center gap-3 p-3 rounded-2xl border transition text-left ${isSelected
                                                        ? 'bg-[#F0FDF4] border-[#22C55E] text-[#15803D]'
                                                        : 'bg-white border-gray-100 text-gray-600 hover:border-gray-300'
                                                        }`}
                                                >
                                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${isSelected ? 'bg-[#22C55E] border-[#22C55E]' : 'border-gray-300'
                                                        }`}>
                                                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                                    </div>
                                                    <span className="text-sm font-medium">{role}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {editingBatch.roles.length === 0 && editingBatch.coupons.length === 0 && editingBatch.registrationIds.length === 0 && (
                                        <p className="mt-4 text-xs text-amber-600 flex items-center gap-1.5 font-medium">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            Warning: No filters selected. This batch will apply to everyone.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-8 border-t border-gray-50 flex flex-col gap-3 bg-gray-50/50">
                            <button
                                onClick={handleSaveBatch}
                                className="w-full bg-[#22C55E] text-white py-4 rounded-2xl font-bold shadow-lg shadow-[#22C55E]/20 hover:scale-[1.01] active:scale-[0.99] transition flex items-center justify-center gap-2"
                            >
                                <Save className="w-5 h-5" />
                                {editingBatch.id ? 'Save Changes' : 'Create Batch'}
                            </button>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-full bg-white border border-gray-200 text-gray-700 py-4 rounded-2xl font-bold hover:bg-gray-100 transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
