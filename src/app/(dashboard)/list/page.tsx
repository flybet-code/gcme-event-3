'use client'
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from 'next/navigation';
import { authClient } from "@/lib/auth-client";
import {
    Search, Download, ArrowUpDown, ChevronUp, ChevronDown, Printer,
    CalendarCheck, Utensils, Coffee, Gift, X, User, Phone, Mail,
    Tag, CreditCard, Clock, LayoutDashboard, Users, UserCheck, FileText,
    UserPlus, ShieldCheck, FileClock, Filter, MessageSquare, Database, QrCode,
    ArrowRight, MoreHorizontal, Tags, Store, UsersRound,
    Building2, LogOut, Settings, HelpCircle, Bell, TrendingUp, DollarSign,
    ChevronRight, Trash2, ExternalLink, CheckCircle2, RefreshCw, BarChart3, Moon,
    AlertCircle
} from 'lucide-react';
import Image from "next/image";
import { DashboardMobileMenuButton, NAV_ITEMS, PERMISSION_MAP } from "@/components/DashboardLayout";
import { toast } from 'sonner';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';
import { formatSummitPersonName } from '@/lib/summit-registration-config';
import {
    RegistrationPaymentAttachment,
    uploadRegistrationReceipt,
} from '@/components/dashboard/RegistrationPaymentAttachment';

