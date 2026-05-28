'use client'
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { QRCodeSVG } from 'qrcode.react';
import { authClient } from "@/lib/auth-client";
import {
    Printer, LayoutDashboard, Users, UserCheck, FileText,
    Search, Download, Building2, ChevronDown, Bell, Moon, X,
    CalendarCheck, Utensils, Coffee, Gift, ArrowLeft, LogOut,
    UserPlus, ShieldCheck, FileClock, Filter, MessageSquare, Database, QrCode,
    Tags, Store, UsersRound, Check
} from 'lucide-react';
import Image from "next/image";
import { DashboardMobileMenuButton } from "@/components/DashboardLayout";
import { AuthGate } from "@/components/AuthGate";
import {
    getDefaultBadgeTemplateSrc,
    resolveBadgeTemplateSrcFromSettings,
} from '@/lib/badge-template';
import { formatSummitPersonName } from '@/lib/summit-registration-config';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';
import {
    downloadBadgeImageFile,
    downloadBadgeImagesBatch,
} from '@/lib/badge-download-client';

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

export default function BadgePrintPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loginError, setLoginError] = useState("");
    const { data: session, isPending } = authClient.useSession();
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    const activeOrganizationId = (session?.user as { activeOrganizationId?: string | null } | undefined)?.activeOrganizationId;
    const loggedIn = !!session;

    // Auth Check
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

    const [badges, setBadges] = useState<Badge[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;
    const [statusFilter, setStatusFilter] = useState<'all' | 'PAY_SUCCESS' | 'pending'>('PAY_SUCCESS');
    const [selectedBadges, setSelectedBadges] = useState<string[]>([]);
    const [printedFilter, setPrintedFilter] = useState<'all' | 'printed' | 'unprinted'>('all');
    const [printMode, setPrintMode] = useState<'full' | 'qr-only'>('full');
    const [showLoginForm, setShowLoginForm] = useState(false);
    const [vendorFilter, setVendorFilter] = useState<string>('all');
    const [groupFilter, setGroupFilter] = useState<string>('all');
    const [vendors, setVendors] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [permissions, setPermissions] = useState<string[]>([]);
    const [currentRole, setCurrentRole] = useState<string>('');
    const [badgeTemplateSrc, setBadgeTemplateSrc] = useState(getDefaultBadgeTemplateSrc());
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<{ done: number; total: number } | null>(null);

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
            const { error } = await authClient.signIn.email({
                email,
                password,
            });

            if (error) {
                setLoginError(error.message || "Invalid email or password");
            } else {
                setLoginError("");
            }
        } catch (err) {
            setLoginError("An error occurred. Please try again.");
        }
    };

    const handleLogout = async () => {
        await authClient.signOut();
    };

    const handleSendSMS = (badge: Badge) => {
        const baseUrl = window.location.origin;
        // Extract the real numeric ID from the badge ID (e.g., CLS-123-1 -> 123)
        const idMatch = badge.id.match(/CLS-(\d+)/);
        const realId = idMatch ? idMatch[1] : badge.id;
        const type = badge.id.includes('-') && badge.id.split('-').length > 2 ? 'group' : 'individual';
        const link = `${baseUrl}/register?trade_status=PAY_SUCCESS&callback_info=${type}_${realId}`;
        const message = `Hello ${badge.fullName}, your registration for GCME Summit 2026 is confirmed. You can view and download your badge here: ${link}`;
        const encodedMessage = encodeURIComponent(message);
        window.location.href = `sms:${badge.phoneNumber}?body=${encodedMessage}`;
    };

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

            const flattenedBadges: Badge[] = data.flatMap((reg) => {
                const badgesList: Badge[] = [];
                if (reg.isGroup && reg.attendees && reg.attendees.length > 0) {
                    reg.attendees.forEach((att: any, idx) => {
                        const vendorMatches = vendorFilter === 'all' || att.vendorId === vendorFilter;
                        const groupMatches = groupFilter === 'all' ||
                            (groupFilter === 'none' ? !att.groupId : att.groupId === groupFilter);

                        if (vendorMatches && groupMatches) {
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
                    // If vendor filter is active, only include if reg matches
                    const vendorMatches = vendorFilter === 'all' || reg.vendorId === vendorFilter;
                    const groupMatches = groupFilter === 'all' ||
                        (groupFilter === 'none' ? !reg.groupId : reg.groupId === groupFilter);

                    if (vendorMatches && groupMatches) {
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

    const handleBackfillTickets = async () => {
        if (!confirm('This will assign sequential ticket numbers to all currently PAID registrations. Continue?')) return;
        setLoading(true);
        try {
            const res = await fetch('/api/admin/backfill_tickets', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert('Ticket numbers assigned successfully!');
                fetchBadges();
            } else {
                alert(data.error || 'Failed to backfill tickets');
            }
        } catch (err) {
            console.error(err);
            alert('Error connecting to backfill service');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (loggedIn) {
            fetchBadges();
            fetchVendors();
            fetchGroups();
            setCurrentPage(1);
        }
    }, [loggedIn, statusFilter, vendorFilter, groupFilter, search, printedFilter]);


    const fetchVendors = async () => {
        try {
            const res = await fetch('/api/vendors');
            const data = await res.json();
            setVendors(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchGroups = async () => {
        try {
            const res = await fetch('/api/groups');
            const data = await res.json();
            setGroups(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
        }
    };

    // Use session-based permissions instead of separate fetch
    useEffect(() => {
        if (session?.user) {
            const su = session.user as {
                permissions?: string[];
                role?: string;
                legacyRole?: string;
                orgRole?: string | null;
                isPlatformSuperAdmin?: boolean;
            };
            const userPerms = su.permissions || [];
            const role = su.role || '';
            setPermissions(userPerms);
            setCurrentRole(role);

            const appRole = su.legacyRole ?? su.role;
            const orgRole = su.orgRole;
            const canAccess =
                hasPlatformElevatedAccess(su.isPlatformSuperAdmin, appRole) ||
                orgRole === 'OWNER' ||
                orgRole === 'ADMIN' ||
                userPerms.includes('view_registrations') ||
                userPerms.includes('edit_registrations');
            setIsAuthorized(canAccess);
        }
    }, [sessionUserId]);

    useEffect(() => {
        if (!sessionUserId) return;
        const activeId = activeOrganizationId;
        fetch('/api/orgs', { credentials: 'include' })
            .then((r) => r.json())
            .then((d) => {
                const orgs = d.organizations || [];
                const org = orgs.find((o: { id: string }) => o.id === activeId);
                if (org) {
                    setBadgeTemplateSrc(resolveBadgeTemplateSrcFromSettings(org.settings));
                } else {
                    setBadgeTemplateSrc(getDefaultBadgeTemplateSrc());
                }
            })
            .catch(() => setBadgeTemplateSrc(getDefaultBadgeTemplateSrc()));
    }, [sessionUserId, activeOrganizationId]);


    const filteredBadges = badges.filter(b => {
        const s = search.toLowerCase();

        // Simple variations for search
        const phone = b.phoneNumber.toLowerCase();
        let isPhoneMatch = false;
        if (s.length >= 3) {
            // If search is numeric-ish, try variations
            const cleanS = s.replace(/[^\d]/g, '');
            if (cleanS.length >= 3) {
                const core = cleanS.startsWith('0') ? cleanS.substring(1) : (cleanS.startsWith('251') ? cleanS.substring(3) : cleanS);
                isPhoneMatch = phone.includes(core);
            }
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
        const badge = badges.find(b => b.id === id);
        if (!badge || badge.paymentStatus !== 'PAY_SUCCESS') return;

        setSelectedBadges(prev =>
            prev.includes(id) ? prev.filter(bid => bid !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        const selectableFiltered = filteredBadges.filter(b => b.paymentStatus === 'PAY_SUCCESS');

        if (selectedBadges.length === selectableFiltered.length && selectableFiltered.length > 0) {
            setSelectedBadges([]);
        } else {
            setSelectedBadges(selectableFiltered.map(b => b.id));
        }
    };

    const handlePrintMode = (mode: 'full' | 'qr-only') => {
        setPrintMode(mode);
        // We wait a tiny bit for state to update before printing
        setTimeout(async () => {
            window.print();
            // Automatically mark as printed after printing
            if (selectedBadges.length > 0) {
                try {
                    await fetch('/api/badges/mark-printed', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ badgeIds: selectedBadges })
                    });
                    fetchBadges(); // Refresh status
                } catch (err) {
                    console.error('Failed to mark as printed:', err);
                }
            }
        }, 100);
    };

    const handlePrintSingleQR = (id: string) => {
        setSelectedBadges([id]);
        setPrintMode('qr-only');
        setTimeout(() => {
            window.print();
        }, 100);
    };

    const getDownloadTargets = (ids?: string[]): { id: string; fullName: string }[] => {
        const source = ids?.length
            ? badges.filter((b) => ids.includes(b.id))
            : filteredBadges.filter((b) => b.paymentStatus === 'PAY_SUCCESS');
        return source.map((b) => ({ id: b.id, fullName: b.fullName }));
    };

    const handleDownloadBadges = async (ids?: string[]) => {
        const targets = getDownloadTargets(ids);
        if (targets.length === 0) {
            alert('No paid badges available to download in the current view.');
            return;
        }
        if (
            targets.length > 1 &&
            !confirm(
                `Download ${targets.length} badge images? Your browser may ask to allow multiple downloads.`
            )
        ) {
            return;
        }

        setIsDownloading(true);
        setDownloadProgress({ done: 0, total: targets.length });
        try {
            if (targets.length === 1) {
                await downloadBadgeImageFile(targets[0].id, targets[0].fullName);
                setDownloadProgress({ done: 1, total: 1 });
            } else {
                await downloadBadgeImagesBatch(targets, (done, total) => {
                    setDownloadProgress({ done, total });
                });
            }
        } catch (err) {
            console.error(err);
            alert(err instanceof Error ? err.message : 'Failed to download badge images');
        } finally {
            setIsDownloading(false);
            setTimeout(() => setDownloadProgress(null), 2000);
        }
    };

    const handleDownloadSingleBadge = async (badge: Badge) => {
        if (badge.paymentStatus !== 'PAY_SUCCESS') return;
        setIsDownloading(true);
        setDownloadProgress({ done: 0, total: 1 });
        try {
            await downloadBadgeImageFile(badge.id, badge.fullName);
            setDownloadProgress({ done: 1, total: 1 });
        } catch (err) {
            console.error(err);
            alert(err instanceof Error ? err.message : 'Failed to download badge');
        } finally {
            setIsDownloading(false);
            setTimeout(() => setDownloadProgress(null), 1500);
        }
    };



    if (isAuthorized === null && loggedIn) return <div className="p-10 text-center">Checking permissions...</div>;

    if (isAuthorized === false && loggedIn) return (
        <AuthGate
            variant="forbidden"
            title="Access denied"
            message="You do not have permission to view or print badges."
            actionLabel="Back to Dashboard"
            actionHref="/dashboard"
        />
    );

    return (
        <>
                <header className="bg-white border-b border-gray-100 px-4 lg:px-8 py-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sticky top-0 z-30 print:hidden">
                    <div className="flex items-center gap-4 w-full lg:w-auto">
                        <DashboardMobileMenuButton />
                        <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-lg transition hidden lg:block">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </Link>
                        <div>
                            <h1 className="text-xl lg:text-2xl font-bold text-gray-800">Badge Printing</h1>
                            <p className="text-gray-500 text-xs lg:text-sm">Generate and print attendee badges</p>
                        </div>
                    </div>

                    <div className="flex items-center flex-wrap gap-3 lg:gap-4 w-full lg:w-auto">
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
                            <Filter className="w-4 h-4 text-gray-400" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="bg-transparent border-none text-sm font-bold text-gray-600 focus:ring-0 cursor-pointer"
                            >
                                <option value="all">All Status</option>
                                <option value="PAY_SUCCESS">Successful</option>
                                <option value="pending">Pending</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
                            <Store className="w-4 h-4 text-gray-400" />
                            <select
                                value={vendorFilter}
                                onChange={(e) => setVendorFilter(e.target.value)}
                                className="bg-transparent border-none text-sm font-bold text-gray-600 focus:ring-0 cursor-pointer"
                            >
                                <option value="all">All Vendors</option>
                                {vendors.map(v => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
                            <UsersRound className="w-4 h-4 text-gray-400" />
                            <select
                                value={groupFilter}
                                onChange={(e) => setGroupFilter(e.target.value)}
                                className="bg-transparent border-none text-sm font-bold text-gray-600 focus:ring-0 cursor-pointer"
                            >
                                <option value="all">All Groups</option>
                                {groups.map(g => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
                            <Printer className="w-4 h-4 text-gray-400" />
                            <select
                                value={printedFilter}
                                onChange={(e) => setPrintedFilter(e.target.value as any)}
                                className="bg-transparent border-none text-sm font-bold text-gray-600 focus:ring-0 cursor-pointer"
                            >
                                <option value="all">All Printed Status</option>
                                <option value="printed">Printed Only</option>
                                <option value="unprinted">Not Printed Only</option>
                            </select>
                        </div>
                        <div className="relative">
                            <Search
                                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 cursor-pointer hover:text-[#22C55E] transition-colors"
                                onClick={() => { setSearch(searchInput); setCurrentPage(1); }}
                            />
                            <input
                                type="text"
                                placeholder="Search by name, church or ID..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setSearch(searchInput);
                                        setCurrentPage(1);
                                    }
                                }}
                                className="pl-12 pr-4 py-2.5 w-64 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-[#22C55E]/10 transition"
                            />
                        </div>
                        <div className="flex items-center flex-wrap gap-2 lg:gap-3">
                            <button
                                onClick={() => {
                                    if (selectedBadges.length > 0) {
                                        handlePrintMode('full');
                                    } else {
                                        const selectableFiltered = filteredBadges.filter(b => b.paymentStatus === 'PAY_SUCCESS');
                                        if (selectableFiltered.length === 0) {
                                            alert('No successful payments to print in current view');
                                            return;
                                        }
                                        setSelectedBadges(selectableFiltered.map(b => b.id));
                                        handlePrintMode('full');
                                    }
                                }}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white rounded-xl font-medium hover:bg-black transition shadow-lg"
                            >
                                <Printer className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                                {selectedBadges.length > 0 ? `Print (${selectedBadges.length})` : 'Print All Successful'}
                            </button>
                            <button
                                onClick={() => handlePrintMode('qr-only')}
                                disabled={selectedBadges.length === 0}
                                className={`flex items-center gap-2 px-4 lg:px-5 py-2 lg:py-2.5 rounded-xl font-medium transition shadow-lg text-xs lg:text-sm whitespace-nowrap ${selectedBadges.length > 0
                                    ? 'bg-[#22C55E] text-white hover:bg-[#16A34A] shadow-[#22C55E]/20'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                            >
                                <QRCodeSVG value="test" size={14} />
                                Print Selected (QR Only)
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (selectedBadges.length > 0) {
                                        handleDownloadBadges(selectedBadges);
                                    } else {
                                        handleDownloadBadges();
                                    }
                                }}
                                disabled={isDownloading}
                                className="flex items-center gap-2 px-4 lg:px-5 py-2 lg:py-2.5 rounded-xl font-medium transition shadow-lg text-xs lg:text-sm whitespace-nowrap bg-slate-700 text-white hover:bg-slate-900 disabled:opacity-60"
                            >
                                <Download className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                                {isDownloading
                                    ? downloadProgress
                                        ? `Downloading (${downloadProgress.done}/${downloadProgress.total})`
                                        : 'Downloading…'
                                    : selectedBadges.length > 0
                                      ? `Download (${selectedBadges.length})`
                                      : 'Download All Paid'}
                            </button>
                            <div className="flex items-center gap-1 ml-auto lg:ml-0">
                                <button
                                    onClick={handleBackfillTickets}
                                    className="p-2 lg:p-2.5 hover:bg-amber-50 rounded-xl transition text-amber-600"
                                    title="Backfill Ticket Numbers"
                                >
                                    <Database className="w-4 h-4 lg:w-5 lg:h-5" />
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="p-2 lg:p-2.5 hover:bg-gray-100 rounded-xl transition text-gray-600 hover:text-red-600"
                                    title="Logout"
                                >
                                    <LogOut className="w-4 h-4 lg:w-5 lg:h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="p-4 lg:p-8 print:p-0">
                    <div className="mb-6 flex items-center justify-between print:hidden">
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={selectedBadges.length === filteredBadges.filter(b => b.paymentStatus === 'PAY_SUCCESS').length && filteredBadges.filter(b => b.paymentStatus === 'PAY_SUCCESS').length > 0}
                                onChange={toggleSelectAll}
                                className="w-5 h-5 accent-[#22C55E] rounded border-gray-300 transition cursor-pointer"
                            />
                            <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">Select All ({filteredBadges.filter(b => b.paymentStatus === 'PAY_SUCCESS').length})</span>
                        </div>
                        <div className="flex items-center gap-4">
                            {selectedBadges.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => handleDownloadBadges(selectedBadges)}
                                    disabled={isDownloading}
                                    className="flex items-center gap-2 px-4 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-[10px] font-black hover:bg-slate-200 transition shadow-sm disabled:opacity-50"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    DOWNLOAD IMAGES ({selectedBadges.length})
                                </button>
                            )}
                            {selectedBadges.length > 0 && (
                                <button
                                    onClick={() => {
                                        const selectedList = badges.filter(b => selectedBadges.includes(b.id));
                                        if (confirm(`Send SMS for ${selectedList.length} participants? This will open your SMS app for each one sequentially.`)) {
                                            selectedList.forEach((badge, index) => {
                                                setTimeout(() => {
                                                    handleSendSMS(badge);
                                                }, index * 1000);
                                            });
                                        }
                                    }}
                                    className="flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full text-[10px] font-black hover:bg-blue-100 transition shadow-sm"
                                >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    SEND SMS ({selectedBadges.length})
                                </button>
                            )}
                            {selectedBadges.length > 0 && (
                                <button
                                    onClick={async () => {
                                        if (!confirm(`Mark ${selectedBadges.length} selected badges as printed?`)) return;
                                        try {
                                            await fetch('/api/badges/mark-printed', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ badgeIds: selectedBadges, status: true })
                                            });
                                            fetchBadges();
                                            setSelectedBadges([]);
                                        } catch (err) {
                                            alert('Failed to mark badges as printed');
                                        }
                                    }}
                                    className="flex items-center gap-2 px-4 py-1.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-full text-[10px] font-black hover:bg-amber-100 transition shadow-sm"
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                    MARK AS PRINTED ({selectedBadges.length})
                                </button>
                            )}
                            {selectedBadges.length > 0 && (
                                <button
                                    onClick={async () => {
                                        if (!confirm(`Unmark ${selectedBadges.length} selected badges as printed?`)) return;
                                        try {
                                            await fetch('/api/badges/mark-printed', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ badgeIds: selectedBadges, status: false })
                                            });
                                            fetchBadges();
                                            setSelectedBadges([]);
                                        } catch (err) {
                                            alert('Failed to unmark badges');
                                        }
                                    }}
                                    className="flex items-center gap-2 px-4 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-full text-[10px] font-black hover:bg-red-100 transition shadow-sm"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    UNMARK PRINTED ({selectedBadges.length})
                                </button>
                            )}
                            {selectedBadges.length > 0 && (
                                <span className="bg-[#22C55E] text-white px-4 py-1.5 rounded-full text-xs font-black shadow-lg shadow-[#22C55E]/20">
                                    {selectedBadges.length} SELECTED
                                </span>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-[#22C55E] border-t-transparent rounded-full animate-spin"></div>
                            <p className="mt-4 text-gray-500 font-medium">Preparing badges...</p>
                        </div>
                    ) : (
                        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-5 print:block ${printMode === 'full' ? 'mode-full' : 'mode-qr-only'}`}>
                            <style jsx global>{`
                                @media print {
                                    @page { margin: 0; size: 9.5cm 6cm; }
                                    header, aside, .print\:hidden { display: none !important; }
                                    main { margin-left: 0 !important; padding: 0 !important; }
                                    body { overflow: visible !important; background: white; margin: 0; padding: 0; }
                                    
                                    /* Handle Full Ticket Printing */
                                    .mode-full .badge-container:not(.selected) { display: none !important; }
                                    .mode-full .badge-container.selected {
                                        display: flex !important;
                                        break-inside: avoid !important;
                                        page-break-inside: avoid !important;
                                        width: 9.5cm !important;
                                        height: 6cm !important;
                                        margin: 0 !important;
                                        page-break-after: always !important;
                                        float: none !important;
                                        border: none !important;
                                        box-shadow: none !important;
                                        position: relative !important;
                                    }
                                    .mode-full .qr-print-only { display: none !important; }
 
                                    /* Handle QR Only Printing */
                                    .mode-qr-only .badge-container:not(.selected) { display: none !important; }
                                    .mode-qr-only .badge-container.selected {
                                        width: 9.5cm !important;
                                        height: 6cm !important;
                                        margin: 0 !important;
                                        float: left !important;
                                        border: 1px dashed #ccc !important;
                                        display: flex !important;
                                        align-items: center !important;
                                        justify-content: center !important;
                                        flex-direction: column !important;
                                        background: white !important;
                                        box-shadow: none !important;
                                    }
                                    .mode-qr-only .badge-container.selected .full-ticket-info { display: none !important; }
                                }
                                }
                            `}</style>

                            {paginatedBadges.map((badge) => {
                                const isSelected = selectedBadges.includes(badge.id);
                                return (
                                    <div
                                        key={badge.id}
                                        className={`bg-white shadow-xl border overflow-hidden flex flex-row relative badge-container hover:shadow-2xl transition-all duration-300 group w-[9.5cm] h-[6cm]
                                            ${isSelected ? 'border-[#22C55E] ring-4 ring-[#22C55E]/5 selected' : 'border-gray-100'} 
                                            ${badge.paymentStatus !== 'PAY_SUCCESS' ? 'opacity-75' : ''}`}
                                    >
                                        {/* Selection Overlay (Screen Only) */}
                                        <div className="absolute top-4 left-4 z-20 print:hidden flex flex-wrap items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                disabled={badge.paymentStatus !== 'PAY_SUCCESS'}
                                                onChange={() => toggleBadgeSelection(badge.id)}
                                                className={`w-6 h-6 accent-[#22C55E] rounded-lg border-2 border-white shadow-lg transition transform hover:scale-110 ${badge.paymentStatus !== 'PAY_SUCCESS' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                                            />
                                            {badge.paymentStatus !== 'PAY_SUCCESS' && (
                                                <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-200">
                                                    PENDING
                                                </span>
                                            )}
                                            {badge.paymentStatus === 'PAY_SUCCESS' && (
                                                <span className="bg-green-100 text-green-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-green-200">
                                                    PAID
                                                </span>
                                            )}
                                            {badge.isBadgePrinted && (
                                                <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                                                    <Check className="w-2.5 h-2.5" />
                                                    PRINTED
                                                </span>
                                            )}
                                        </div>

                                        <div className="absolute top-4 right-4 z-20 print:hidden opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2">
                                            <button
                                                onClick={() => {
                                                    setSelectedBadges([badge.id]);
                                                    handlePrintMode('full');
                                                }}
                                                className="p-2 bg-white/90 backdrop-blur shadow-xl rounded-xl text-gray-700 hover:text-[#22C55E] transition"
                                                title="Print Full Badge"
                                            >
                                                <Printer className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handlePrintSingleQR(badge.id)}
                                                className="p-2 bg-white/90 backdrop-blur shadow-xl rounded-xl text-gray-700 hover:text-[#22C55E] transition"
                                                title="Print QR Only"
                                            >
                                                <QrCode className="w-5 h-5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDownloadSingleBadge(badge)}
                                                disabled={badge.paymentStatus !== 'PAY_SUCCESS' || isDownloading}
                                                className={`p-2 bg-white/90 backdrop-blur shadow-xl rounded-xl transition ${badge.paymentStatus === 'PAY_SUCCESS' ? 'text-gray-700 hover:text-slate-900' : 'text-gray-300 cursor-not-allowed'}`}
                                                title="Download badge image"
                                            >
                                                <Download className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleSendSMS(badge)}
                                                disabled={badge.paymentStatus !== 'PAY_SUCCESS'}
                                                className={`p-2 bg-white/90 backdrop-blur shadow-xl rounded-xl transition ${badge.paymentStatus === 'PAY_SUCCESS' ? 'text-blue-600 hover:text-blue-700' : 'text-gray-300 cursor-not-allowed'}`}
                                                title="Send Badge via SMS"
                                            >
                                                <MessageSquare className="w-5 h-5" />
                                            </button>
                                            {badge.isBadgePrinted && (
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm('Unmark this badge as printed?')) return;
                                                        try {
                                                            await fetch('/api/badges/mark-printed', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ badgeIds: [badge.id], status: false })
                                                            });
                                                            fetchBadges();
                                                        } catch (err) {
                                                            alert('Failed to unmark badge');
                                                        }
                                                    }}
                                                    className="p-2 bg-white/90 backdrop-blur shadow-xl rounded-xl text-red-500 hover:text-red-700 transition"
                                                    title="Unmark as Printed"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Full Ticket Info - Using Template Image */}
                                        <div className="full-ticket-info relative w-full h-full overflow-hidden" style={{ WebkitPrintColorAdjust: 'exact' }}>
                                            {/* Background Image Tag (Better for Printing) */}
                                            <img
                                                src={badgeTemplateSrc}
                                                alt="Badge Template"
                                                className="absolute inset-0 w-full h-full object-cover z-0"
                                            />

                                            <div className="qr-container absolute left-[9.5%] bottom-[9.5%] w-[20%] aspect-square flex items-center justify-center p-1 z-10">
                                                <QRCodeSVG
                                                    value={badge.id}
                                                    size={500}
                                                    level="H"
                                                    bgColor="transparent"
                                                    fgColor="#FFFFFF"
                                                    className="w-full h-full drop-shadow-sm"
                                                />
                                            </div>

                                            <div className="absolute top-[4%]  right-[2%]  w-[18%] h-[12%] flex items-center justify-center z-10">
                                                <span className="font-mono text-[12px] ticket-num-print font-black text-white tracking-widest drop-shadow-sm">
                                                    {badge.ticketNumber ? badge.ticketNumber.toString().padStart(4, '0') : '0000'}
                                                </span>
                                            </div>

                                            {/* Name Overlay - Centered in white area */}
                                            <div className="absolute right-0 top-[10%] bottom-[12%] w-[62%] flex flex-col items-center justify-center text-center px-4 z-10">
                                                <h2 className="text-[21px] full-name-print font-black text-[#5D2E17] leading-tight line-clamp-2 uppercase drop-shadow-sm" style={{ fontFamily: 'system-ui, sans-serif' }}>
                                                    {badge.fullName}
                                                </h2>
                                                {badge.group?.name && (
                                                    <span className="mt-1 bg-green-100 text-[#22C55E] text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-200 print:hidden">
                                                        {badge.group.name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="qr-print-only hidden print:flex items-center justify-center w-full h-full">
                                            <div className="text-center p-4">
                                                <QRCodeSVG value={badge.id} size={100} />
                                                <p className="mt-4 font-mono text-xl font-black text-gray-900">{badge.id}</p>
                                                <p className="mt-1 text-gray-400 font-bold uppercase tracking-[0.2em] text-[10px]">GCME SUMMIT 2026</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Pagination Controls */}
                    {totalPages > 1 && !loading && (
                        <div className="mt-8 mb-12 flex items-center justify-center gap-6 print:hidden">
                            <button
                                onClick={() => {
                                    setCurrentPage(p => Math.max(1, p - 1));
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                disabled={currentPage === 1}
                                className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-black text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition shadow-sm"
                            >
                                <ChevronDown className="w-4 h-4 rotate-90" />
                                Previous
                            </button>

                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Page</span>
                                <span className="w-10 h-10 flex items-center justify-center bg-[#22C55E] text-white rounded-xl font-black text-sm shadow-lg shadow-[#22C55E]/20">
                                    {currentPage}
                                </span>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">of {totalPages}</span>
                            </div>

                            <button
                                onClick={() => {
                                    setCurrentPage(p => Math.min(totalPages, p + 1));
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                disabled={currentPage === totalPages}
                                className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-black text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition shadow-sm"
                            >
                                Next
                                <ChevronDown className="w-4 h-4 -rotate-90" />
                            </button>
                        </div>
                    )}
                </div>
        </>
    );
}
