'use client'
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { usePathname } from 'next/navigation';
import { authClient } from "@/lib/auth-client";
import {
    Search, Download, ArrowUpDown, ChevronUp, ChevronDown,
    CalendarCheck, Utensils, Coffee, Gift, X, User, Phone, Mail,
    Tag, CreditCard, Clock, LayoutDashboard, Users, BarChart3,
    Settings, HelpCircle, Bell, FileText, CheckCircle2, DollarSign,
    ChevronRight, Building2, ArrowLeft, UserCheck, LogOut, UserPlus, ShieldCheck, FileClock,
    ExternalLink, Trash2, MessageSquare, RefreshCw, RotateCcw, Tags, Store, UsersRound, MoreHorizontal
} from 'lucide-react';
import Image from "next/image";
import { DashboardMobileMenuButton } from "@/components/DashboardLayout";
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';
import { formatSummitPersonName } from '@/lib/summit-registration-config';
import {
    RegistrationPaymentAttachment,
    uploadRegistrationReceipt,
} from '@/components/dashboard/RegistrationPaymentAttachment';



interface Registration {
    id: number;
    title?: string;
    fullName: string;
    churchName: string;
    serviceRole: string;
    phoneNumber: string;
    amount: string;
    paymentStatus: string;
    paymentType?: string;
    createdAt: string;
    isGroup?: boolean;
    checkedIn?: boolean;
    checkedInAt?: string;
    discountApplied?: string;
    couponCode?: string;
    email?: string;
    receiptPath?: string | null;
    transactionReference?: string | null;
    vendorId?: string;
    vendor?: { name: string };
    groupId?: string;
    group?: { name: string };
    activities?: Record<string, string>;
    responses?: Record<string, any>;
    ticketNumber?: number;
    attendees?: {
        id: number;
        title?: string;
        fullName: string;
        role: string;
        amount: string;
        phoneNumber?: string;
        checkedIn?: boolean;
        checkedInAt?: string;
        vendorId?: string;
        vendor?: { name: string };
        groupId?: string;
        group?: { name: string };
        activities?: Record<string, string>;
        responses?: Record<string, any>;
        ticketNumber?: number;
    }[];
}