interface Registration {
    id: string;
    title?: string;
    fullName: string;
    churchName: string;
    serviceRole: string;
    phoneNumber: string;
    amount: string;
    paymentStatus: string;
    createdAt: string;
    isGroup?: boolean;
    checkedIn?: boolean;
    checkedInAt?: string;
    discountApplied?: string;
    couponCode?: string;
    email?: string;
    receiptPath?: string | null;
    transactionReference?: string | null;
    paymentType?: string;
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

export default function Tr2025churchleadershipsummitlist() {
    const { data: session } = authClient.useSession();
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    const router = useRouter();


    // 📦 Data states
    const [transactions, setTransactions] = useState<Registration[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [limit] = useState(50);

    // 🔍 Search & Sort states
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [sortBy, setSortBy] = useState("createdAt");
    const [sortOrder, setSortOrder] = useState("desc");

    // 🎛️ Filter states
    const [dateFilter, setDateFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [groupFilter, setGroupFilter] = useState("all");
    const [vendorFilter, setVendorFilter] = useState("all");
    const [showFilters, setShowFilters] = useState(false);
    const [showGroupFilters, setShowGroupFilters] = useState(false);
    const [showVendorFilters, setShowVendorFilters] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // 🛡️ Permissions
    const [permissions, setPermissions] = useState<string[]>([]);
    const [currentRole, setCurrentRole] = useState<string>('');
    const [showTitleField, setShowTitleField] = useState(true);
    const [paymentTypeLabelMap, setPaymentTypeLabelMap] = useState<Record<string, string>>({});
    const [paymentTypeInfoMap, setPaymentTypeInfoMap] = useState<
        Record<string, { label: string; shortLabel: string }>
    >({});

    // 📋 Selected row for detail panel
    const [selectedRow, setSelectedRow] = useState<any | null>(null);

    // 🎨 Sidebar state 
    const [activeMenu, setActiveMenu] = useState('overview');

    const [showLoginForm, setShowLoginForm] = useState(false);
    const [checkingIds, setCheckingIds] = useState<number[]>([]);
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

    // ✏️ Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editMode, setEditMode] = useState<'individual' | 'group'>('individual');
    const [editFormData, setEditFormData] = useState<Partial<Registration>>({});
    const [pendingReceiptFile, setPendingReceiptFile] = useState<File | null>(null);
    const [pendingReceiptPreview, setPendingReceiptPreview] = useState<string | null>(null);

    const pathname = usePathname();

    useEffect(() => {
        if (pathname === '/list') {
            router.replace('/dashboard');
        }
    }, [pathname, router]);

    // Same permission-based filter as sidebar: only show items user can access
    const navItemsAllowed = NAV_ITEMS.filter((item) => {
        const requiredPerm = PERMISSION_MAP[item.href];
        if (isPlatformAdmin) return true;
        if (!requiredPerm) return false;
        return permissions.includes(requiredPerm);
    });

    const [vendors, setVendors] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);

    const [dashboardData, setDashboardData] = useState({
        totalRegistrations: 0,
        totalRevenue: 0,
        allTransactionsRevenue: 0,
        cashRevenue: 0,
        sponsoredRevenue: 0,
        sponsoredCount: 0,
        totalPending: 0,
        totalCompleted: 0,
        // Revenue by payment type
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


    // Debounce search input for server-side querying
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const handleNotificationsClick = () => {
        if (dashboardData.totalPending > 0) {
            toast.info(`${dashboardData.totalPending} pending registration(s) need attention.`);
            return;
        }
        toast.success('No new notifications.');
    };
    const fetchChurchSummit = async () => {
        setLoading(true);
        setError("");
        try {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                search: debouncedSearch,
                sortOrder,
                dateFilter,
                statusFilter,
                groupId: groupFilter !== 'all' ? groupFilter : '',
                vendorId: vendorFilter !== 'all' ? vendorFilter : ''
            });

            const response = await fetch(`/api/register_church_summit/?${queryParams}`);
            if (!response.ok) throw new Error("Failed to fetch transactions");

            const result = await response.json();
            const txList = result.data || [];

            if (result.stats) setDashboardData(result.stats);
            if (result.meta) {
                setTotalPages(result.meta.totalPages);
                setShowTitleField(result.meta.showTitleField !== false);
                setPaymentTypeLabelMap(result.meta.paymentTypeLabelMap || {});
                setPaymentTypeInfoMap(result.meta.paymentTypeInfoMap || {});
            }
            setTransactions(txList);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    // Use session-based permissions instead of separate fetch
    useEffect(() => {
        if (session?.user) {
            setPermissions((session.user as any).permissions || []);
            setCurrentRole((session.user as any).role || '');
        }
    }, [sessionUserId]);


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

    useEffect(() => {
        fetchChurchSummit();
    }, [page, sortBy, sortOrder, debouncedSearch, statusFilter, dateFilter, groupFilter, vendorFilter, sessionUserId]);

    useEffect(() => {
        fetchVendors();
        fetchGroups();
    }, [sessionUserId]);


    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('asc');
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

            const response = await fetch(`/api/register_church_summit/?${queryParams}`);
            const result = await response.json();
            const data = result.data || [];

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
                        responses: attendee.responses,
                        attendeeSource: 'Group Member'
                    }));
                }
                return [{
                    ...row,
                    attendeeSource: 'Individual',
                }];
            });

            // Collect all unique dynamic field keys
            const dynamicKeys = new Set<string>();
            flattenedData.forEach((row: any) => {
                if (row.responses) {
                    Object.keys(row.responses).forEach(key => dynamicKeys.add(key));
                }
            });
            const dynamicKeysList = Array.from(dynamicKeys);

            const headers = ['ID', 'Ticket Number', 'Full Name', 'Church', 'Role', 'Phone', 'Amount', 'Status', 'Coupon', 'Discount', 'Date', 'Type', 'Vendor', 'Group', ...dynamicKeysList.map(k => k.toUpperCase().replace(/_/g, ' '))];
            
            const csvContent = [
                headers.join(','),
                ...flattenedData.map((row: any) => {
                    const baseFields = [
                        row.id,
                        row.ticketNumber || '',
                        `"${(row.fullName || '').replace(/"/g, '""')}"`,
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
                        `"${(row.group?.name || 'None').replace(/"/g, '""')}"`
                    ];

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
            link.setAttribute('download', `registrations_export_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error(err);
            alert('Failed to export data');
        }
    };

    const handleSendSMS = (reg: any) => {
        const baseUrl = window.location.origin;
        const type = (reg.isGroup || reg.groupId) ? 'group' : 'individual';
        const link = `${baseUrl}/register?trade_status=PAY_SUCCESS&callback_info=${type}_${reg.id}`;
        const message = `Hello ${reg.fullName}, your registration for the event is confirmed. You can view and download your badge here: ${link}`;
        const encodedMessage = encodeURIComponent(message);
        window.location.href = `sms:${reg.phoneNumber}?body=${encodedMessage}`;
    };

    const handleCheckTelebirrStatus = async (registrationId: number) => {
        setCheckingIds(prev => [...prev, registrationId]);
        try {
            const res = await fetch('/api/payment/check_status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ registrationId })
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

    const handleEditSave = async () => {
        if (!selectedRow) return;
        try {
            const isGroupEdit = editMode === 'group';
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
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    ...editFormData,
                    receiptPath: receiptPath ?? null,
                    transactionReference: editFormData.transactionReference ?? null,
                    paymentStatus: editFormData.paymentStatus ?? selectedRow.paymentStatus ?? 'pending',
                    isGroupMember: isGroupEdit ? false : selectedRow.isGroupMember,
                    attendeeId: isGroupEdit ? undefined : selectedRow.attendeeId
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
            }
            else {
                const data = await res.json();
                alert(data.error || 'Failed to update registration');
            }
        } catch (err) {
            console.error(err);
            alert('Error updating registration');
        }
    };

    const startEditing = (isIndividual: boolean = true) => {
        clearReceiptPending();
        setEditMode(isIndividual ? 'individual' : 'group');
        if (isIndividual) {
            setEditFormData({
                title: selectedRow.title,
                fullName: selectedRow.fullName,
                churchName: selectedRow.churchName,
                phoneNumber: selectedRow.phoneNumber,
                serviceRole: selectedRow.serviceRole,
                email: selectedRow.email,
                vendorId: selectedRow.vendorId,
                groupId: selectedRow.groupId,
                amount: selectedRow.amount,
                receiptPath: selectedRow.receiptPath ?? null,
                transactionReference: selectedRow.transactionReference ?? null,
                paymentStatus: selectedRow.paymentStatus ?? 'pending',
            });
        } else {
            setEditFormData({
                title: selectedRow.rootTitle,
                fullName: selectedRow.rootFullName,
                churchName: selectedRow.churchName,
                phoneNumber: selectedRow.rootPhoneNumber,
                serviceRole: selectedRow.rootServiceRole,
                email: selectedRow.rootEmail,
                vendorId: selectedRow.vendorId,
                groupId: selectedRow.groupId,
                amount: selectedRow.registrationTotalAmount ?? selectedRow.amount,
                receiptPath: selectedRow.receiptPath ?? null,
                transactionReference: selectedRow.transactionReference ?? null,
                paymentStatus: selectedRow.paymentStatus ?? 'pending',
            });
        }
        setIsEditing(true);
    };

    const handleNext = () => {
        if (page < totalPages) setPage((prev) => prev + 1);
    };

    const handlePrev = () => {
        if (page > 1) setPage((prev) => prev - 1);
    };

    const SortIcon = ({ field }: { field: string }) => {
        if (sortBy !== field) return <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400" />;
        return sortOrder === 'asc'
            ? <ChevronUp className="w-3 h-3 ml-1 text-[#22C55E]" />
            : <ChevronDown className="w-3 h-3 ml-1 text-[#22C55E]" />;
    };

    // Calculate stats for donut chart
    const completedPercent = dashboardData.totalRegistrations > 0
        ? Math.round((dashboardData.totalCompleted / dashboardData.totalRegistrations) * 100)
        : 0;
    const pendingPercent = 100 - completedPercent;



    return (
        <>
                {/* Top Header */}
                <header className="bg-white border-b border-gray-100 px-4 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-30">
                    <DashboardMobileMenuButton />

                    <div className="hidden sm:block">
                        <h1 className="text-xl lg:text-2xl font-bold text-gray-800">Hello, Admin!</h1>
                        <p className="text-gray-500 text-sm">Yotor Event Management Dashboard</p>
                    </div>

                    <div className="flex items-center gap-2 lg:gap-6">
                        {/* Search - hidden on mobile */}
                        <div className="relative hidden md:block">
                            <Search
                                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 cursor-pointer hover:text-[#22C55E] transition-colors"
                                onClick={() => { setDebouncedSearch(search); setPage(1); }}
                            />
                            <input
                                type="text"
                                placeholder="Search anything here..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setDebouncedSearch(search);
                                        setPage(1);
                                    }
                                }}
                                className="pl-12 pr-4 py-2.5 w-60 lg:w-80 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#22C55E] focus:border-transparent transition"
                            />
                        </div>

                        {/* Notifications */}
                        <button
                            className="relative p-2 hover:bg-gray-50 rounded-xl transition"
                            onClick={handleNotificationsClick}
                            title="Notifications"
                        >
                            <Bell className="w-6 h-6 text-gray-600" />
                            {dashboardData.totalPending > 0 && (
                                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                            )}
                        </button>

                        {/* Profile & Logout */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#22C55E] rounded-full flex items-center justify-center">
                                <span className="text-white font-bold">{session?.user?.name?.[0] || 'A'}</span>
                            </div>
                            <button
                                onClick={() => authClient.signOut()}
                                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                                title="Logout"
                            >
                                <LogOut className="w-5 h-5" />
                                <span className="text-sm font-medium">Logout</span>
                            </button>
                        </div>
                    </div>
                </header>

                {/* Content */}
                <div className="p-4 lg:p-8">
                    {/* Filters Row */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3 relative">
                            {/* Status Filter */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`flex items-center gap-2 px-4 py-2 border rounded-xl transition ${statusFilter !== 'all' ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#22C55E]' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    <Settings className="w-4 h-4" />
                                    <span>Status: {statusFilter === 'all' ? 'All' : statusFilter === 'completed' ? 'Completed' : 'Pending'}</span>
                                    <ChevronDown className="w-4 h-4" />
                                </button>

                                {showFilters && (
                                    <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-20 overflow-hidden">
                                        {['all', 'completed', 'pending'].map((status) => (
                                            <button
                                                key={status}
                                                onClick={() => {
                                                    setStatusFilter(status);
                                                    setShowFilters(false);
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
                            <button
                                onClick={() => {
                                    const next = dateFilter === 'all' ? 'last30' : dateFilter === 'last30' ? 'last7' : 'all';
                                    setDateFilter(next);
                                }}
                                className={`flex items-center gap-2 px-4 py-2 border rounded-xl transition ${dateFilter !== 'all' ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#22C55E]' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <CalendarCheck className="w-4 h-4" />
                                <span>
                                    {dateFilter === 'all' ? 'All Time' : dateFilter === 'last30' ? 'Last 30 days' : 'Last 7 days'}
                                </span>
                                <ChevronDown className="w-4 h-4" />
                            </button>

                            {/* Group Filter */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowGroupFilters(!showGroupFilters)}
                                    className={`flex items-center gap-2 px-4 py-2 border rounded-xl transition ${groupFilter !== 'all' ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#22C55E]' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    <UsersRound className="w-4 h-4" />
                                    <span className="text-sm">Group: {groupFilter === 'all' ? 'All' : (groups.find(g => g.id === groupFilter)?.name || 'Filter')}</span>
                                    <ChevronDown className="w-4 h-4" />
                                </button>

                                {showGroupFilters && (
                                    <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-20 overflow-hidden">
                                        <button
                                            onClick={() => {
                                                setGroupFilter('all');
                                                setShowGroupFilters(false);
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
                                                setShowGroupFilters(false);
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
                                                    setShowGroupFilters(false);
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
                                    onClick={() => setShowVendorFilters(!showVendorFilters)}
                                    className={`flex items-center gap-2 px-4 py-2 border rounded-xl transition ${vendorFilter !== 'all' ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#22C55E]' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    <Store className="w-4 h-4" />
                                    <span className="text-sm">Vendor: {vendorFilter === 'all' ? 'All' : vendorFilter === 'none' ? 'None' : (vendors.find(v => v.id === vendorFilter)?.name || 'Filter')}</span>
                                    <ChevronDown className="w-4 h-4" />
                                </button>

                                {showVendorFilters && (
                                    <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-20 overflow-hidden">
                                        <button
                                            onClick={() => {
                                                setVendorFilter('all');
                                                setShowVendorFilters(false);
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
                                                setShowVendorFilters(false);
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
                                                    setShowVendorFilters(false);
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
                        </div>
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#22C55E] text-white rounded-xl font-medium hover:bg-[#16A34A] transition shadow-lg shadow-[#22C55E]/20"
                        >
                            <Download className="w-4 h-4" />
                            Export CSV
                        </button>
                    </div>

                    {/* Dashboard Content Check */}
                    {!(permissions.includes('view_financials') || isPlatformAdmin) ? (
                        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-white rounded-3xl border border-gray-100 shadow-sm mt-8">
                            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                                <Building2 className="w-12 h-12 text-gray-400" />
                            </div>
                            <h2 className="text-3xl font-black text-gray-800 mb-3">Welcome to GCME Summit</h2>
                            <p className="text-gray-500 max-w-md mb-8 leading-relaxed">
                                Select a tool from the sidebar to manage participants, badges, or check-ins.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg">
                                {navItemsAllowed.filter(item => item.href !== '/list').map(item => {
                                    const Icon = item.icon;
                                    return (
                                        <Link key={item.href} href={item.href} className="flex items-center gap-4 p-4 rounded-2xl border border-gray-200 hover:border-[#22C55E] hover:bg-[#F0FDF4] transition-all group text-left">
                                            <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-white text-gray-500 group-hover:text-[#22C55E] transition">
                                                <Icon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 group-hover:text-[#22C55E]">{item.label}</h3>
                                                <p className="text-xs text-gray-400">Access Module</p>
                                            </div>
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Stats Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-8">
                                <div className="bg-white rounded-2xl p-6 border border-gray-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-gray-500 font-medium">Total Registrations</p>
                                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                                            <Users className="w-6 h-6 text-blue-500" />
                                        </div>
                                    </div>
                                    <p className="text-3xl font-bold text-gray-800">{dashboardData.totalRegistrations}</p>
                                    <p className="text-[#22C55E] text-sm mt-2 flex items-center gap-1">
                                        <TrendingUp className="w-4 h-4" />
                                        +12% vs past month
                                    </p>
                                </div>

                                <div className="bg-white rounded-2xl p-6 border border-gray-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-gray-500 font-medium">Completed Payments</p>
                                        <div className="w-12 h-12 bg-[#F0FDF4] rounded-xl flex items-center justify-center">
                                            <CheckCircle2 className="w-6 h-6 text-[#22C55E]" />
                                        </div>
                                    </div>
                                    <p className="text-3xl font-bold text-gray-800">{dashboardData.totalCompleted}</p>
                                    <p className="text-[#22C55E] text-sm mt-2 flex items-center gap-1">
                                        <TrendingUp className="w-4 h-4" />
                                        +20% vs past month
                                    </p>
                                </div>

                                {(permissions.includes('view_financials') || permissions.includes('manage_users')) && (
                                    <div className="bg-white rounded-2xl p-6 border border-gray-100">
                                        <div className="flex items-center justify-between mb-4">
                                            <p className="text-gray-900 font-bold">Total Revenue (All)</p>
                                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                                                <DollarSign className="w-6 h-6 text-blue-500" />
                                            </div>
                                        </div>
                                        <p className="text-3xl font-bold text-gray-800">{dashboardData.totalRevenue.toLocaleString()} <span className="text-lg font-normal text-gray-500">ETB</span></p>
                                        <p className="text-[#22C55E] text-sm mt-2 flex items-center gap-1">
                                            <BarChart3 className="w-4 h-4" />
                                            Combined sum
                                        </p>
                                    </div>
                                )}

                                {(permissions.includes('view_financials') || permissions.includes('manage_users')) && (
                                    <div className="bg-white rounded-2xl p-6 border border-gray-100">
                                        <div className="flex items-center justify-between mb-4">
                                            <p className="text-gray-500 font-medium">Cash Revenue</p>
                                            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                                                <DollarSign className="w-6 h-6 text-purple-500" />
                                            </div>
                                        </div>
                                        <p className="text-3xl font-bold text-gray-800">{dashboardData.cashRevenue.toLocaleString()} <span className="text-lg font-normal text-gray-500">ETB</span></p>
                                        <p className="text-purple-600 text-sm mt-2 flex items-center gap-1">
                                            <TrendingUp className="w-4 h-4" />
                                            Pure cash collected
                                        </p>
                                    </div>
                                )}

                                {(permissions.includes('view_financials') || permissions.includes('manage_users')) && (
                                    <div className="bg-white rounded-2xl p-6 border border-gray-100">
                                        <div className="flex items-center justify-between mb-4">
                                            <p className="text-gray-500 font-medium">Sponsored Revenue</p>
                                            <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center">
                                                <Tag className="w-6 h-6 text-teal-500" />
                                            </div>
                                        </div>
                                        <p className="text-3xl font-bold text-gray-800">{dashboardData.sponsoredRevenue.toLocaleString()} <span className="text-lg font-normal text-gray-500">ETB</span></p>
                                        <p className="text-teal-600 text-sm mt-2 flex items-center gap-1">
                                            <Users className="w-4 h-4" />
                                            {dashboardData.sponsoredCount} sponsored registrations
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Payment Type Revenue Breakdown */}
                            {(permissions.includes('view_financials') || permissions.includes('manage_users')) && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                    {/* Telebirr Revenue */}
                                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
                                        <div className="flex items-center justify-between mb-4">
                                            <p className="text-blue-100 font-medium">Telebirr Revenue</p>
                                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                                <CreditCard className="w-6 h-6 text-white" />
                                            </div>
                                        </div>
                                        <p className="text-3xl font-bold">{dashboardData.telebirrRevenue.toLocaleString()} <span className="text-lg font-normal text-blue-200">ETB</span></p>
                                        <p className="text-blue-200 text-sm mt-2">
                                            {dashboardData.telebirrTotalCount} registrations
                                        </p>
                                    </div>

                                    {/* CBE Revenue */}
                                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white">
                                        <div className="flex items-center justify-between mb-4">
                                            <p className="text-emerald-100 font-medium">CBE Revenue</p>
                                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                                <Building2 className="w-6 h-6 text-white" />
                                            </div>
                                        </div>
                                        <p className="text-3xl font-bold">{dashboardData.cbeRevenue.toLocaleString()} <span className="text-lg font-normal text-emerald-200">ETB</span></p>
                                        <p className="text-emerald-200 text-sm mt-2">
                                            {dashboardData.cbeTotalCount} registrations
                                        </p>
                                    </div>

                                    {/* Berhan Bank Revenue */}
                                    <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white">
                                        <div className="flex items-center justify-between mb-4">
                                            <p className="text-amber-100 font-medium">Berhan Bank Revenue</p>
                                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                                <Building2 className="w-6 h-6 text-white" />
                                            </div>
                                        </div>
                                        <p className="text-3xl font-bold">{dashboardData.brnRevenue.toLocaleString()} <span className="text-lg font-normal text-amber-200">ETB</span></p>
                                        <p className="text-amber-200 text-sm mt-2">
                                            {dashboardData.brnTotalCount} registrations
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Stats and Table Row */}
                            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                                {/* Donut Chart Statistics */}
                                <div className="bg-white rounded-2xl p-6 border border-gray-100">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="font-semibold text-gray-800">Statistics</h3>
                                        <Link href="/history" className="text-[#22C55E] text-sm font-medium flex items-center gap-1 hover:underline">
                                            more <ChevronRight className="w-4 h-4" />
                                        </Link>
                                    </div>

                                    {/* Simple Donut Chart */}
                                    <div className="relative mx-auto" style={{ width: 180, height: 180 }}>
                                        <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                                            <path
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                fill="none"
                                                stroke="#E5E7EB"
                                                strokeWidth="3"
                                            />
                                            <path
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                fill="none"
                                                stroke="#22C55E"
                                                strokeWidth="3"
                                                strokeDasharray={`${completedPercent}, 100`}
                                            />
                                            <path
                                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                fill="none"
                                                stroke="#F59E0B"
                                                strokeWidth="3"
                                                strokeDasharray={`${pendingPercent}, 100`}
                                                strokeDashoffset={`-${completedPercent}`}
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-xs text-gray-400">Total</span>
                                            <span className="text-2xl font-bold text-gray-800">{dashboardData.totalRegistrations}</span>
                                        </div>
                                    </div>

                                    {/* Legend */}
                                    <div className="mt-6 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <span className="w-3 h-3 bg-[#22C55E] rounded-full"></span>
                                            <span className="text-gray-600 text-sm text-[#22C55E]">Completed</span>
                                            <span className="ml-auto font-semibold text-gray-800">{completedPercent}%</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
                                            <span className="text-gray-600 text-sm">Pending</span>
                                            <span className="ml-auto font-semibold text-gray-800">{pendingPercent}%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Registrations Table */}
                                <div className="col-span-3 bg-white rounded-2xl border border-gray-100">
                                    <div className="flex items-center justify-between p-6 border-b border-gray-100">
                                        <div className="flex items-center gap-4">
                                            <h3 className="font-semibold text-gray-800">Recent Registrations</h3>
                                            {selectedIds.length > 0 && (
                                                <button
                                                    onClick={() => {
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

                                            {selectedIds.length > 0 && (isPlatformAdmin || permissions.includes('delete_registrations')) && (
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected registrations?`)) return;
                                                        try {
                                                            const res = await fetch('/api/register_church_summit', {
                                                                method: 'DELETE',
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
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs font-bold hover:bg-red-100 transition animate-in fade-in slide-in-from-left-2"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    Delete Selected ({selectedIds.length})
                                                </button>
                                            )}
                                        </div>
                                        <Link href="/history" className="text-[#22C55E] text-sm font-medium flex items-center gap-1 hover:underline">
                                            View All <ChevronRight className="w-4 h-4" />
                                        </Link>
                                    </div>

                                    {
                                        loading ? (
                                            <div className="p-12 text-center">
                                                <div className="inline-block w-8 h-8 border-4 border-[#22C55E] border-t-transparent rounded-full animate-spin"></div>
                                                <p className="mt-4 text-gray-500">Loading registrations...</p>
                                            </div>
                                        ) : error ? (
                                            <div className="p-12 text-center text-red-500">{error}</div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full">
                                                    <thead>
                                                        <tr className="bg-gray-50">
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
                                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('id')}>
                                                                <div className="flex items-center">ID <SortIcon field="id" /></div>
                                                            </th>
                                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('fullName')}>
                                                                <div className="flex items-center">Name <SortIcon field="fullName" /></div>
                                                            </th>
                                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('createdAt')}>
                                                                <div className="flex items-center">Date <SortIcon field="createdAt" /></div>
                                                            </th>
                                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Discount</th>
                                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('amount')}>
                                                                <div className="flex items-center">Amount <SortIcon field="amount" /></div>
                                                            </th>
                                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Vendor</th>
                                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Info</th>
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
                                                                    vendorId: attendee.vendorId,
                                                                    vendor: attendee.vendor,
                                                                    groupId: attendee.groupId,
                                                                    group: attendee.group,
                                                                    isGroupMember: true,
                                                                    activities: attendee.activities || {},
                                                                    checkedIn: attendee.checkedIn,
                                                                    ticketNumber: attendee.ticketNumber,
                                                                    responses: attendee.responses,
                                                                    rootFullName: tx.fullName,
                                                                    rootTitle: tx.title,
                                                                    rootPhoneNumber: tx.phoneNumber,
                                                                    rootServiceRole: tx.serviceRole,
                                                                    rootEmail: tx.email
                                                                }) as any);
                                                            }
                                                            return [{
                                                                ...tx,
                                                                uniqueKey: tx.id || index,
                                                                isGroupMember: false,
                                                                registrationTotalAmount: tx.amount,
                                                                activities: tx.activities || {},
                                                                checkedIn: tx.checkedIn
                                                            }];
                                                        }).filter((row: any) => {
                                                            // Status Filter
                                                            if (statusFilter !== 'all') {
                                                                if (statusFilter === 'completed' && row.paymentStatus !== 'PAY_SUCCESS') return false;
                                                                if (statusFilter === 'pending' && row.paymentStatus === 'PAY_SUCCESS') return false;
                                                            }

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

                                                            // Individual Search Filter
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
                                                                    row.email?.toLowerCase().includes(s) ||
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
                                                                    <div className="flex flex-col">
                                                                        <div className="flex items-center gap-2">
                                                                            <span>{formatSummitPersonName(row.fullName, row.title, showTitleField)}</span>
                                                                            {row.group?.name ? (
                                                                                <span className="bg-green-100 text-[#22C55E] text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-green-200">{row.group.name}</span>
                                                                            ) : row.isGroupMember ? (
                                                                                <span className="bg-blue-50 text-blue-600 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-blue-100 uppercase tracking-tighter">Group</span>
                                                                            ) : null}
                                                                        </div>
                                                                        {row.email && <span className="text-[10px] text-gray-400 font-normal">{row.email}</span>}
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4">
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
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs font-bold text-gray-700">
                                                                            {getPaymentTypeDisplay(row.paymentType).label}
                                                                        </span>
                                                                        <span className="text-[10px] text-gray-400 font-mono">
                                                                            {getPaymentTypeDisplay(row.paymentType).shortLabel}
                                                                        </span>
                                                                        {row.couponCode && (
                                                                            <span className="text-[10px] text-gray-400 font-mono">
                                                                                Code: {row.couponCode}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 text-sm text-gray-500">{new Date(row.createdAt).toLocaleDateString()}</td>
                                                                <td className="px-6 py-4">
                                                                    {row.discountApplied ? (
                                                                        <span className="px-2 py-1 bg-[#F0FDF4] text-[#22C55E] text-xs font-bold rounded-full">
                                                                            {row.discountApplied} OFF
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-gray-400 text-xs">-</span>
                                                                    )}
                                                                </td>
                                                                <td className={`px-6 py-4 text-sm font-semibold ${row.paymentStatus === 'PAY_SUCCESS' ? 'text-[#22C55E]' : 'text-amber-600'}`}>
                                                                    {permissions.includes('view_financials') ? `${row.amount} ETB` : '***'}
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 w-fit">
                                                                        <Store className="w-3 h-3 text-gray-400" />
                                                                        <span className="text-[10px] font-bold text-gray-600 uppercase truncate max-w-[80px]">
                                                                            {row.vendor?.name || 'None'}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <button className="text-gray-400 hover:text-gray-600">
                                                                        <ChevronRight className="w-5 h-5" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )
                                    }

                                    {/* Pagination */}
                                    <div className="flex items-center justify-between p-6 border-t border-gray-100">
                                        <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handlePrev}
                                                disabled={page === 1}
                                                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                            >
                                                Previous
                                            </button>
                                            <button
                                                onClick={handleNext}
                                                disabled={page === totalPages}
                                                className="px-4 py-2 bg-[#22C55E] text-white rounded-lg hover:bg-[#16A34A] disabled:opacity-50 disabled:cursor-not-allowed transition"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

            {/* Slide-in Detail Panel */}
            {selectedRow && (
                <>
                    <div
                        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
                        onClick={() => {
                            setSelectedRow(null);
                            setIsEditing(false);
                        }}
                    />

                    <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out overflow-y-auto">
                        <div className="sticky top-0 bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white p-6">
                            <button
                                onClick={() => setSelectedRow(null)}
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
                                        <div className="flex gap-3">
                                            {selectedRow.isGroupMember && (
                                                <button
                                                    onClick={() => startEditing(false)}
                                                    className="text-xs text-blue-500 font-bold hover:underline"
                                                >
                                                    Edit Entire Group
                                                </button>
                                            )}
                                            <button
                                                onClick={() => startEditing(true)}
                                                className="text-xs text-[#22C55E] font-bold hover:underline"
                                            >
                                                {selectedRow.isGroupMember ? "Edit Member" : "Edit Details"}
                                            </button>
                                        </div>
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
                                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm mt-1 bg-white font-medium"
                                                    value={editFormData.vendorId || ''}
                                                    onChange={(e) => setEditFormData({ ...editFormData, vendorId: e.target.value })}
                                                >
                                                    <option value="">No Vendor Allocated</option>
                                                    {vendors.map((v: any) => (
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
                                        <Clock className="w-5 h-5 text-gray-400" />
                                        <div>
                                            <p className="text-xs text-gray-500">Registered On</p>
                                            <p className="font-medium text-gray-900">{new Date(selectedRow.createdAt).toLocaleString()}</p>
                                        </div>
                                    </div>
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
                                            onClick={() => {
                                                setIsEditing(false);
                                                clearReceiptPending();
                                            }}
                                            className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg font-bold text-sm hover:bg-gray-200"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Payment & Discount</h3>

                                {permissions.includes('view_financials') && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex items-center gap-3 p-3 bg-[#F0FDF4] rounded-lg">
                                            <CreditCard className="w-5 h-5 text-[#22C55E]" />
                                            <div>
                                                <p className="text-xs text-gray-500">Amount</p>
                                                <p className="font-bold text-[#15803D]">{selectedRow.amount} ETB</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                            <Tag className="w-5 h-5 text-gray-400" />
                                            <div>
                                                <p className="text-xs text-gray-500">Status</p>
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${(isEditing ? editFormData.paymentStatus : selectedRow.paymentStatus) === 'PAY_SUCCESS'
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
                                )}

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
                                            onPaymentStatusChange={(status) =>
                                                setEditFormData((prev) => ({
                                                    ...prev,
                                                    paymentStatus: status,
                                                }))
                                            }
                                            pendingPreview={pendingReceiptPreview}
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

                                                                {permissions.includes('view_financials') && (
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
                                )}
                            </div>

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

                            {selectedRow.paymentStatus !== 'PAY_SUCCESS' && (permissions.includes('manage_payments') || isPlatformAdmin) && (
                                <div className="pt-4 pb-2">
                                    {selectedRow.isGroupMember ? (
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <button
                                                onClick={async () => {
                                                    if (!confirm(`Are you sure you want to approve payment for INDIVIDUAL MEMBER ${selectedRow.fullName}? This will extract them to a separate registration.`)) return;
                                                    try {
                                                        const res = await fetch(`/api/update_payment/${selectedRow.id}`, {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ trade_status: 'PAY_SUCCESS', attendeeId: selectedRow.attendeeId })
                                                        });
                                                        if (res.ok) {
                                                            alert('Individual member approved successfully!');
                                                            setSelectedRow(null);
                                                            fetchChurchSummit();
                                                        } else {
                                                            alert('Failed to approve member payment');
                                                        }
                                                    } catch (err) {
                                                        console.error(err);
                                                        alert('Error approving member payment');
                                                    }
                                                }}
                                                className="flex-1 bg-amber-500 text-white py-4 rounded-2xl font-black text-[15px] shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle2 className="w-5 h-5" />
                                                Approve Member Only
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (!confirm(`Are you sure you want to approve payment for the ENTIRE GROUP?`)) return;
                                                    try {
                                                        const res = await fetch(`/api/update_payment/${selectedRow.id}`, {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ trade_status: 'PAY_SUCCESS' })
                                                        });
                                                        if (res.ok) {
                                                            alert('Entire Group payment approved successfully!');
                                                            setSelectedRow(null);
                                                            fetchChurchSummit();
                                                        } else {
                                                            alert('Failed to approve group payment');
                                                        }
                                                    } catch (err) {
                                                        console.error(err);
                                                        alert('Error approving group payment');
                                                    }
                                                }}
                                                className="flex-1 bg-[#22C55E] text-white py-4 rounded-2xl font-black text-[15px] shadow-lg shadow-[#22C55E]/20 hover:scale-[1.02] active:scale-[0.98] transition flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle2 className="w-5 h-5" />
                                                Approve Entire Group
                                            </button>
                                        </div>
                                    ) : (
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
                                    )}
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
                                    {selectedRow.isGroupMember ? (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={async () => {
                                                    if (!confirm(`CRITICAL ACTION: Are you sure you want to delete ONLY ${selectedRow.fullName}?`)) return;
                                                    try {
                                                        const res = await fetch(`/api/register_church_summit/${selectedRow.id}?attendeeId=${selectedRow.attendeeId}`, {
                                                            method: 'DELETE'
                                                        });
                                                        if (res.ok) {
                                                            alert('Member deleted successfully');
                                                            setSelectedRow(null);
                                                            fetchChurchSummit();
                                                        } else {
                                                            const data = await res.json();
                                                            alert(data.error || 'Failed to delete member');
                                                        }
                                                    } catch (err) {
                                                        console.error(err);
                                                        alert('Error deleting member');
                                                    }
                                                }}
                                                className="flex-1 bg-red-50 text-red-600 border border-red-100 py-3 rounded-2xl font-bold text-sm hover:bg-red-100 transition flex items-center justify-center gap-2"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Delete Member
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (!confirm(`CRITICAL ACTION: Are you sure you want to delete the ENTIRE GROUP?`)) return;
                                                    try {
                                                        const res = await fetch(`/api/register_church_summit/${selectedRow.id}`, {
                                                            method: 'DELETE'
                                                        });
                                                        if (res.ok) {
                                                            alert('Group deleted successfully');
                                                            setSelectedRow(null);
                                                            fetchChurchSummit();
                                                        } else {
                                                            const data = await res.json();
                                                            alert(data.error || 'Failed to delete group');
                                                        }
                                                    } catch (err) {
                                                        console.error(err);
                                                        alert('Error deleting group');
                                                    }
                                                }}
                                                className="flex-1 bg-red-50 text-red-600 border border-red-100 py-3 rounded-2xl font-bold text-sm hover:bg-red-100 transition flex items-center justify-center gap-2"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Delete Entire Group
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={async () => {
                                                if (!confirm(`CRITICAL ACTION: Are you sure you want to delete ${selectedRow.fullName}'s registration? This will remove them from the list and invalidate their ticket.`)) return;
                                                try {
                                                    const res = await fetch(`/api/register_church_summit/${selectedRow.id}`, {
                                                        method: 'DELETE'
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
                                    Registration ID: <span className="font-mono font-bold">{selectedRow.id}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            )
            }
        </>
    );
}
