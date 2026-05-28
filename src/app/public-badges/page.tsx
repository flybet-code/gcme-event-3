'use client'
import React, { useEffect, useState } from "react";
import { QRCodeSVG } from 'qrcode.react';
import {
    Printer, LayoutDashboard, Users, FileText,
    Search, Store, UsersRound, Check, ChevronDown, Filter, Calendar
} from 'lucide-react';
import Image from "next/image";
import { formatSummitPersonName } from '@/lib/summit-registration-config';

interface Registration {
    id: string;
    title?: string;
    fullName: string;
    churchName: string;
    serviceRole: string;
    phoneNumber: string;
    paymentStatus: string;
    createdAt: string;
    isGroup?: boolean;
    vendorId?: string;
    vendor?: { name: string };
    groupId?: string;
    group?: { name: string };
    attendees?: {
        id: number;
        title?: string;
        fullName: string;
        role: string;
        ticketNumber?: number;
        vendorId?: string;
        vendor?: { name: string };
        groupId?: string;
        group?: { name: string };
    }[];
    ticketNumber?: number;
    isBadgePrinted?: boolean;
    badgePrintedAt?: string;
}

interface Badge {
    id: string;
    ticketNumber?: number;
    fullName: string;
    role: string;
    churchName: string;
    paymentStatus: string;
    phoneNumber: string;
    vendorId?: string;
    groupId?: string;
    group?: { name: string };
    isBadgePrinted?: boolean;
    badgePrintedAt?: string;
}