export default function RegistrationHistoryPage() {
    const { data: session, isPending } = authClient.useSession();
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;


    const [transactions, setTransactions] = useState<Registration[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [limit] = useState(50);

    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [sortBy, setSortBy] = useState("createdAt");
    const [sortOrder, setSortOrder] = useState("desc");
    const [statusFilter, setStatusFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState("all");
    const [showFilters, setShowFilters] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedRow, setSelectedRow] = useState<any | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editFormData, setEditFormData] = useState<Partial<Registration>>({});
    const [pendingReceiptFile, setPendingReceiptFile] = useState<File | null>(null);
    const [pendingReceiptPreview, setPendingReceiptPreview] = useState<string | null>(null);

    const [showTitleField, setShowTitleField] = useState(true);
    const [paymentTypeLabelMap, setPaymentTypeLabelMap] = useState<Record<string, string>>({});
    const [paymentTypeInfoMap, setPaymentTypeInfoMap] = useState<
        Record<string, { label: string; shortLabel: string }>
    >({});

    const [dashboardData, setDashboardData] = useState({
        totalRegistrations: 0,
        totalRevenue: 0,
        cashRevenue: 0,
        totalCashCount: 0,
        sponsoredRevenue: 0,
        allTransactionsRevenue: 0,
        sponsoredCount: 0,
        totalPending: 0,
        totalCompleted: 0,
        telebirrRevenue: 0,
        telebirrCount: 0,
        telebirrTotalCount: 0,
        cbeRevenue: 0,
        cbeCount: 0,
        cbeTotalCount: 0,
        brnRevenue: 0,
        brnCount: 0,
        brnTotalCount: 0,
        bankTransferRevenue: 0,
        bankTransferCount: 0,
        bankTransferTotalCount: 0
    });

    const getPaymentTypeDisplay = (paymentType?: string) => {
        const raw = (paymentType || '').trim();
        if (!raw) return { label: 'Telebirr', shortLabel: 'TB' };
        if (paymentTypeInfoMap[raw]) return paymentTypeInfoMap[raw];
        if (paymentTypeLabelMap[raw]) {
            return { label: raw.replace(/_/g, ' '), shortLabel: paymentTypeLabelMap[raw] };
        }
        if (raw === 'TELEBIRR') return { label: 'Telebirr', shortLabel: 'TB' };
        if (raw === 'BANK_TRANSFER') return { label: 'Bank Transfer', shortLabel: 'BANK' };
        if (raw.startsWith('BANK_')) {
            const idx = Number(raw.split('_')[1]);
            return Number.isFinite(idx)
                ? { label: `Bank ${idx + 1}`, shortLabel: `BANK ${idx + 1}` }
                : { label: 'Bank', shortLabel: 'BANK' };
        }
        const normalized = raw.replace(/_/g, ' ').toUpperCase();
        return { label: normalized, shortLabel: normalized };
    };

    const [showLoginForm, setShowLoginForm] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [permissions, setPermissions] = useState<string[]>([]);
    const [currentRole, setCurrentRole] = useState<string>('');
    const su = session?.user as { isPlatformSuperAdmin?: boolean; legacyRole?: string; role?: string } | undefined;
    const isPlatformAdmin = hasPlatformElevatedAccess(su?.isPlatformSuperAdmin, su?.legacyRole ?? su?.role);
    const canEditPayment =
        isPlatformAdmin ||
        permissions.includes('edit_registrations') ||
        permissions.includes('manage_payments');

    const clearReceiptPending = () => {
        if (pendingReceiptPreview) URL.revokeObjectURL(pendingReceiptPreview);
        setPendingReceiptFile(null);
        setPendingReceiptPreview(null);
    };
    const [checkingIds, setCheckingIds] = useState<number[]>([]);
    const [showBulkGroupModal, setShowBulkGroupModal] = useState(false);
    const [assigningLoading, setAssigningLoading] = useState(false);
    const pathname = usePathname();

    const handleLogout = async () => {
        await authClient.signOut();
    };

    const navItems = [
        { href: "/list", label: "Overview", icon: LayoutDashboard },
        { href: "/admin-register", label: "New Registration", icon: UserPlus },
        { href: "/history", label: "All Registration", icon: Users },
        { href: "/groups", label: "Groups", icon: UsersRound },
        { href: "/vendors", label: "Vendors", icon: Store },
        { href: "/badges", label: "Badges", icon: FileText },
        { href: "/attendance", label: "Check-In", icon: UserCheck },
        { href: "/batches", label: "Batch and Prefix", icon: Tags },
        { href: "/users", label: "User Management", icon: ShieldCheck },
    ];

    const [vendors, setVendors] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [groupFilter, setGroupFilter] = useState("all");
    const [vendorFilter, setVendorFilter] = useState("all");

    // Manual search trigger - replaced auto-debounce



    const handleSendSMS = (reg: any) => {
        const baseUrl = window.location.origin;
        const type = reg.isGroup ? 'group' : 'individual';
        const link = `${baseUrl}/register?trade_status=PAY_SUCCESS&callback_info=${type}_${reg.id}`;
        const message = `Hello ${reg.fullName}, your registration for GCME Summit 2026 is confirmed. You can view and download your badge here: ${link}`;
        const encodedMessage = encodeURIComponent(message);
        window.location.href = `sms:${reg.phoneNumber}?body=${encodedMessage}`;
    };

    const handleCheckTelebirrStatus = async (registrationId: number) => {
        setCheckingIds(prev => [...prev, registrationId]);
        try {
            const res = await fetch('/api/payment/check_status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ registrationId: Number(registrationId) })
            });
            const data = await res.json();
            if (data.success) {
                alert('Payment verified and updated successfully!');
                fetchChurchSummit(); // Refresh the list
            } else {
                alert(data.message || 'Payment still pending on the gateway.');
            }
        } catch (err) {
            console.error(err);
            alert('Error checking status');
        } finally {
            setCheckingIds(prev => prev.filter(id => id !== registrationId));
        }
    };

    // Use session-based permissions instead of separate fetch
    useEffect(() => {
        if (session?.user) {
            setPermissions((session.user as any).permissions || []);
            setCurrentRole((session.user as any).role || '');
        }
    }, [sessionUserId]);


    const fetchChurchSummit = async () => {
        setLoading(true);
        setError("");
        try {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                search: debouncedSearch,
                sortBy,
                sortOrder,
                statusFilter,
                dateFilter,
                groupId: groupFilter !== 'all' ? groupFilter : '',
                vendorId: vendorFilter !== 'all' ? vendorFilter : ''
            });

            const response = await fetch(`/api/register_church_summit/?${queryParams}`, {
                credentials: 'include',
            });
            if (!response.ok) throw new Error("Failed to fetch transactions");

            const result = await response.json();
            setTransactions(result.data || []);
            if (result.stats) setDashboardData(result.stats);
            if (result.meta) {
                setTotalPages(result.meta.totalPages);
                setShowTitleField(result.meta.showTitleField !== false);
                setPaymentTypeLabelMap(result.meta.paymentTypeLabelMap || {});
                setPaymentTypeInfoMap(result.meta.paymentTypeInfoMap || {});
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchChurchSummit();
        fetchVendors();
        fetchGroups();
    }, [page, sortBy, sortOrder, debouncedSearch, statusFilter, dateFilter, groupFilter, vendorFilter, sessionUserId]);


    const fetchVendors = async () => {
        try {
            const res = await fetch('/api/vendors');
            const data = await res.json();
            setVendors(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching vendors:', error);
        }
    };

    const fetchGroups = async () => {
        try {
            const res = await fetch('/api/groups');
            const data = await res.json();
            setGroups(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching groups:', error);
        }
    };

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
    };

    const startEditing = () => {
        clearReceiptPending();
        setEditFormData({
            title: selectedRow.title,
            fullName: selectedRow.fullName,
            churchName: selectedRow.churchName,
            phoneNumber: selectedRow.phoneNumber,
            email: selectedRow.email,
            serviceRole: selectedRow.serviceRole,
            vendorId: selectedRow.vendorId,
            groupId: selectedRow.groupId,
            amount: selectedRow.amount,
            receiptPath: selectedRow.receiptPath ?? null,
            transactionReference: selectedRow.transactionReference ?? null,
            paymentStatus: selectedRow.paymentStatus ?? 'pending',
        });
        setIsEditing(true);
    };

    const handleEditSave = async () => {
        try {
            let receiptPath = editFormData.receiptPath;
            if (pendingReceiptFile) {
                const uploaded = await uploadRegistrationReceipt(pendingReceiptFile);
                if (!uploaded) {
                    alert('Could not upload receipt. Please try again.');
                    return;
                }
                receiptPath = uploaded;
            }

            const res = await fetch(`/api/register_church_summit/${selectedRow.id}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...editFormData,
                    receiptPath: receiptPath ?? null,
                    transactionReference: editFormData.transactionReference ?? null,
                    paymentStatus: editFormData.paymentStatus ?? selectedRow.paymentStatus ?? 'pending',
                    isGroupMember: selectedRow.isGroupMember,
                    attendeeId: selectedRow.attendeeId
                })
            });

            if (res.ok) {
                alert('Details updated successfully');
                setIsEditing(false);
                clearReceiptPending();
                setSelectedRow({
                    ...selectedRow,
                    ...editFormData,
                    fullName: editFormData.fullName, // Ensure it matches the flattened row expectation
                    ...(editFormData.amount !== undefined && editFormData.amount !== ''
                        ? { amount: String(editFormData.amount) }
                        : {}),
                    receiptPath: receiptPath ?? null,
                    transactionReference: editFormData.transactionReference ?? null,
                    paymentStatus: editFormData.paymentStatus ?? selectedRow.paymentStatus,
                });
                fetchChurchSummit();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to update details');
            }
        } catch (err) {
            console.error(err);
            alert('Error updating details');
        }
    };

    const handleExport = async () => {
        try {
            const queryParams = new URLSearchParams({
                limit: '10000',
                search: debouncedSearch,
                sortBy,
                sortOrder
            });

            const response = await fetch(`/api/register_church_summit/?${queryParams}`, {
                credentials: 'include',
            });
            const result = await response.json();
            const data = result.data || [];
            const exportShowTitle = result.meta?.showTitleField !== false;

            const flattenedData = data.flatMap((row: any) => {
                if (row.isGroup && row.attendees && row.attendees.length > 0) {
                    return row.attendees.map((attendee: any) => ({
                        ...row,
                        title: attendee.title,
                        fullName: attendee.fullName,
                        serviceRole: attendee.role,
                        amount: attendee.amount,
                        phoneNumber: attendee.phoneNumber || row.phoneNumber,
                        vendorId: attendee.vendorId,
                        vendor: attendee.vendor,
                        groupId: attendee.groupId,
                        group: attendee.group,
                        ticketNumber: attendee.ticketNumber,
                        attendeeSource: 'Group Member'
                    }));
                }
                return [{
                    ...row,
                    attendeeSource: 'Individual',
                }];
            });

            // Collect all unique dynamic field keys across all registrations
            const dynamicKeys = new Set<string>();
            flattenedData.forEach((row: any) => {
                if (row.responses) {
                    Object.keys(row.responses).forEach(key => dynamicKeys.add(key));
                }
            });
            const dynamicKeysList = Array.from(dynamicKeys);

            const headers = ['ID', 'Ticket Number', 'Full Name', 'Church', 'Role', 'Phone', 'Amount', 'Status', 'Coupon', 'Discount', 'Date', 'Type', 'Allocated Vendor', 'Assigned Group', 'Badge Link', ...dynamicKeysList.map(k => k.toUpperCase().replace(/_/g, ' '))];
            
            const csvContent = [
                headers.join(','),
                ...flattenedData.map((row: any) => {
                    const type = row.isGroup ? 'group' : 'individual';
                    let badgeLink = `${window.location.origin}/register?trade_status=PAY_SUCCESS&callback_info=${type}_${row.id}`;
                    if (row.ticketNumber) {
                        badgeLink += `&ticket=${row.ticketNumber}`;
                    }

                    const displayName = formatSummitPersonName(row.fullName, row.title, exportShowTitle);

                    const baseFields = [
                        row.id,
                        row.ticketNumber || '',
                        `"${displayName.replace(/"/g, '""')}"`,
                        `"${(row.churchName || '').replace(/"/g, '""')}"`,
                        `"${(row.serviceRole || '').replace(/"/g, '""')}"`,
                        `"${row.phoneNumber || ''}"`,
                        row.amount,
                        row.paymentStatus,
                        row.couponCode || '',
                        row.discountApplied || '',
                        new Date(row.createdAt).toLocaleDateString(),
                        row.attendeeSource,
                        `"${(row.vendor?.name || 'None').replace(/"/g, '""')}"`,
                        `"${(row.group?.name || 'None').replace(/"/g, '""')}"`,
                        `"${badgeLink}"`
                    ];

                    // Append dynamic fields
                    const dynamicFields = dynamicKeysList.map(key => {
                        const val = row.responses?.[key];
                        if (val === undefined || val === null) return '""';
                        return `"${String(val).replace(/"/g, '""')}"`;
                    });

                    return [...baseFields, ...dynamicFields].join(',')
                })
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `registrations_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            alert('Failed to export data');
        }
    };

    const SortIcon = ({ field }: { field: string }) => {
        if (sortBy !== field) return <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400" />;
        return sortOrder === 'asc'
            ? <ChevronUp className="w-3 h-3 ml-1 text-[#22C55E]" />
            : <ChevronDown className="w-3 h-3 ml-1 text-[#22C55E]" />;
    };


    return (
        <>
                <header className="bg-white border-b border-gray-100 px-4 lg:px-8 py-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sticky top-0 z-30">
                    <div className="flex items-center gap-4">
                        <DashboardMobileMenuButton />
                        <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-lg transition hidden lg:block">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </Link>
                        <div>
                            <h1 className="text-xl lg:text-2xl font-bold text-gray-800">Registration History</h1>
                            <p className="text-gray-500 text-xs lg:text-sm">Complete list of all registrations</p>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row items-start lg:items-center gap-2 lg:gap-4 w-full lg:w-auto">
                        <div className="relative flex-1 lg:flex-none">
                            <Search
                                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 cursor-pointer hover:text-[#22C55E] transition-colors"
                                onClick={() => { setDebouncedSearch(search); setPage(1); }}
                            />
                            <input
                                type="text"
                                placeholder="Search by name, phone, church..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setDebouncedSearch(search);
                                        setPage(1);
                                    }
                                }}
                                className="pl-12 pr-4 py-2.5 w-full lg:w-60 bg-gray-50 border border-gray-200 rounded-xl"
                            />
                        </div>

                        {/* Status Filter */}
                        <div className="relative">
                            <button
                                onClick={() => setShowFilters(showFilters === 'status' ? null : 'status')}
                                className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl transition ${statusFilter !== 'all' ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#22C55E]' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                <Settings className="w-4 h-4" />
                                <span className="text-sm">Status: {statusFilter === 'all' ? 'All' : statusFilter === 'completed' ? 'Completed' : statusFilter === 'pending' ? 'Pending' : 'Deleted'}</span>
                                <ChevronDown className="w-4 h-4" />
                            </button>

                            {showFilters === 'status' && (
                                <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
                                    {['all', 'completed', 'pending', 'deleted'].map((status) => (
                                        <button
                                            key={status}
                                            onClick={() => {
                                                setStatusFilter(status);
                                                setShowFilters(null);
                                            }}
                                            className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center justify-between ${statusFilter === status ? 'text-[#22C55E] font-medium bg-[#F0FDF4]' : 'text-gray-600'
                                                }`}
                                        >
                                            <span className="capitalize">{status}</span>
                                            {statusFilter === status && <CheckCircle2 className="w-4 h-4" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Date Filter */}
                        <div className="relative">
                            <button
                                onClick={() => setShowFilters(showFilters === 'date' ? null : 'date')}
                                className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl transition ${dateFilter !== 'all' ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#22C55E]' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                <Tag className="w-4 h-4" />
                                <span className="text-sm">Date: {dateFilter === 'all' ? 'All Time' : dateFilter === 'last7' ? 'Last 7 Days' : 'Last 30 Days'}</span>
                                <ChevronDown className="w-4 h-4" />
                            </button>

                            {showFilters === 'date' && (
                                <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
                                    {[
                                        { id: 'all', label: 'All Time' },
                                        { id: 'last7', label: 'Last 7 Days' },
                                        { id: 'last30', label: 'Last 30 Days' }
                                    ].map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                setDateFilter(item.id);
                                                setShowFilters(null);
                                            }}
                                            className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center justify-between ${dateFilter === item.id ? 'text-[#22C55E] font-medium bg-[#F0FDF4]' : 'text-gray-600'
                                                }`}
                                        >
                                            <span>{item.label}</span>
                                            {dateFilter === item.id && <CheckCircle2 className="w-4 h-4" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Group Filter */}
                        <div className="relative">
                            <button
                                onClick={() => setShowFilters(showFilters === 'group' ? null : 'group')}
                                className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl transition ${groupFilter !== 'all' ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#22C55E]' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                <UsersRound className="w-4 h-4" />
                                <span className="text-sm">Group: {groupFilter === 'all' ? 'All' : (groups.find(g => g.id === groupFilter)?.name || 'Filter')}</span>
                                <ChevronDown className="w-4 h-4" />
                            </button>

                            {showFilters === 'group' && (
                                <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
                                    <button
                                        onClick={() => {
                                            setGroupFilter('all');
                                            setShowFilters(null);
                                        }}
                                        className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center justify-between ${groupFilter === 'all' ? 'text-[#22C55E] font-medium bg-[#F0FDF4]' : 'text-gray-600'
                                            }`}
                                    >
                                        <span>All Groups</span>
                                        {groupFilter === 'all' && <CheckCircle2 className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setGroupFilter('none');
                                            setShowFilters(null);
                                        }}
                                        className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center justify-between ${groupFilter === 'none' ? 'text-[#22C55E] font-medium bg-[#F0FDF4]' : 'text-gray-600'
                                            }`}
                                    >
                                        <span>None Assigned</span>
                                        {groupFilter === 'none' && <CheckCircle2 className="w-4 h-4" />}
                                    </button>
                                    {groups.map((group) => (
                                        <button
                                            key={group.id}
                                            onClick={() => {
                                                setGroupFilter(group.id);
                                                setShowFilters(null);
                                            }}
                                            className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center justify-between ${groupFilter === group.id ? 'text-[#22C55E] font-medium bg-[#F0FDF4]' : 'text-gray-600'
                                                }`}
                                        >
                                            <span className="truncate pr-2">{group.name}</span>
                                            {groupFilter === group.id && <CheckCircle2 className="w-4 h-4" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Vendor Filter */}
                        <div className="relative">
                            <button
                                onClick={() => setShowFilters(showFilters === 'vendor' ? null : 'vendor')}
                                className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl transition ${vendorFilter !== 'all' ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#22C55E]' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                <Store className="w-4 h-4" />
                                <span className="text-sm">Vendor: {vendorFilter === 'all' ? 'All' : vendorFilter === 'none' ? 'None' : (vendors.find(v => v.id === vendorFilter)?.name || 'Filter')}</span>
                                <ChevronDown className="w-4 h-4" />
                            </button>

                            {showFilters === 'vendor' && (
                                <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
                                    <button
                                        onClick={() => {
                                            setVendorFilter('all');
                                            setShowFilters(null);
                                        }}
                                        className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center justify-between ${vendorFilter === 'all' ? 'text-[#22C55E] font-medium bg-[#F0FDF4]' : 'text-gray-600'
                                            }`}
                                    >
                                        <span>All Vendors</span>
                                        {vendorFilter === 'all' && <CheckCircle2 className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setVendorFilter('none');
                                            setShowFilters(null);
                                        }}
                                        className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center justify-between ${vendorFilter === 'none' ? 'text-[#22C55E] font-medium bg-[#F0FDF4]' : 'text-gray-600'
                                            }`}
                                    >
                                        <span>None Allocated</span>
                                        {vendorFilter === 'none' && <CheckCircle2 className="w-4 h-4" />}
                                    </button>
                                    {vendors.map((vendor) => (
                                        <button
                                            key={vendor.id}
                                            onClick={() => {
                                                setVendorFilter(vendor.id);
                                                setShowFilters(null);
                                            }}
                                            className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center justify-between ${vendorFilter === vendor.id ? 'text-[#22C55E] font-medium bg-[#F0FDF4]' : 'text-gray-600'
                                                }`}
                                        >
                                            <span className="truncate pr-2">{vendor.name}</span>
                                            {vendorFilter === vendor.id && <CheckCircle2 className="w-4 h-4" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {selectedIds.length > 0 && (
                            <button
                                onClick={() => {
                                    // Handle bulk SMS
                                    const selectedRegs = transactions.filter(r => selectedIds.includes(String(r.id)));
                                    if (selectedRegs.length === 1) {
                                        handleSendSMS(selectedRegs[0]);
                                    } else {
                                        if (confirm(`Send SMS for ${selectedRegs.length} participants? This will open your SMS app for each one sequentially.`)) {
                                            selectedRegs.forEach((reg, index) => {
                                                setTimeout(() => {
                                                    handleSendSMS(reg);
                                                }, index * 1000);
                                            });
                                        }
                                    }
                                }}
                                className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl text-sm font-bold hover:bg-blue-100 transition"
                            >
                                <MessageSquare className="w-4 h-4" />
                                Send SMS ({selectedIds.length})
                            </button>
                        )}

                                            {selectedIds.length > 0 && (isPlatformAdmin || permissions.includes('manage_groups')) && (
                            <button
                                onClick={() => setShowBulkGroupModal(true)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-xl text-sm font-bold hover:bg-amber-100 transition"
                            >
                                <UsersRound className="w-4 h-4" />
                                Assign Group ({selectedIds.length})
                            </button>
                        )}

                                            {selectedIds.length > 0 && (isPlatformAdmin || permissions.includes('delete_registrations')) && (
                            <button
                                onClick={async () => {
                                    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected registrations?`)) return;
                                    try {
                                        const res = await fetch('/api/register_church_summit', {
                                            method: 'DELETE',
                                            credentials: 'include',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ ids: selectedIds.map(id => parseInt(id)) })
                                        });
                                        if (res.ok) {
                                            alert(`${selectedIds.length} registrations deleted successfully`);
                                            setSelectedIds([]);
                                            fetchChurchSummit();
                                        } else {
                                            alert('Failed to delete registrations');
                                        }
                                    } catch (err) {
                                        console.error(err);
                                        alert('Error during bulk deletion');
                                    }
                                }}
                                className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-bold hover:bg-red-100 transition"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete ({selectedIds.length})
                            </button>
                        )}

                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#22C55E] text-white rounded-xl font-medium hover:bg-[#16A34A] transition"
                        >
                            <Download className="w-4 h-4" />
                            Export CSV
                        </button>
                        <button
                            onClick={handleLogout}
                            className="p-2.5 hover:bg-gray-100 rounded-xl transition text-gray-600 hover:text-red-600"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                <div className="p-4 lg:p-8">
                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 mb-6">
                        <div className="bg-white rounded-xl p-4 border border-gray-100">
                            <p className="text-gray-500 text-sm">Total</p>
                            <p className="text-2xl font-bold text-gray-800">{dashboardData.totalRegistrations.toLocaleString()}</p>
                            <p className="text-[10px] text-gray-400 mt-1 font-medium">Total registrations</p>
                        </div>

                        <div className="bg-white rounded-xl p-4 border border-gray-100">
                            <p className="text-gray-500 text-sm">Completed</p>
                            <p className="text-2xl font-bold text-[#22C55E]">{dashboardData.totalCompleted.toLocaleString()}</p>
                            <p className="text-[10px] text-gray-400 mt-1 font-medium">Successful registrations</p>
                        </div>

                        <div className="bg-white rounded-xl p-4 border border-gray-100">
                            <p className="text-gray-500 text-sm">Pending</p>
                            <p className="text-2xl font-bold text-amber-600">{dashboardData.totalPending.toLocaleString()}</p>
                            <p className="text-[10px] text-gray-400 mt-1 font-medium">Waiting for payment</p>
                        </div>

                        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm border-[#22C55E]/20">
                            <p className="text-[#22C55E] text-sm font-bold">Total Revenue (All)</p>
                            <p className="text-2xl font-black text-gray-900">{dashboardData.allTransactionsRevenue?.toLocaleString() || 0} ETB</p>
                            <p className="text-[10px] text-gray-400 mt-1 font-medium">Sum of cash & sponsored amounts</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-gray-100">
                            <p className="text-gray-500 text-sm">Cash Revenue</p>
                            <p className="text-2xl font-bold text-purple-600">{dashboardData.cashRevenue.toLocaleString()} ETB</p>
                            <p className="text-xs text-purple-500 mt-1">{(dashboardData as any).totalCashCount || 0} registrations</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-gray-100">
                            <p className="text-gray-500 text-sm">Sponsored Revenue</p>
                            <p className="text-2xl font-bold text-teal-600">{dashboardData.sponsoredRevenue.toLocaleString()} ETB</p>
                            <p className="text-xs text-teal-500 mt-1">{dashboardData.sponsoredCount} coupon registrations</p>
                        </div>

                    </div>

                    {/* Payment Type Revenue Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {/* Telebirr Revenue */}
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
                            <p className="text-blue-100 text-sm">Telebirr Revenue</p>
                            <p className="text-2xl font-bold">{dashboardData.telebirrRevenue.toLocaleString()} ETB</p>
                            <p className="text-blue-200 text-[10px] mt-1">
                                {dashboardData.telebirrCount} cash registrations
                                {dashboardData.telebirrTotalCount > dashboardData.telebirrCount && ` (+${dashboardData.telebirrTotalCount - dashboardData.telebirrCount} coupon)`}
                            </p>
                        </div>

                        {/* CBE Revenue */}
                        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
                            <p className="text-emerald-100 text-sm">CBE Revenue</p>
                            <p className="text-2xl font-bold">{dashboardData.cbeRevenue.toLocaleString()} ETB</p>
                            <p className="text-emerald-200 text-[10px] mt-1">
                                {dashboardData.cbeCount} cash registrations
                                {dashboardData.cbeTotalCount > dashboardData.cbeCount && ` (+${dashboardData.cbeTotalCount - dashboardData.cbeCount} coupon)`}
                            </p>
                        </div>

                        {/* Berhan Bank Revenue */}
                        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
                            <p className="text-amber-100 text-sm">Berhan Bank Revenue</p>
                            <p className="text-2xl font-bold">{dashboardData.brnRevenue.toLocaleString()} ETB</p>
                            <p className="text-amber-200 text-[10px] mt-1">
                                {dashboardData.brnCount} cash registrations
                                {dashboardData.brnTotalCount > dashboardData.brnCount && ` (+${dashboardData.brnTotalCount - dashboardData.brnCount} coupon)`}
                            </p>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-2xl border border-gray-100">
                        {loading ? (
                            <div className="p-12 text-center">
                                <div className="inline-block w-8 h-8 border-4 border-[#22C55E] border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            <th className="px-4 py-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-gray-300 text-[#22C55E] focus:ring-[#22C55E]"
                                                    checked={transactions.length > 0 && selectedIds.length === transactions.length}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedIds(transactions.map(t => String(t.id)));
                                                        } else {
                                                            setSelectedIds([]);
                                                        }
                                                    }}
                                                />
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('id')}>
                                                <div className="flex items-center">ID <SortIcon field="id" /></div>
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer" onClick={() => handleSort('fullName')}>
                                                <div className="flex items-center">Name <SortIcon field="fullName" /></div>
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Church</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Phone</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Payment Type</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Coupon</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Discount</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Vendor</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('amount')}>
                                                <div className="flex items-center">Amount <SortIcon field="amount" /></div>
                                            </th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('createdAt')}>
                                                <div className="flex items-center">Date <SortIcon field="createdAt" /></div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {transactions.flatMap((tx, index) => {
                                            if (tx.isGroup && tx.attendees && tx.attendees.length > 0) {
                                                return tx.attendees.map((attendee, attIndex) => ({
                                                    ...tx,
                                                    uniqueKey: `${tx.id}_${attIndex}`,
                                                    attendeeId: attendee.id,
                                                    title: attendee.title,
                                                    fullName: attendee.fullName,
                                                    serviceRole: attendee.role,
                                                    phoneNumber: attendee.phoneNumber || tx.phoneNumber,
                                                    amount: attendee.amount,
                                                    registrationTotalAmount: tx.amount,
                                                    isGroupMember: true,
                                                    vendorId: attendee.vendorId,
                                                    vendor: attendee.vendor,
                                                    groupId: attendee.groupId,
                                                    group: attendee.group,
                                                    activities: attendee.activities || {},
                                                    ticketNumber: attendee.ticketNumber
                                                } as any));
                                            }
                                            return [{
                                                ...tx,
                                                uniqueKey: String(tx.id || index),
                                                isGroupMember: false,
                                                registrationTotalAmount: tx.amount,
                                                activities: tx.activities || {},
                                                ticketNumber: tx.ticketNumber,
                                            } as any];
                                        }).filter((row: any) => {
                                            // Status Filter
                                            if (statusFilter !== 'all') {
                                                if (statusFilter === 'completed' && row.paymentStatus !== 'PAY_SUCCESS') return false;
                                                if (statusFilter === 'pending' && row.paymentStatus === 'PAY_SUCCESS') return false;
                                                // 'deleted' is already handled by server returning either deleted or non-deleted
                                            }

                                            // Date Filter is handled by server

                                            // Group Filter
                                            if (groupFilter !== 'all') {
                                                if (groupFilter === 'none' && row.groupId) return false;
                                                if (groupFilter !== 'none' && row.groupId !== groupFilter) return false;
                                            }

                                            // Vendor Filter
                                            if (vendorFilter !== 'all') {
                                                if (vendorFilter === 'none' && row.vendorId) return false;
                                                if (vendorFilter !== 'none' && row.vendorId !== vendorFilter) return false;
                                            }

                                            // Individual Search Filter (for finding specific members in a result set)
                                            if (debouncedSearch) {
                                                const s = debouncedSearch.toLowerCase();

                                                // Smart Phone Match (last 8 digits)
                                                let isPhoneMatch = row.phoneNumber?.toLowerCase().includes(s);
                                                if (!isPhoneMatch && s.replace(/[^\d]/g, '').length >= 8) {
                                                    const cleanS = s.replace(/[^\d]/g, '').slice(-8);
                                                    const cleanRowPhone = row.phoneNumber?.replace(/[^\d]/g, '') || '';
                                                    isPhoneMatch = cleanRowPhone.includes(cleanS);
                                                }

                                                const matches =
                                                    row.fullName?.toLowerCase().includes(s) ||
                                                    isPhoneMatch ||
                                                    row.churchName?.toLowerCase().includes(s) ||
                                                    String(row.id).includes(s) ||
                                                    (row.ticketNumber && String(row.ticketNumber).includes(s));

                                                if (!matches) return false;
                                            }

                                            return true;
                                        }).map((row: any) => (
                                            <tr
                                                key={row.uniqueKey}
                                                className={`hover:bg-[#F0FDF4] cursor-pointer transition-colors ${selectedIds.includes(String(row.id)) ? 'bg-[#F0FDF4]' : ''}`}
                                                onClick={() => setSelectedRow(row)}
                                            >
                                                <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded border-gray-300 text-[#22C55E] focus:ring-[#22C55E]"
                                                        checked={selectedIds.includes(String(row.id))}
                                                        onChange={() => {
                                                            const idStr = String(row.id);
                                                            setSelectedIds(prev =>
                                                                prev.includes(idStr)
                                                                    ? prev.filter(i => i !== idStr)
                                                                    : [...prev, idStr]
                                                            );
                                                        }}
                                                    />
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">#{row.id}</td>
                                                <td className="px-6 py-4 text-sm font-medium text-gray-800">
                                                    {formatSummitPersonName(row.fullName, row.title, showTitleField)}
                                                    {row.group?.name ? (
                                                        <span className="ml-2 bg-green-100 text-[#22C55E] text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-200">{row.group.name}</span>
                                                    ) : row.isGroupMember ? (
                                                        <span className="ml-2 bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-100 uppercase tracking-tighter">Group</span>
                                                    ) : null}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{row.churchName}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{row.serviceRole}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{row.phoneNumber}</td>
                                                <td className="px-6 py-4">
                                                    {row.deletedAt ? (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                                                            <Trash2 className="w-3 h-3" /> Deleted
                                                        </span>
                                                    ) : (
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full ${row.paymentStatus === 'PAY_SUCCESS'
                                                            ? 'bg-[#F0FDF4] text-[#22C55E]'
                                                            : 'bg-amber-100 text-amber-700'
                                                            }`}>
                                                            {row.paymentStatus === 'PAY_SUCCESS' ? (
                                                                <><CheckCircle2 className="w-3 h-3" /> Completed</>
                                                            ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <Clock className="w-3 h-3" /> Pending
                                                                    {row.paymentType === 'TELEBIRR' && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleCheckTelebirrStatus(row.id);
                                                                            }}
                                                                            disabled={checkingIds.includes(row.id)}
                                                                            className="p-1 hover:bg-amber-200 rounded-full transition-colors text-amber-600"
                                                                            title="Check Telebirr Status"
                                                                        >
                                                                            <RefreshCw className={`w-3 h-3 ${checkingIds.includes(row.id) ? 'animate-spin' : ''}`} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md ${row.paymentType === 'TELEBIRR' ? 'bg-blue-50 text-blue-700' :
                                                        row.paymentType === 'CASH' ? 'bg-green-50 text-green-700' :
                                                            row.paymentType === 'BANK_TRANSFER' ? 'bg-purple-50 text-purple-700' :
                                                                'bg-gray-50 text-gray-600'
                                                        }`}>
                                                        <span className="flex flex-col leading-tight">
                                                            <span>{getPaymentTypeDisplay(row.paymentType).label}</span>
                                                            <span className="text-[10px] opacity-80 font-mono">
                                                                {getPaymentTypeDisplay(row.paymentType).shortLabel}
                                                            </span>
                                                        </span>
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    {row.couponCode ? (
                                                        <span className="font-mono text-purple-600 font-medium">{row.couponCode}</span>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {row.discountApplied ? (
                                                        <span className="bg-[#F0FDF4] text-[#22C55E] text-xs font-bold px-2 py-1 rounded-full">{row.discountApplied} OFF</span>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 w-fit">
                                                        <Store className="w-3 h-3 text-gray-400" />
                                                        <span className="text-[10px] font-bold text-gray-600 uppercase truncate max-w-[80px]">
                                                            {row.vendor?.name || 'None'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className={`px-6 py-4 text-sm font-semibold ${row.paymentStatus === 'PAY_SUCCESS' ? 'text-[#22C55E]' : 'text-amber-600'}`}>{row.amount} ETB</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{new Date(row.createdAt).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination */}
                        <div className="flex items-center justify-between p-6 border-t border-gray-100">
                            <p className="text-sm text-gray-500">Page {page} of {totalPages} ({dashboardData.totalRegistrations} total)</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition"
                                >
                                    Previous
                                </button>
                                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                    const pageNum = i + 1;
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setPage(pageNum)}
                                            className={`px-4 py-2 rounded-lg transition ${page === pageNum
                                                ? 'bg-[#22C55E] text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="px-4 py-2 bg-[#22C55E] text-white rounded-lg hover:bg-[#16A34A] disabled:opacity-50 transition"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

            {/* Detail Panel */}
            {
                selectedRow && (
                    <>
                        <div
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
                            onClick={() => {
                                setSelectedRow(null);
                                setIsEditing(false);
                            }}
                        />
                        <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out overflow-y-auto">
                            <div className="sticky top-0 bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white p-6">
                                <button
                                    onClick={() => {
                                        setSelectedRow(null);
                                        setIsEditing(false);
                                    }}
                                    className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                                <h2 className="text-2xl font-bold">{selectedRow.fullName}</h2>
                                <p className="text-cyan-50 mt-1">{selectedRow.serviceRole}</p>
                                {selectedRow.isGroupMember && (
                                    <span className="inline-block mt-2 bg-white/20 text-white text-xs px-3 py-1 rounded-full">
                                        Group Member
                                    </span>
                                )}
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Registration Details</h3>
                                    {(permissions.includes('edit_registrations') || isPlatformAdmin) && !isEditing && (
                                            <button
                                                onClick={startEditing}
                                                className="text-xs text-[#22C55E] font-bold hover:underline"
                                            >
                                                Edit Details
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                        {showTitleField && (
                                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            <Tag className="w-5 h-5 text-gray-400" />
                                            <div className="flex-1">
                                                <p className="text-xs text-gray-500">Title</p>
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-1"
                                                        placeholder="e.g. Pastor, Dr., Mr."
                                                        value={editFormData.title || ''}
                                                        onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                                                    />
                                                ) : (
                                                    <p className="font-medium text-gray-900">{selectedRow.title || 'N/A'}</p>
                                                )}
                                            </div>
                                        </div>
                                        )}

                                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            <UsersRound className="w-5 h-5 text-gray-400" />
                                            <div className="flex-1">
                                                <p className="text-xs text-gray-500">Assigned Group</p>
                                                {isEditing ? (
                                                    <select
                                                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-1 bg-white font-medium"
                                                        value={editFormData.groupId || ''}
                                                        onChange={(e) => setEditFormData({ ...editFormData, groupId: e.target.value })}
                                                    >
                                                        <option value="">No Group Assigned</option>
                                                        {groups.map((g: any) => (
                                                            <option key={g.id} value={g.id}>{g.name}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <p className="font-medium text-gray-900">
                                                        {selectedRow.group?.name || (selectedRow.groupId ? groups.find(g => g.id === selectedRow.groupId)?.name || 'Loading...' : 'None')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            <Store className="w-5 h-5 text-gray-400" />
                                            <div className="flex-1">
                                                <p className="text-xs text-gray-500">Allocated Vendor</p>
                                                {isEditing ? (
                                                    <select
                                                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-1 bg-white"
                                                        value={editFormData.vendorId || ''}
                                                        onChange={(e) => setEditFormData({ ...editFormData, vendorId: e.target.value })}
                                                    >
                                                        <option value="">No Vendor Allocated</option>
                                                        {vendors.map(v => (
                                                            <option key={v.id} value={v.id}>{v.name} (Cap: {v.capacity})</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <p className="font-medium text-gray-900">
                                                        {selectedRow.vendor?.name || (selectedRow.vendorId ? vendors.find(v => v.id === selectedRow.vendorId)?.name || 'Loading...' : 'None')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            <User className="w-5 h-5 text-gray-400" />
                                            <div className="flex-1">
                                                <p className="text-xs text-gray-500">Full Name</p>
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-1"
                                                        value={editFormData.fullName || ''}
                                                        onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                                                    />
                                                ) : (
                                                    <p className="font-medium text-gray-900">{selectedRow.fullName}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            <Building2 className="w-5 h-5 text-gray-400" />
                                            <div className="flex-1">
                                                <p className="text-xs text-gray-500">Church</p>
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-1"
                                                        value={editFormData.churchName || ''}
                                                        onChange={(e) => setEditFormData({ ...editFormData, churchName: e.target.value })}
                                                    />
                                                ) : (
                                                    <p className="font-medium text-gray-900">{selectedRow.churchName}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            <Phone className="w-5 h-5 text-gray-400" />
                                            <div className="flex-1">
                                                <p className="text-xs text-gray-500">Phone</p>
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-1"
                                                        value={editFormData.phoneNumber || ''}
                                                        onChange={(e) => setEditFormData({ ...editFormData, phoneNumber: e.target.value })}
                                                    />
                                                ) : (
                                                    <p className="font-medium text-gray-900">{selectedRow.phoneNumber}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            <Users className="w-5 h-5 text-gray-400" />
                                            <div className="flex-1">
                                                <p className="text-xs text-gray-500">Role</p>
                                                {isEditing ? (
                                                    <select
                                                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-1"
                                                        value={editFormData.serviceRole || ''}
                                                        onChange={(e) => setEditFormData({ ...editFormData, serviceRole: e.target.value })}
                                                    >
                                                        <option value="Student">Student</option>
                                                        <option value="Church Leader/Minister">Church Leader/Minister</option>
                                                        <option value="Professional">Professional</option>
                                                        <option value="Ministry Partners">Ministry Partners</option>
                                                        <option value="Staff">Staff</option>
                                                        <option value="Associates">Associates</option>
                                                        <option value="Women leaders">Women leaders</option>
                                                        <option value="Youths leaders">Youths leaders</option>
                                                        <option value="Event Coordinators">Event Coordinators</option>
                                                        <option value="Media">Media</option>
                                                        <option value="Speakers">Speakers</option>
                                                    </select>
                                                ) : (
                                                    <p className="font-medium text-gray-900">{selectedRow.serviceRole}</p>
                                                )}
                                            </div>
                                        </div>

                                        {(((permissions.includes('edit_registrations') || isPlatformAdmin) && isEditing) ||
                                            (!isEditing && (permissions.includes('view_financials') || isPlatformAdmin))) && (
                                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                                <DollarSign className="w-5 h-5 text-gray-400" />
                                                <div className="flex-1">
                                                    <p className="text-xs text-gray-500">Amount (ETB)</p>
                                                    {isEditing && (permissions.includes('edit_registrations') || isPlatformAdmin) ? (
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-1 font-mono"
                                                            placeholder="e.g. 1500"
                                                            value={editFormData.amount ?? ''}
                                                            onChange={(e) =>
                                                                setEditFormData({ ...editFormData, amount: e.target.value })
                                                            }
                                                        />
                                                    ) : (
                                                        <p className="font-medium text-gray-900">{selectedRow.amount} ETB</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            <Mail className="w-5 h-5 text-gray-400" />
                                            <div className="flex-1">
                                                <p className="text-xs text-gray-500">Email</p>
                                                {isEditing ? (
                                                    <input
                                                        type="email"
                                                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-1"
                                                        value={editFormData.email || ''}
                                                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                                                    />
                                                ) : (
                                                    <p className="font-medium text-gray-900">{selectedRow.email || 'N/A'}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            <Clock className="w-5 h-5 text-gray-400" />
                                            <div>
                                                <p className="text-xs text-gray-500">Registered On</p>
                                                <p className="font-medium text-gray-900">{new Date(selectedRow.createdAt).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        {selectedRow.groupId && (
                                            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                                                <Users className="w-5 h-5 text-[#22C55E]" />
                                                <div>
                                                    <p className="text-xs text-green-600 font-medium">Assigned Group</p>
                                                    <p className="font-bold text-gray-900 uppercase tracking-tight">{selectedRow.group?.name || 'Assigned'}</p>
                                                </div>
                                            </div>
                                        )}

                                        {selectedRow.responses && Object.keys(selectedRow.responses).length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-gray-100">
                                                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Additional Information</h3>
                                                <div className="grid grid-cols-1 gap-3">
                                                    {Object.entries(selectedRow.responses).map(([key, value]) => (
                                                        <div key={key} className="flex items-start gap-3 p-3 bg-blue-50/30 rounded-lg border border-blue-50">
                                                            <div className="flex-1">
                                                                <p className="text-[10px] text-blue-500 font-black uppercase">{key.replace(/_/g, ' ')}</p>
                                                                <p className="font-medium text-gray-900 break-words">{String(value)}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {isEditing && (
                                        <div className="flex gap-2 mt-4">
                                            <button
                                                onClick={handleEditSave}
                                                className="flex-1 bg-[#22C55E] text-white py-2 rounded-lg font-bold text-sm hover:bg-[#16A34A]"
                                            >
                                                Save Changes
                                            </button>
                                            <button
                                                onClick={() => { setIsEditing(false); clearReceiptPending(); }}
                                                className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg font-bold text-sm hover:bg-gray-200"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Payment & Discount</h3>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex items-center gap-3 p-3 bg-[#F0FDF4] rounded-lg">
                                            <CreditCard className="w-5 h-5 text-[#22C55E]" />
                                            <div>
                                                <p className="text-xs text-gray-500">Amount</p>
                                                <p className="font-bold text-[#15803D]">
                                                    {isEditing ? (editFormData.amount ?? selectedRow.amount) : selectedRow.amount}{' '}
                                                    ETB
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            <Tag className="w-5 h-5 text-gray-400" />
                                            <div>
                                                <p className="text-xs text-gray-500">Status</p>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${(isEditing ? editFormData.paymentStatus : selectedRow.paymentStatus) === 'PAY_SUCCESS'
                                                    ? 'bg-[#F0FDF4] text-[#22C55E]'
                                                    : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {(isEditing ? editFormData.paymentStatus : selectedRow.paymentStatus) === 'PAY_SUCCESS'
                                                        ? 'Completed'
                                                        : 'Pending'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs text-purple-600 font-medium">Coupon Code</p>
                                                <p className="text-lg font-bold text-purple-800 font-mono">
                                                    {selectedRow.couponCode || 'No coupon used'}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-purple-600 font-medium">Discount</p>
                                                <span className={`text-lg font-bold ${selectedRow.discountApplied ? 'text-[#22C55E]' : 'text-gray-400'
                                                    }`}>
                                                    {selectedRow.discountApplied ? `${selectedRow.discountApplied} OFF` : '0% OFF'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {(canEditPayment ||
                                    permissions.includes('view_financials') ||
                                    permissions.includes('manage_payments') ||
                                    selectedRow.receiptPath ||
                                    isEditing) && (
                                    <div className="mt-4 mb-4">
                                        <RegistrationPaymentAttachment
                                            receiptPath={
                                                isEditing
                                                    ? (editFormData.receiptPath ?? null)
                                                    : (selectedRow.receiptPath ?? null)
                                            }
                                            transactionReference={
                                                isEditing
                                                    ? (editFormData.transactionReference ?? '')
                                                    : (selectedRow.transactionReference ?? '')
                                            }
                                            paymentStatus={
                                                isEditing
                                                    ? (editFormData.paymentStatus ?? 'pending')
                                                    : (selectedRow.paymentStatus ?? 'pending')
                                            }
                                            isEditing={isEditing}
                                            canEdit={canEditPayment}
                                            pendingPreview={pendingReceiptPreview}
                                            onPaymentStatusChange={(status) =>
                                                setEditFormData((prev) => ({
                                                    ...prev,
                                                    paymentStatus: status,
                                                }))
                                            }
                                            onReceiptPathChange={(path) =>
                                                setEditFormData((prev) => ({ ...prev, receiptPath: path }))
                                            }
                                            onTransactionReferenceChange={(ref) =>
                                                setEditFormData((prev) => ({
                                                    ...prev,
                                                    transactionReference: ref,
                                                }))
                                            }
                                            onPendingFile={(file, preview) => {
                                                if (pendingReceiptPreview) {
                                                    URL.revokeObjectURL(pendingReceiptPreview);
                                                }
                                                setPendingReceiptFile(file);
                                                setPendingReceiptPreview(preview);
                                            }}
                                        />
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Activities Tracked</h3>
                                    {selectedRow.activities && Object.keys(selectedRow.activities).length > 0 ? (
                                        <div className="space-y-2">
                                            {Object.entries(selectedRow.activities).map(([activityId, timestamp]: [string, any]) => (
                                                <div key={activityId} className="flex items-center justify-between p-3 bg-[#F0FDF4] rounded-lg border border-[#DCFCE7]">
                                                    <div className="flex items-center gap-2">
                                                        {activityId.includes('check_in') && <CalendarCheck className="w-4 h-4 text-[#22C55E]" />}
                                                        {activityId.includes('lunch') && <Utensils className="w-4 h-4 text-orange-500" />}
                                                        {activityId.includes('tea') && <Coffee className="w-4 h-4 text-amber-600" />}
                                                        {activityId.includes('swag') && <Gift className="w-4 h-4 text-purple-600" />}
                                                        <span className="font-medium text-gray-700 capitalize text-sm">
                                                            {activityId.replace(/_/g, ' ')}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-gray-500">
                                                        {new Date(timestamp).toLocaleString()}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 text-gray-400">
                                            <CalendarCheck className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                            <p>No activities recorded yet</p>
                                        </div>
                                    )}
                                </div>

                                {selectedRow.paymentStatus !== 'PAY_SUCCESS' && permissions.includes('manage_payments') && (
                                    <div className="pt-4 pb-2">
                                        <button
                                            onClick={async () => {
                                                if (!confirm(`Are you sure you want to approve payment for ${selectedRow.fullName}?`)) return;
                                                try {
                                                    const res = await fetch(`/api/update_payment/${selectedRow.id}`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ trade_status: 'PAY_SUCCESS' })
                                                    });
                                                    if (res.ok) {
                                                        alert('Payment approved successfully!');
                                                        setSelectedRow(null);
                                                        fetchChurchSummit();
                                                    } else {
                                                        alert('Failed to approve payment');
                                                    }
                                                } catch (err) {
                                                    console.error(err);
                                                    alert('Error approving payment');
                                                }
                                            }}
                                            className="w-full bg-[#22C55E] text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-[#22C55E]/20 hover:scale-[1.02] active:scale-[0.98] transition flex items-center justify-center gap-3"
                                        >
                                            <CheckCircle2 className="w-6 h-6" />
                                            Approve Manual Payment
                                        </button>
                                        <p className="text-[10px] text-center text-gray-400 mt-3 uppercase tracking-widest font-bold">
                                            Confirming this will send confirmation email and QR code
                                        </p>
                                    </div>
                                )}

                            {(isPlatformAdmin || permissions.includes('delete_registrations')) && (
                                    <div className="pt-2">
                                        <button
                                            onClick={() => handleSendSMS(selectedRow)}
                                            className="w-full mb-2 bg-[#2575fc]/10 text-[#2575fc] border border-[#2575fc]/20 py-3 rounded-2xl font-bold text-sm hover:bg-[#2575fc]/20 transition flex items-center justify-center gap-2"
                                        >
                                            <MessageSquare className="w-4 h-4" />
                                            Send Badge via SMS
                                        </button>

                                        {selectedRow.deletedAt ? (
                                            <button
                                                onClick={async () => {
                                                    if (!confirm(`Are you sure you want to RESTORE ${selectedRow.fullName}'s registration?`)) return;
                                                    try {
                                                        const res = await fetch(`/api/register_church_summit/${selectedRow.id}/restore`, {
                                                            method: 'POST',
                                                            credentials: 'include',
                                                        });
                                                        if (res.ok) {
                                                            alert('Registration restored successfully');
                                                            setSelectedRow(null);
                                                            fetchChurchSummit();
                                                        } else {
                                                            const data = await res.json();
                                                            alert(data.error || 'Failed to restore registration');
                                                        }
                                                    } catch (err) {
                                                        console.error(err);
                                                        alert('Error restoring registration');
                                                    }
                                                }}
                                                className="w-full bg-blue-50 text-blue-600 border border-blue-100 py-3 rounded-2xl font-bold text-sm hover:bg-blue-100 transition flex items-center justify-center gap-2"
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                                Restore Registration
                                            </button>
                                        ) : (
                                            <button
                                                onClick={async () => {
                                                    if (!confirm(`CRITICAL ACTION: Are you sure you want to delete ${selectedRow.fullName}'s registration? This will remove them from the list and invalidate their ticket.`)) return;
                                                    try {
                                                        const res = await fetch(`/api/register_church_summit/${selectedRow.id}`, {
                                                            method: 'DELETE',
                                                            credentials: 'include',
                                                        });
                                                        if (res.ok) {
                                                            alert('Registration deleted successfully');
                                                            setSelectedRow(null);
                                                            fetchChurchSummit();
                                                        } else {
                                                            const data = await res.json();
                                                            alert(data.error || 'Failed to delete registration');
                                                        }
                                                    } catch (err) {
                                                        console.error(err);
                                                        alert('Error deleting registration');
                                                    }
                                                }}
                                                className="w-full bg-red-50 text-red-600 border border-red-100 py-3 rounded-2xl font-bold text-sm hover:bg-red-100 transition flex items-center justify-center gap-2"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Delete Registration (Soft Delete)
                                            </button>
                                        )}
                                    </div>
                                )}

                                <div className="pt-4 border-t">
                                    <p className="text-xs text-gray-400 text-center">
                                        Registration ID: <span className="font-mono font-bold text-gray-600">#{selectedRow.id}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </>
                )
            }
            {/* Bulk Group Modal */}
            {showBulkGroupModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowBulkGroupModal(false)}></div>
                    <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-gray-900">Assign to Group</h3>
                            <button onClick={() => setShowBulkGroupModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <div className="p-8 space-y-4">
                            <p className="text-sm text-gray-500">Select a group to assign the {selectedIds.length} selected registrations to. This will add them to the group's "Specific Registration IDs" rule.</p>
                            <div className="grid grid-cols-1 gap-2 max-h-[40vh] overflow-y-auto">
                                {groups.map(group => (
                                    <button
                                        key={group.id}
                                        disabled={assigningLoading}
                                        onClick={async () => {
                                            setAssigningLoading(true);
                                            try {
                                                const res = await fetch('/api/groups/bulk-assign', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        groupId: group.id,
                                                        registrationIds: selectedIds.map(id => parseInt(id))
                                                    })
                                                });
                                                if (res.ok) {
                                                    alert('Participants assigned and groups synced successfully!');
                                                    setShowBulkGroupModal(false);
                                                    setSelectedIds([]);
                                                    fetchChurchSummit();
                                                } else {
                                                    const data = await res.json();
                                                    alert(data.error || 'Failed to assign group');
                                                }
                                            } catch (err) {
                                                alert('Error assigning group');
                                            } finally {
                                                setAssigningLoading(false);
                                            }
                                        }}
                                        className="flex items-center justify-between p-4 bg-gray-50 hover:bg-[#F0FDF4] border border-gray-100 rounded-2xl transition group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center group-hover:bg-[#BBF7D0]">
                                                <UsersRound className="w-5 h-5 text-gray-400 group-hover:text-[#22C55E]" />
                                            </div>
                                            <span className="font-bold text-gray-700">{group.name}</span>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-300" />
                                    </button>
                                ))}
                                {groups.length === 0 && <p className="text-center py-4 text-gray-400 italic">No groups defined yet.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
