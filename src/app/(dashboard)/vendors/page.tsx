'use client'
import React, { useEffect, useState } from 'react';
import { authClient } from "@/lib/auth-client";
import {
    Plus, Trash2, Save, RefreshCw,
    LayoutDashboard, Users, UserCheck, FileText,
    UserPlus, ShieldCheck, Tags, Store,
    AlertCircle, Edit2, X, Check, Building2,
    UsersRound, Utensils, Coffee, Download, CalendarCheck,
    ChevronRight, ExternalLink, Search
} from 'lucide-react';
import Link from 'next/link';
import { DashboardMobileMenuButton } from '@/components/DashboardLayout';
import { AuthGate } from '@/components/AuthGate';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';

interface Vendor {
    id: string;
    name: string;
    capacity: number;
    _count?: {
        registrations: number;
        attendees: number;
    };
    activities?: Record<string, number>;
}

interface UsageDetail {
    id: number | string;
    name: string;
    role: string;
    church: string;
    ticketNumber: number;
    type: string;
    check_in: string | null;
    tea_am: string | null;
    lunch: string | null;
    tea_pm: string | null;
}

export default function VendorManagementPage() {
    const { data: session } = authClient.useSession();
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [stats, setStats] = useState<any[]>([]);
    const [globalStats, setGlobalStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'manage' | 'stats'>('manage');
    const [selectedDay, setSelectedDay] = useState<number>(1);
    const [permissions, setPermissions] = useState<string[]>([]);
    const [currentRole, setCurrentRole] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingVendor, setEditingVendor] = useState<Partial<Vendor>>({ name: '', capacity: 0 });

    // Detailed Usage Modal State
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [usageDetails, setUsageDetails] = useState<UsageDetail[]>([]);
    const [selectedVendorForDetails, setSelectedVendorForDetails] = useState<{ id: string, name: string } | null>(null);

    // Use session-based permissions instead of separate fetch
    useEffect(() => {
        if (session?.user) {
            setPermissions((session.user as any).permissions || []);
            setCurrentRole((session.user as any).role || '');
        }
        if (session) {
            fetchVendors();
            fetchStats();
        }
    }, [sessionUserId, selectedDay]);



    const fetchVendors = async () => {
        try {
            const res = await fetch('/api/vendors');
            const data = await res.json();
            setVendors(data || []);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching vendors:', error);
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await fetch(`/api/vendors/stats?day=${selectedDay}`);
            const data = await res.json();
            setStats(data.stats || []);
            setGlobalStats(data.globalStats);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const fetchUsageDetails = async (vendorId: string, vendorName: string, actId?: string) => {
        setDetailsLoading(true);
        setSelectedVendorForDetails({ id: vendorId, name: vendorName });
        setUsageDetails([]);
        setShowDetailsModal(true);

        try {
            let url = `/api/vendors/usage-details?vendorId=${vendorId}&day=${selectedDay}`;
            if (actId) url += `&activityId=${actId}`;

            const res = await fetch(url);
            const data = await res.json();
            setUsageDetails(data.participants || []);
        } catch (error) {
            console.error('Error fetching details:', error);
        } finally {
            setDetailsLoading(false);
        }
    };

    const exportToCSV = () => {
        if (!usageDetails.length || !selectedVendorForDetails) return;

        const headers = ["Name", "Ticket Number", "Role", "Church", "Check In", "Tea AM", "Lunch", "Tea PM", "Type"];
        const rows = usageDetails.map(p => [
            p.name,
            p.ticketNumber,
            p.role,
            p.church,
            p.check_in ? new Date(p.check_in).toLocaleTimeString() : "No",
            p.tea_am ? new Date(p.tea_am).toLocaleTimeString() : "No",
            p.lunch ? new Date(p.lunch).toLocaleTimeString() : "No",
            p.tea_pm ? new Date(p.tea_pm).toLocaleTimeString() : "No",
            p.type
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(e => e.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Usage_Day${selectedDay}_${selectedVendorForDetails.name.replace(/\s+/g, '_')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSaveVendor = async () => {
        if (!editingVendor.name || (editingVendor.capacity || 0) <= 0) {
            alert('Please fill in Name and a valid Capacity');
            return;
        }

        try {
            const res = await fetch('/api/vendors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingVendor)
            });
            if (res.ok) {
                alert('Vendor saved successfully');
                setShowModal(false);
                fetchVendors();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to save vendor');
            }
        } catch (error) {
            alert('Error saving vendor');
        }
    };

    const handleDeleteVendor = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete vendor "${name}"? Existing allocations will be cleared.`)) return;

        try {
            const res = await fetch(`/api/vendors/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                alert('Vendor deleted successfully');
                fetchVendors();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to delete vendor');
            }
        } catch (error) {
            alert('Error deleting vendor');
        }
    };

    const openEditModal = (vendor: Vendor) => {
        setEditingVendor({ ...vendor });
        setShowModal(true);
    };

    const openCreateModal = () => {
        setEditingVendor({ name: '', capacity: 0 });
        setShowModal(true);
    };



    const su = session?.user as { isPlatformSuperAdmin?: boolean; legacyRole?: string; role?: string } | undefined;
    const isPlatformAdmin = hasPlatformElevatedAccess(su?.isPlatformSuperAdmin, su?.legacyRole ?? su?.role);
    const canManage = isPlatformAdmin || permissions.includes('manage_vendors');

    const activityLabels: any = {
        [`check_in_day${selectedDay}`]: 'Arrival Check-In',
        [`tea_break_day${selectedDay}_am`]: 'Tea Break AM',
        [`lunch_day${selectedDay}`]: 'Lunch',
        [`tea_break_day${selectedDay}_pm`]: 'Tea Break PM',
    };

    return (
        <>
                <header className="bg-white border-b border-gray-100 px-4 lg:px-8 py-6 sticky top-0 z-30 flex justify-between items-center flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <DashboardMobileMenuButton />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Vendor Management</h1>
                            <p className="text-gray-500 text-sm">Manage providers and monitor real-time consumption</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-gray-100 p-1.5 rounded-2xl flex gap-1 mr-4">
                            <button
                                onClick={() => setView('manage')}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 ${view === 'manage' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Building2 size={16} />
                                Manage
                            </button>
                            <button
                                onClick={() => setView('stats')}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 ${view === 'stats' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Tags size={16} />
                                Usage Stats
                            </button>
                        </div>
                        {view === 'manage' && canManage && (
                            <button
                                onClick={openCreateModal}
                                className="bg-[#22C55E] hover:bg-[#1DAE50] text-white px-6 py-2.5 rounded-xl font-bold transition flex items-center gap-2 shadow-lg shadow-[#22C55E]/20"
                            >
                                <Plus size={18} />
                                New Vendor
                            </button>
                        )}
                        {view === 'stats' && (
                            <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                                {[1, 2, 3].map(d => (
                                    <button
                                        key={d}
                                        onClick={() => setSelectedDay(d)}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-black transition ${selectedDay === d ? 'bg-[#22C55E] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
                                    >
                                        DAY {d}
                                    </button>
                                ))}
                            </div>
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
                            <p className="font-medium">You do not have permission to modify vendor settings.</p>
                        </div>
                    ) : view === 'manage' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {vendors.map((vendor) => (
                                <div key={vendor.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center">
                                                    <Store className="w-6 h-6 text-[#22C55E]" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-lg text-gray-800">{vendor.name}</h3>
                                                    <p className="text-xs text-gray-400">ID: {vendor.id?.substring(0, 8)}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => openEditModal(vendor)}
                                                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => vendor.id && handleDeleteVendor(vendor.id, vendor.name)}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Capacity</p>
                                                <p className="text-lg font-black text-gray-800">{vendor.capacity}</p>
                                            </div>
                                            <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Allocated</p>
                                                <p className="text-lg font-black text-[#22C55E]">
                                                    {(vendor._count?.registrations || 0) + (vendor._count?.attendees || 0)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-500 ${((vendor._count?.registrations || 0) + (vendor._count?.attendees || 0)) / vendor.capacity > 0.9
                                                    ? 'bg-red-500'
                                                    : 'bg-[#22C55E]'
                                                    }`}
                                                style={{ width: `${Math.min(100, (((vendor._count?.registrations || 0) + (vendor._count?.attendees || 0)) / (vendor.capacity || 1)) * 100)}%` }}
                                            />
                                        </div>

                                        <Link
                                            href={`/vendors/${vendor.id}`}
                                            className="mt-2 w-full py-3 bg-gray-50 hover:bg-[#22C55E] text-gray-400 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-gray-100 hover:border-[#22C55E]"
                                        >
                                            <LayoutDashboard size={14} />
                                            View Full Dashboard
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                                {Object.keys(activityLabels).map(actId => (
                                    <div key={actId} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                                        <div className={`p-4 rounded-2xl bg-opacity-10 mb-4 ${actId.includes('lunch') ? 'bg-orange-500 text-orange-600' : actId.includes('check_in') ? 'bg-blue-500 text-blue-600' : 'bg-amber-500 text-amber-600'}`}>
                                            {actId.includes('lunch') ? <Utensils /> : actId.includes('check_in') ? <CalendarCheck /> : <Coffee />}
                                        </div>
                                        <h4 className="text-xs font-black text-gray-400 uppercase mb-1">{activityLabels[actId]}</h4>
                                        <p className="text-3xl font-black text-gray-800">{globalStats?.activities[actId] || 0}</p>
                                    </div>
                                ))}
                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
                                    <div className="p-4 rounded-2xl bg-green-50 text-green-600 mb-4">
                                        <Users />
                                    </div>
                                    <h4 className="text-xs font-black text-gray-400 uppercase mb-1">Target Total</h4>
                                    <p className="text-3xl font-black text-gray-800">{globalStats?.totalAllocated || 0}</p>
                                </div>
                            </div>

                            {/* Detailed Vendor Stats Table */}
                            <div className="bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-sm">
                                <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                                    <h3 className="font-black text-gray-800 uppercase tracking-widest text-sm">Vendor Performance Breakdown</h3>
                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-black uppercase tracking-wider">Day {selectedDay}</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-gray-50/50">
                                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Vendor Name</th>
                                                {Object.keys(activityLabels).map(actId => (
                                                    <th key={actId} className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">{activityLabels[actId]}</th>
                                                ))}
                                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {stats.map(v => (
                                                <tr key={v.id} className="hover:bg-gray-50/30 transition group">
                                                    <td className="px-8 py-6">
                                                        <div>
                                                            <p className="font-bold text-gray-800 text-lg leading-none mb-1">{v.name}</p>
                                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Capacity: {v.allocated}</p>
                                                        </div>
                                                    </td>
                                                    {Object.keys(activityLabels).map(actId => (
                                                        <td key={actId} className="px-8 py-6 text-center">
                                                            <button
                                                                onClick={() => fetchUsageDetails(v.id, v.name, actId)}
                                                                className={`px-6 py-2 rounded-2xl text-base font-black transition-all hover:scale-110 active:scale-95 ${v.activities[actId] > 0 ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-gray-50 text-gray-300 border border-transparent'}`}
                                                            >
                                                                {v.activities[actId] || 0}/{v.allocated}
                                                            </button>
                                                        </td>
                                                    ))}
                                                    <td className="px-8 py-6 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Link
                                                                href={`/vendors/${v.id}`}
                                                                className="p-3 bg-gray-50 hover:bg-gray-900 text-gray-400 hover:text-white rounded-2xl transition-all border border-transparent shadow-sm"
                                                                title="Vendor Command Center"
                                                            >
                                                                <LayoutDashboard size={18} />
                                                            </Link>
                                                            <button
                                                                onClick={() => fetchUsageDetails(v.id, v.name)}
                                                                className="p-3 bg-gray-50 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-2xl transition-all border border-transparent hover:border-blue-100 shadow-sm"
                                                                title="View Detailed List"
                                                            >
                                                                <ChevronRight size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            {/* General Vendor Edit/Create Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
                    <div className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-10 border-b border-gray-50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-[#F0FDF4] rounded-3xl flex items-center justify-center text-[#22C55E]">
                                        <Store size={28} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-gray-900 leading-none mb-1">{editingVendor.id ? 'Edit Vendor' : 'New Vendor'}</h3>
                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Configuration</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowModal(false)} className="p-3 hover:bg-gray-100 rounded-2xl transition">
                                    <X size={24} className="text-gray-400" />
                                </button>
                            </div>
                        </div>

                        <div className="p-10 space-y-6">
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Vendor Provider Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Master Catering"
                                    value={editingVendor.name}
                                    onChange={(e) => setEditingVendor({ ...editingVendor, name: e.target.value })}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-[#22C55E] focus:bg-white rounded-[24px] px-6 py-4 outline-none transition-all font-bold text-gray-800 shadow-inner"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Maximum Slots / Capacity</label>
                                <input
                                    type="number"
                                    placeholder="Total slots"
                                    value={editingVendor.capacity}
                                    onChange={(e) => setEditingVendor({ ...editingVendor, capacity: parseInt(e.target.value) })}
                                    className="w-full bg-gray-50 border-2 border-transparent focus:border-[#22C55E] focus:bg-white rounded-[24px] px-6 py-4 outline-none transition-all font-bold text-gray-800 shadow-inner"
                                />
                            </div>
                        </div>

                        <div className="p-10 border-t border-gray-50 flex flex-col gap-3 bg-gray-50/50">
                            <button
                                onClick={handleSaveVendor}
                                className="w-full bg-gray-900 text-white py-5 rounded-[24px] font-black uppercase tracking-widest shadow-xl shadow-gray-900/10 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                            >
                                <Save size={20} />
                                {editingVendor.id ? 'Save Provider' : 'Create Provider'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DETAILED USAGE MODAL */}
            {showDetailsModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setShowDetailsModal(false)}></div>
                    <div className="relative bg-white w-full max-w-4xl rounded-[48px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
                        {/* Modal Header */}
                        <div className="p-8 lg:p-12 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div className="flex items-center gap-5">
                                <div className="w-16 h-16 bg-blue-50 rounded-[28px] flex items-center justify-center text-blue-600 border border-blue-100">
                                    <FileText size={32} />
                                </div>
                                <div>
                                    <h3 className="text-3xl font-black text-gray-900 leading-none mb-2">{selectedVendorForDetails?.name}</h3>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] bg-blue-600 text-white px-3 py-1 rounded-full font-black uppercase tracking-widest">Day {selectedDay} Details</span>
                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{usageDetails.length} Participants tracked</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <button
                                    onClick={exportToCSV}
                                    disabled={usageDetails.length === 0}
                                    className="flex-1 md:flex-none flex items-center gap-2 bg-[#22C55E] hover:bg-[#1DAE50] disabled:bg-gray-100 disabled:text-gray-400 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#22C55E]/20"
                                >
                                    <Download size={18} />
                                    Export CSV Report
                                </button>
                                <button onClick={() => setShowDetailsModal(false)} className="p-4 hover:bg-gray-100 rounded-2xl transition group">
                                    <X size={24} className="text-gray-400 group-hover:text-gray-900" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-4 lg:p-12 max-h-[60vh] overflow-y-auto custom-scrollbar bg-gray-50/30">
                            {detailsLoading ? (
                                <div className="flex flex-col items-center justify-center py-24 gap-4">
                                    <RefreshCw className="w-12 h-12 text-blue-500 animate-spin" />
                                    <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Generating Audit Trail...</p>
                                </div>
                            ) : usageDetails.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 text-center">
                                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-300 mb-6">
                                        <Search size={40} />
                                    </div>
                                    <h4 className="text-xl font-bold text-gray-800 mb-2">No consumption logs found</h4>
                                    <p className="text-gray-400 max-w-xs mx-auto text-sm font-medium">There are no tracked activities for this vendor on the selected day yet.</p>
                                </div>
                            ) : (
                                <div className="bg-white rounded-[32px] border border-gray-100 overflow-hidden shadow-sm">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-900">
                                            <tr>
                                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest underline decoration-blue-500/50 underline-offset-4">Participant</th>
                                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest underline decoration-blue-500/50 underline-offset-4 text-center">Check In</th>
                                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest underline decoration-blue-500/50 underline-offset-4 text-center">Tea AM</th>
                                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest underline decoration-blue-500/50 underline-offset-4 text-center">Lunch</th>
                                                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest underline decoration-blue-500/50 underline-offset-4 text-center">Tea PM</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {usageDetails.map((p, idx) => (
                                                <tr key={idx} className="hover:bg-blue-50/20 transition group">
                                                    <td className="px-8 py-6">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <p className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-none">{p.name}</p>
                                                                <span className="bg-gray-100 text-gray-400 px-2 py-0.5 rounded-md text-[9px] font-black">#{p.ticketNumber}</span>
                                                            </div>
                                                            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{p.church} • {p.role}</p>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6 text-center">
                                                        {p.check_in ? (
                                                            <div className="inline-flex flex-col items-center">
                                                                <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-1">
                                                                    <UserCheck size={14} />
                                                                </div>
                                                                <span className="text-[9px] font-bold text-blue-600">{new Date(p.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] font-black text-gray-200">---</span>
                                                        )}
                                                    </td>
                                                    <td className="px-8 py-6 text-center">
                                                        {p.tea_am ? (
                                                            <div className="inline-flex flex-col items-center">
                                                                <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mb-1">
                                                                    <Coffee size={14} />
                                                                </div>
                                                                <span className="text-[9px] font-bold text-amber-600">{new Date(p.tea_am).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] font-black text-gray-200">---</span>
                                                        )}
                                                    </td>
                                                    <td className="px-8 py-6 text-center">
                                                        {p.lunch ? (
                                                            <div className="inline-flex flex-col items-center">
                                                                <div className="w-8 h-8 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mb-1">
                                                                    <Utensils size={14} />
                                                                </div>
                                                                <span className="text-[9px] font-bold text-orange-600">{new Date(p.lunch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] font-black text-gray-200">---</span>
                                                        )}
                                                    </td>
                                                    <td className="px-8 py-6 text-center">
                                                        {p.tea_pm ? (
                                                            <div className="inline-flex flex-col items-center">
                                                                <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mb-1">
                                                                    <Coffee size={14} />
                                                                </div>
                                                                <span className="text-[9px] font-bold text-amber-600">{new Date(p.tea_pm).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] font-black text-gray-200">---</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-8 lg:p-10 bg-gray-50/80 border-t border-gray-100 flex items-center justify-center">
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="text-sm font-black text-gray-500 hover:text-gray-900 flex items-center gap-2 uppercase tracking-widest"
                            >
                                <X size={16} />
                                Close Report
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