export default function PublicBadgePrintPage() {
    const [badges, setBadges] = useState<Badge[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<'all' | 'PAY_SUCCESS' | 'pending'>('PAY_SUCCESS');
    const [selectedBadges, setSelectedBadges] = useState<string[]>([]);
    const [printedFilter, setPrintedFilter] = useState<'all' | 'printed' | 'unprinted'>('all');
    const [printMode, setPrintMode] = useState<'full' | 'qr-only'>('full');
    const [vendorFilter, setVendorFilter] = useState<string>('all');
    const [groupFilter, setGroupFilter] = useState<string>('all');
    const [vendors, setVendors] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;
    const [badgeTemplateSrc, setBadgeTemplateSrc] = useState('/badge_template.jpg');

    const fetchBadges = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                limit: '10000',
                statusFilter: statusFilter === 'all' ? 'all' : statusFilter === 'PAY_SUCCESS' ? 'completed' : 'pending',
                vendorId: vendorFilter === 'all' ? '' : vendorFilter,
                groupId: groupFilter === 'all' ? '' : groupFilter,
                printedFilter: printedFilter
            });

            const response = await fetch(`/api/register_church_summit/?${queryParams}`);
            if (!response.ok) throw new Error("Failed to fetch data");

            const result = await response.json();
            const data: Registration[] = result.data || [];
            const showTitleInBadges = result.meta?.showTitleField !== false;
            setBadgeTemplateSrc(
                typeof result.badgeTemplateSrc === 'string' && result.badgeTemplateSrc
                    ? result.badgeTemplateSrc
                    : '/badge_template.jpg'
            );

            const flattenedBadges: Badge[] = data.flatMap((reg) => {
                const badgesList: Badge[] = [];
                if (reg.isGroup && reg.attendees && reg.attendees.length > 0) {
                    reg.attendees.forEach((att: any) => {
                        const vMatches = vendorFilter === 'all' || (vendorFilter === 'none' ? !att.vendorId : att.vendorId === vendorFilter);
                        const gMatches = groupFilter === 'all' || (groupFilter === 'none' ? !att.groupId : att.groupId === groupFilter);

                        if (vMatches && gMatches) {
                            badgesList.push({
                                id: `CLS-${reg.id}-${att.id}`,
                                ticketNumber: att.ticketNumber,
                                fullName: formatSummitPersonName(att.fullName, att.title, showTitleInBadges),
                                role: att.role,
                                churchName: reg.churchName,
                                paymentStatus: reg.paymentStatus,
                                phoneNumber: att.phoneNumber || reg.phoneNumber,
                                vendorId: att.vendorId,
                                groupId: att.groupId,
                                group: att.group,
                                isBadgePrinted: att.isBadgePrinted,
                                badgePrintedAt: att.badgePrintedAt
                            });
                        }
                    });
                } else {
                    const vMatches = vendorFilter === 'all' || (vendorFilter === 'none' ? !reg.vendorId : reg.vendorId === vendorFilter);
                    const gMatches = groupFilter === 'all' || (groupFilter === 'none' ? !reg.groupId : reg.groupId === groupFilter);

                    if (vMatches && gMatches) {
                        badgesList.push({
                            id: `CLS-${reg.id}`,
                            ticketNumber: reg.ticketNumber,
                            fullName: formatSummitPersonName(reg.fullName, reg.title, showTitleInBadges),
                            role: reg.serviceRole,
                            churchName: reg.churchName,
                            paymentStatus: reg.paymentStatus,
                            phoneNumber: reg.phoneNumber,
                            vendorId: reg.vendorId,
                            groupId: reg.groupId,
                            group: reg.group,
                            isBadgePrinted: reg.isBadgePrinted,
                            badgePrintedAt: reg.badgePrintedAt
                        });
                    }
                }
                return badgesList;
            });

            setBadges(flattenedBadges);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const fetchVendors = async () => {
        const res = await fetch('/api/vendors');
        const data = await res.json();
        setVendors(Array.isArray(data) ? data : []);
    };

    const fetchGroups = async () => {
        const res = await fetch('/api/groups');
        const data = await res.json();
        setGroups(Array.isArray(data) ? data : []);
    };

    useEffect(() => {
        fetchBadges();
        fetchVendors();
        fetchGroups();
        setCurrentPage(1);
    }, [statusFilter, vendorFilter, groupFilter, search, printedFilter]);

    const filteredBadges = badges.filter(b => {
        const s = search.toLowerCase();
        if (!s) {
            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'PAY_SUCCESS' && b.paymentStatus === 'PAY_SUCCESS') ||
                (statusFilter === 'pending' && b.paymentStatus !== 'PAY_SUCCESS');
            return matchesStatus;
        }

        // Advanced search logic matching admin page
        // Smart Phone Match (last 8 digits)
        const phone = b.phoneNumber?.toLowerCase() || '';
        let isPhoneMatch = phone.includes(s);
        if (!isPhoneMatch && s.replace(/[^\d]/g, '').length >= 8) {
            const cleanS = s.replace(/[^\d]/g, '').slice(-8);
            const cleanRowPhone = phone.replace(/[^\d]/g, '');
            isPhoneMatch = cleanRowPhone.includes(cleanS);
        }

        const matchesSearch = b.fullName.toLowerCase().includes(s) ||
            b.churchName.toLowerCase().includes(s) ||
            b.id.toLowerCase().includes(s) ||
            (b.ticketNumber && String(b.ticketNumber).includes(s)) ||
            phone.includes(s) ||
            isPhoneMatch;

        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'PAY_SUCCESS' && b.paymentStatus === 'PAY_SUCCESS') ||
            (statusFilter === 'pending' && b.paymentStatus !== 'PAY_SUCCESS');

        return matchesSearch && matchesStatus;
    });

    const totalPages = Math.ceil(filteredBadges.length / itemsPerPage);
    const paginatedBadges = filteredBadges.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const toggleBadgeSelection = (id: string) => {
        setSelectedBadges(prev => prev.includes(id) ? prev.filter(bid => bid !== id) : [...prev, id]);
    };

    const handlePrintMode = (mode: 'full' | 'qr-only') => {
        setPrintMode(mode);
        setTimeout(() => window.print(), 100);
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-40 print:hidden shadow-sm">
                <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-[#22C55E] p-2 rounded-xl shadow-lg shadow-green-200">
                            <Printer className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900 leading-none">PUBLIC BADGE PORTAL</h1>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">GCME Summit 2026 • Live Monitoring</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                        {/* Filters */}
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-green-500 transition-all">
                            <Filter className="w-4 h-4 text-gray-400" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="bg-transparent border-none text-xs font-black text-gray-600 focus:ring-0 cursor-pointer uppercase tracking-wider"
                            >
                                <option value="PAY_SUCCESS">Paid Only</option>
                                <option value="all">All Status</option>
                                <option value="pending">Pending</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-green-500 transition-all">
                            <Store className="w-4 h-4 text-gray-400" />
                            <select
                                value={vendorFilter}
                                onChange={(e) => setVendorFilter(e.target.value)}
                                className="bg-transparent border-none text-xs font-black text-gray-600 focus:ring-0 cursor-pointer uppercase tracking-wider"
                            >
                                <option value="all">All Vendors</option>
                                <option value="none">Not Allocated</option>
                                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-green-500 transition-all">
                            <UsersRound className="w-4 h-4 text-gray-400" />
                            <select
                                value={groupFilter}
                                onChange={(e) => setGroupFilter(e.target.value)}
                                className="bg-transparent border-none text-xs font-black text-gray-600 focus:ring-0 cursor-pointer uppercase tracking-wider"
                            >
                                <option value="all">All Groups</option>
                                <option value="none">Not Assigned</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search & Enter..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
                                className="pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest w-64 focus:ring-2 focus:ring-green-500 outline-none transition-all"
                            />
                            <Search
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 cursor-pointer hover:text-green-500 transition-colors"
                                onClick={() => setSearch(searchInput)}
                            />
                        </div>

                        <button
                            onClick={() => handlePrintMode('full')}
                            disabled={selectedBadges.length === 0}
                            className="bg-gray-900 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-black transition disabled:opacity-30 flex items-center gap-2"
                        >
                            <Printer className="w-4 h-4" />
                            Print Selected ({selectedBadges.length})
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-6">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-40">
                        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="mt-4 text-gray-400 font-bold uppercase tracking-widest text-sm">Syncing Data...</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 print:block">
                            <style jsx global>{`
                                @media print {
                                    @page { margin: 0; size: 9.5cm 6cm; }
                                    header, .print\:hidden, .pagination { display: none !important; }
                                    .badge-card:not(.selected) { display: none !important; }
                                    .badge-card.selected {
                                        display: block !important;
                                        width: 9.5cm !important;
                                        height: 6cm !important;
                                        page-break-after: always !important;
                                        margin: 0 !important;
                                        border: none !important;
                                    }
                                }
                            `}</style>

                            {paginatedBadges.map((badge) => {
                                const isSelected = selectedBadges.includes(badge.id);
                                return (
                                    <div
                                        key={badge.id}
                                        className={`badge-card bg-white rounded-3xl overflow-hidden border-2 transition-all duration-300 relative group cursor-pointer shadow-sm hover:shadow-xl ${isSelected ? 'border-green-500 ring-4 ring-green-500/10 selected' : 'border-gray-100'}`}
                                        onClick={() => toggleBadgeSelection(badge.id)}
                                    >
                                        {/* Status Indicators */}
                                        <div className="absolute top-4 left-4 z-20 flex gap-2 print:hidden">
                                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${badge.paymentStatus === 'PAY_SUCCESS' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                                                {badge.paymentStatus === 'PAY_SUCCESS' ? 'Paid' : 'Pending'}
                                            </div>
                                            {badge.isBadgePrinted && (
                                                <div className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                                                    <Check className="w-2.5 h-2.5" /> Printed
                                                </div>
                                            )}
                                        </div>

                                        {/* Badge Body */}
                                        <div className="relative w-full aspect-[9.5/6]">
                                            <img src={badgeTemplateSrc} className="absolute inset-0 w-full h-full object-cover" />

                                            {/* QR Overlay */}
                                            <div className="absolute left-[9.5%] bottom-[9.5%] w-[21%] aspect-square flex items-center justify-center p-1">
                                                <QRCodeSVG value={badge.id} size={100} level="H" bgColor="transparent" fgColor="#FFFFFF" />
                                            </div>

                                            {/* Ticket Num */}
                                            <div className="absolute top-[8%] right-[2%] w-[18%] h-[12%] flex items-center justify-center">
                                                <span className="text-white font-mono text-[10px] font-black tracking-widest">
                                                    {badge.ticketNumber?.toString().padStart(4, '0') || '0000'}
                                                </span>
                                            </div>

                                            {/* Name */}
                                            <div className="absolute right-0 top-[8%] bottom-[8%] w-[62%] flex flex-col items-center justify-center text-center px-4">
                                                <h2 className="text-[16px] font-black text-[#5D2E17] uppercase leading-none line-clamp-2">
                                                    {badge.fullName}
                                                </h2>
                                                <p className="text-[9px] font-bold text-gray-500 mt-2 uppercase tracking-wide truncate max-w-full">
                                                    {badge.churchName}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="pagination mt-12 flex items-center justify-center gap-6 print:hidden">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="bg-white border border-gray-200 px-6 py-2 rounded-xl font-bold text-sm disabled:opacity-30 hover:bg-gray-50 transition shadow-sm"
                                >
                                    Previous
                                </button>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-black text-gray-400 uppercase">Page</span>
                                    <span className="bg-green-500 text-white w-10 h-10 flex items-center justify-center rounded-xl font-black">{currentPage}</span>
                                    <span className="text-xs font-black text-gray-400 uppercase">of {totalPages}</span>
                                </div>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="bg-white border border-gray-200 px-6 py-2 rounded-xl font-bold text-sm disabled:opacity-30 hover:bg-gray-50 transition shadow-sm"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
