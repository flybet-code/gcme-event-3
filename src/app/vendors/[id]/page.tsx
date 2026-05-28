'use client'
import React, { useEffect, useState, use } from 'react';
import { authClient } from "@/lib/auth-client";
import {
    Plus, Trash2, Save, RefreshCw,
    LayoutDashboard, Users, UserCheck, FileText,
    UserPlus, ShieldCheck, Tags, Store,
    AlertCircle, Edit2, X, Check, Building2,
    UsersRound, Utensils, Coffee, Download,
    ChevronRight, ExternalLink, Search, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';

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

export default function VendorDashboardPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: vendorId } = use(params);
    const { data: session } = authClient.useSession();
    const router = useRouter();

    const [vendor, setVendor] = useState<any>(null);
    const [usageDetails, setUsageDetails] = useState<UsageDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [selectedDay, setSelectedDay] = useState<number>(1);
    const [currentRole, setCurrentRole] = useState('');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        fetchVendorDetails();
    }, [vendorId]);

    useEffect(() => {
        fetchUsageDetails();
    }, [vendorId, selectedDay, debouncedSearch]);

    const fetchVendorDetails = async () => {
        try {
            const res = await fetch(`/api/vendors/${vendorId}`);
            const data = await res.json();
            if (data.error) {
                alert(data.error);
                router.push('/vendors');
                return;
            }
            setVendor(data);
        } catch (error) {
            console.error('Error fetching vendor:', error);
        }
    };

    const fetchUsageDetails = async () => {
        setDetailsLoading(true);
        try {
            const res = await fetch(`/api/vendors/usage-details?vendorId=${vendorId}&day=${selectedDay}&search=${encodeURIComponent(debouncedSearch)}`);
            const data = await res.json();
            setUsageDetails(data.participants || []);
        } catch (error) {
            console.error('Error fetching details:', error);
        } finally {
            setDetailsLoading(false);
            setLoading(false);
        }
    };

    const exportToCSV = () => {
        if (!usageDetails.length || !vendor) return;

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
        link.setAttribute("download", `Usage_Day${selectedDay}_${vendor.name.replace(/\s+/g, '_')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <RefreshCw className="w-12 h-12 text-[#22C55E] animate-spin mb-4" />
                <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Loading Dashboard...</p>
            </div>
        );
    }

    const activityLabels: any = {
        [`tea_break_day${selectedDay}_am`]: 'Tea Break AM',
        [`lunch_day${selectedDay}`]: 'Lunch',
        [`tea_break_day${selectedDay}_pm`]: 'Tea Break PM',
    };

    const allocated = (vendor?._count?.registrations || 0) + (vendor?._count?.attendees || 0);

    return (
        <div className="min-h-screen bg-transparent p-4 lg:p-8">
            {/* Minimal Top Bar */}
            <div className="max-w-7xl mx-auto flex flex-col gap-8">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-6">
                        <Link
                            href="/vendors"
                            className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-400 hover:text-gray-900 shadow-sm border border-gray-100 hover:border-gray-200 transition-all"
                        >
                            <ArrowLeft size={20} />
                        </Link>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-3xl font-black text-gray-900 leading-none">{vendor?.name}</h1>
                                <span className="bg-[#22C55E]/10 text-[#22C55E] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-[#22C55E]/10">Vendor Dashboard</span>
                            </div>
                            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                                <Building2 size={12} />
                                Provider ID: {vendorId.substring(0, 8)} • Capacity: {vendor?.capacity}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="flex bg-white shadow-sm border border-gray-100 rounded-2xl p-1.5 gap-1">
                            {[1, 2, 3].map(d => (
                                <button
                                    key={d}
                                    onClick={() => setSelectedDay(d)}
                                    className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${selectedDay === d ? 'bg-gray-900 text-white shadow-md' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'}`}
                                >
                                    DAY {d}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={exportToCSV}
                            className="bg-white border border-gray-100 shadow-sm text-gray-900 flex items-center gap-2 px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:border-gray-300 hover:shadow-md active:scale-95"
                        >
                            <Download size={16} />
                            Export Day {selectedDay}
                        </button>
                    </div>
                </header>

                {/* Growth & Performance Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {Object.keys(activityLabels).map(actId => (
                        <div key={actId} className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100 flex flex-col items-center text-center group hover:shadow-xl hover:shadow-gray-500/5 transition-all duration-500">
                            <div className={`w-16 h-16 rounded-[24px] bg-opacity-10 mb-6 flex items-center justify-center group-hover:scale-110 transition-transform ${actId.includes('lunch') ? 'bg-orange-500 text-orange-600' : 'bg-amber-500 text-amber-600'}`}>
                                {actId.includes('lunch') ? <Utensils size={32} /> : <Coffee size={32} />}
                            </div>
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">{activityLabels[actId]} SCANS</h4>
                            <p className="text-4xl font-black text-gray-800">{vendor?.stats[actId] || 0}/{allocated}</p>
                            <p className="mt-4 text-[9px] font-black text-gray-300 uppercase underline underline-offset-4 pointer-events-none">Utilization: {allocated > 0 ? Math.round(((vendor?.stats[actId] || 0) / allocated) * 100) : 0}%</p>
                        </div>
                    ))}
                    <div className="bg-gray-900 p-8 rounded-[40px] shadow-xl shadow-gray-900/10 flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-[24px] bg-white/10 text-[#22C55E] mb-6 flex items-center justify-center">
                            <Users size={32} />
                        </div>
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Total Participants</h4>
                        <p className="text-4xl font-black text-white">{allocated}</p>
                        <div className="mt-4 w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-[#22C55E]"
                                style={{ width: `${Math.min(100, (allocated / (vendor?.capacity || 1)) * 100)}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Audit List */}
                <div className="bg-white rounded-[48px] border border-gray-100 shadow-sm overflow-hidden mb-12">
                    <div className="p-10 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                        <div>
                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-widest leading-none mb-1">Consumption Audit Trail</h3>
                            <p className="text-xs text-gray-400 font-bold">Comprehensive list of participants served on day {selectedDay}</p>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name, phone or ticket..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-12 pr-4 py-3 w-64 lg:w-80 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-[#22C55E]/10 focus:border-[#22C55E] transition-all text-sm"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        {detailsLoading ? (
                            <div className="flex flex-col items-center justify-center py-32 gap-4">
                                <RefreshCw className="w-12 h-12 text-blue-500 animate-spin" />
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Reconstructing audit logs...</p>
                            </div>
                        ) : usageDetails.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-32 text-center">
                                <AlertCircle size={48} className="text-gray-200 mb-6" />
                                <h4 className="text-xl font-black text-gray-800 mb-2">No Service Recorded</h4>
                                <p className="text-gray-400 max-w-xs mx-auto text-sm font-medium">There are no consumption logs found for this provider on selected day.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-gray-50/50">
                                        <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Participant Details</th>
                                        <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Check In</th>
                                        <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Tea AM</th>
                                        <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Lunch</th>
                                        <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Tea PM</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {usageDetails.map((p, idx) => (
                                        <tr key={idx} className="hover:bg-blue-50/10 transition-colors group">
                                            <td className="px-10 py-8">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-gray-50 group-hover:bg-white rounded-2xl flex items-center justify-center text-gray-400 border border-transparent group-hover:border-gray-100 transition-all font-black text-xs">
                                                        {p.name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <p className="font-black text-gray-900 leading-none text-lg">{p.name}</p>
                                                            <span className="bg-gray-100 text-gray-400 px-2 py-0.5 rounded-md text-[9px] font-black">#{p.ticketNumber}</span>
                                                        </div>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{p.church} • {p.role}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-10 py-8 text-center border-x border-gray-50/50">
                                                {p.check_in ? (
                                                    <div className="inline-flex flex-col items-center">
                                                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-2 shadow-sm border border-blue-100/50 transition-transform group-hover:scale-110">
                                                            <UserCheck size={18} />
                                                        </div>
                                                        <span className="text-[10px] font-black text-blue-600 uppercase tabular-nums">
                                                            {new Date(p.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-black text-gray-200">---</span>
                                                )}
                                            </td>
                                            <td className="px-10 py-8 text-center border-r border-gray-50/50">
                                                {p.tea_am ? (
                                                    <div className="inline-flex flex-col items-center">
                                                        <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-2 shadow-sm border border-amber-100/50 transition-transform group-hover:scale-110">
                                                            <Coffee size={18} />
                                                        </div>
                                                        <span className="text-[10px] font-black text-amber-600 uppercase tabular-nums">
                                                            {new Date(p.tea_am).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-black text-gray-200">---</span>
                                                )}
                                            </td>
                                            <td className="px-10 py-8 text-center border-x border-gray-50/50">
                                                {p.lunch ? (
                                                    <div className="inline-flex flex-col items-center">
                                                        <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mb-2 shadow-sm border border-orange-100/50 transition-transform group-hover:scale-110">
                                                            <Utensils size={18} />
                                                        </div>
                                                        <span className="text-[10px] font-black text-orange-600 uppercase tabular-nums">
                                                            {new Date(p.lunch).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-black text-gray-200">---</span>
                                                )}
                                            </td>
                                            <td className="px-10 py-8 text-center">
                                                {p.tea_pm ? (
                                                    <div className="inline-flex flex-col items-center">
                                                        <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-2 shadow-sm border border-amber-100/50 transition-transform group-hover:scale-110">
                                                            <Coffee size={18} />
                                                        </div>
                                                        <span className="text-[10px] font-black text-amber-600 uppercase tabular-nums">
                                                            {new Date(p.tea_pm).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-black text-gray-200">---</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
