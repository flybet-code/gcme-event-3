'use client'
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { usePathname } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { authClient } from "@/lib/auth-client";
import {
    Printer, LayoutDashboard, Users, UserCheck, FileText,
    Search, Download, Building2, ChevronDown, Bell, Moon, X,
    CalendarCheck, Utensils, Coffee, Gift, ArrowLeft, Settings, HelpCircle, LogOut
} from 'lucide-react';
import Image from "next/image";
import DashboardAuthGuard from "@/components/auth/DashboardAuthGuard";

interface Registration {
    id: string;
    fullName: string;
    churchName: string;
    serviceRole: string;
    phoneNumber: string;
    paymentStatus: string;
    createdAt: string;
    isGroup?: boolean;
    attendees?: {
        fullName: string;
        role: string;
    }[];
}

interface Badge {
    id: string;
    fullName: string;
    role: string;
    churchName: string;
}

export default function SummitBadgesPage() {
    return (
        <DashboardAuthGuard>
            <SummitBadgesContent />
        </DashboardAuthGuard>
    );
}

function SummitBadgesContent() {
    const { data: session } = authClient.useSession();
    const loggedIn = !!session;
    
    const [badges, setBadges] = useState<Badge[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [selectedBadges, setSelectedBadges] = useState<string[]>([]);
    const [printMode, setPrintMode] = useState<'full' | 'qr-only'>('full');
    const pathname = usePathname();

    const navItems = [
        { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
        { href: "/history", label: "All Registrations", icon: Users },
        { href: "/attendance", label: "Check-In", icon: UserCheck },
        { href: "/badges", label: "Badges", icon: FileText },
    ];

    const handleLogout = async () => {
        await authClient.signOut();
    };

    const fetchBadges = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/register_church_summit/?limit=10000`);
            if (!response.ok) throw new Error("Failed to fetch data");

            const result = await response.json();
            const data: Registration[] = result.data || [];

            const flattenedBadges: Badge[] = data.flatMap((reg) => {
                const badgesList: Badge[] = [];
                if (reg.isGroup && reg.attendees && reg.attendees.length > 0) {
                    reg.attendees.forEach((att: any, idx) => {
                        badgesList.push({
                            id: `CLS-${reg.id}-${att.id}`,
                            fullName: att.fullName,
                            role: att.role,
                            churchName: reg.churchName
                        });
                    });
                } else {
                    badgesList.push({
                        id: `CLS-${reg.id}`,
                        fullName: reg.fullName,
                        role: reg.serviceRole,
                        churchName: reg.churchName
                    });
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

    useEffect(() => {
        if (loggedIn) fetchBadges();
    }, [loggedIn]);

    const filteredBadges = badges.filter(b =>
        b.fullName.toLowerCase().includes(search.toLowerCase()) ||
        b.churchName.toLowerCase().includes(search.toLowerCase()) ||
        b.id.toLowerCase().includes(search.toLowerCase())
    );

    const toggleBadgeSelection = (id: string) => {
        setSelectedBadges(prev =>
            prev.includes(id) ? prev.filter(bid => bid !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedBadges.length === filteredBadges.length) {
            setSelectedBadges([]);
        } else {
            setSelectedBadges(filteredBadges.map(b => b.id));
        }
    };

    const handlePrintMode = (mode: 'full' | 'qr-only') => {
        setPrintMode(mode);
        // We wait a tiny bit for state to update before printing
        setTimeout(() => {
            window.print();
        }, 100);
    };

    const handlePrintSingleQR = (id: string) => {
        setSelectedBadges([id]);
        setPrintMode('qr-only');
        setTimeout(() => {
            window.print();
        }, 100);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-100 flex flex-col fixed h-full z-40 print:hidden">
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center">
                            <Image src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcBAMAAACAI8KnAAAAIVBMVEVHcEw/rrc+r7k9rrg8rbc9rrg8rbg8rbg9rrg8rbc8rbdc9U3xAAAAC3RSTlMAChcueEOrkmDiw8JgwYgAAADuSURBVHgBYiAOCMJZgL7HQTeiKAigZ956o9k6rBunZlAzqBnVCmpGawW1olpfWdzsRsW5HM9YgK1jgBR1w5DbEQBDyc3qBk12PwbH5VvGYct+bsq5rOXEtjh7HFMMYh1PrcvpAunY1yfltQWyjX/iqQJ539uRw1aAxgqsvu2eDueCmlwqyZ0ZfH0FAIyr45ljbCcYwgqOO7z+lAg4/TQphh7AU8A4pZp2noK6kSUj1ihMgHspSHpcH0gRvyCFFGtmhVR9PYB7Wfb8ZRvuPU36AWtL9v3ugbyYxvyADEm4wlHh6KTBDKhYiFKAT/mfT6GUK844OzHkAAAAAElFTkSuQmCC" alt="GCME Logo" className="w-10 h-10" />
                        </div>
                        <span className="font-bold text-xl text-gray-800">GCME<span className="text-[#22C55E]"></span></span>
                    </div>
                </div>

                <nav className="flex-1 p-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-3">Main</p>
                    <ul className="space-y-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-medium ${isActive
                                            ? 'bg-[#F0FDF4] text-[#22C55E]'
                                            : 'text-gray-600 hover:bg-gray-50'
                                            }`}
                                    >
                                        <Icon className="w-5 h-5" />
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
                            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 transition">
                                <Settings className="w-5 h-5" />
                                <span className="font-medium">Settings</span>
                            </button>
                        </li>
                        <li>
                            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 transition">
                                <HelpCircle className="w-5 h-5" />
                                <span className="font-medium">Help</span>
                            </button>
                        </li>
                    </ul>

                    {/* Promo Card */}
                    <div className="mt-8">
                        <div className="bg-gradient-to-br from-[#22C55E] to-[#16A34A] rounded-2xl p-5 text-white">
                            <h4 className="font-bold mb-1">Need Help?</h4>
                            <p className="text-xs text-white/80 mb-4">Contact support for any issues</p>
                            <button className="w-full bg-white text-[#22C55E] py-2 rounded-xl text-xs font-bold hover:bg-gray-50 transition">
                                Contact Us
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 print:ml-0 print:p-0">
                <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between sticky top-0 z-30 print:hidden">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="p-2 hover:bg-gray-100 rounded-lg transition">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Badge Printing</h1>
                            <p className="text-gray-500 text-sm">Generate and print attendee badges</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name, church or ID..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-12 pr-4 py-2.5 w-72 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-[#22C55E]/10 transition"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handlePrintMode('full')}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 text-white rounded-xl font-medium hover:bg-black transition shadow-lg"
                            >
                                <Printer className="w-4 h-4" />
                                Print All
                            </button>
                            <button
                                onClick={() => handlePrintMode('qr-only')}
                                disabled={selectedBadges.length === 0}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition shadow-lg ${selectedBadges.length > 0
                                    ? 'bg-[#22C55E] text-white hover:bg-[#16A34A] shadow-[#22C55E]/20'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                            >
                                <QRCodeSVG value="test" size={16} />
                                Print Selected (QR Only)
                            </button>
                            <button
                                onClick={handleLogout}
                                className="p-2.5 hover:bg-gray-100 rounded-xl transition text-gray-600 hover:text-red-600"
                                title="Logout"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </header>

                <div className="p-8 print:p-0">
                    <div className="mb-6 flex items-center justify-between print:hidden">
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={selectedBadges.length === filteredBadges.length && filteredBadges.length > 0}
                                onChange={toggleSelectAll}
                                className="w-5 h-5 accent-[#22C55E] rounded border-gray-300 transition cursor-pointer"
                            />
                            <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">Select All ({filteredBadges.length})</span>
                        </div>
                        {selectedBadges.length > 0 && (
                            <span className="bg-[#22C55E] text-white px-4 py-1.5 rounded-full text-xs font-black shadow-lg shadow-[#22C55E]/20">
                                {selectedBadges.length} SELECTED
                            </span>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-[#22C55E] border-t-transparent rounded-full animate-spin"></div>
                            <p className="mt-4 text-gray-500 font-medium">Preparing badges...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 print:block">
                            <style jsx global>{`
                                @media print {
                                    @page { margin: 0; size: auto; }
                                    header, aside, .print\:hidden { display: none !important; }
                                    main { margin-left: 0 !important; padding: 0 !important; }
                                    body { overflow: visible !important; background: white; }
                                    
                                    /* Handle Full Ticket Printing */
                                    .mode-full .badge-container {
                                        display: flex !important;
                                        break-inside: avoid !important;
                                        page-break-inside: avoid !important;
                                        width: 8.5cm !important;
                                        height: 12cm !important;
                                        margin: 0.5cm !important;
                                        float: left !important;
                                        border: 1px solid #f0f0f0 !important;
                                        box-shadow: none !important;
                                    }
                                    .mode-full .qr-print-only { display: none !important; }

                                    /* Handle QR Only Printing */
                                    .mode-qr-only .badge-container:not(.selected) { display: none !important; }
                                    .mode-qr-only .badge-container.selected {
                                        width: 8cm !important;
                                        height: 10cm !important;
                                        margin: 0.5cm !important;
                                        float: left !important;
                                        border: 1px dashed #ccc !important;
                                        border-radius: 12px !important;
                                        display: flex !important;
                                        align-items: center !important;
                                        justify-content: center !important;
                                        flex-direction: column !important;
                                        padding: 20px !important;
                                        background: white !important;
                                        box-shadow: none !important;
                                    }
                                    .mode-qr-only .badge-container.selected .full-ticket-info { display: none !important; }
                                    .mode-qr-only .badge-container.selected .qr-print-only { 
                                        display: flex !important; 
                                        flex-direction: column;
                                        align-items: center;
                                        text-align: center;
                                        width: 100%;
                                    }
                                    .mode-qr-only .badge-container.selected .qr-code-box {
                                        margin: 0 !important;
                                        padding: 0 !important;
                                        border: none !important;
                                    }
                                }
                            `}</style>

                            <div className={`contents ${printMode === 'full' ? 'mode-full' : 'mode-qr-only'}`}>
                                {filteredBadges.map((badge) => {
                                    const isSelected = selectedBadges.includes(badge.id);
                                    return (
                                        <div
                                            key={badge.id}
                                            className={`bg-white rounded-[32px] shadow-sm border overflow-hidden flex flex-col relative badge-container hover:shadow-xl transition-all duration-300 w-full max-w-[320px] mx-auto mb-4 ${isSelected ? 'border-[#22C55E] ring-4 ring-[#22C55E]/5 selected' : 'border-gray-100'}`}
                                        >
                                            {/* Selection Overlay (Screen Only) */}
                                            <div className="absolute top-4 left-4 z-20 print:hidden">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleBadgeSelection(badge.id)}
                                                    className="w-6 h-6 accent-[#22C55E] rounded-lg border-2 border-white shadow-lg cursor-pointer transition transform hover:scale-110"
                                                />
                                            </div>

                                            {/* Print Actions (Screen Only) */}
                                            <div className="absolute top-4 right-4 z-20 print:hidden opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handlePrintSingleQR(badge.id)}
                                                    className="p-2 bg-white/90 backdrop-blur shadow-xl rounded-xl text-gray-700 hover:text-[#22C55E] transition"
                                                    title="Print QR Only"
                                                >
                                                    <Printer className="w-5 h-5" />
                                                </button>
                                            </div>

                                            {/* Full Ticket Info (Hides in QR only mode during print) */}
                                            <div className="full-ticket-info contents">
                                                {/* Top Section - Gradient Background */}
                                                <div className="bg-gradient-to-br from-[#6a11cb] to-[#2575fc] text-white p-6 relative h-44">
                                                    <div className="flex justify-between items-start">
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-bold tracking-[0.2em] opacity-80 uppercase">Event Ticket</p>
                                                            <h3 className="font-black text-xl leading-none tracking-tight">CHURCH<br />LEADERSHIP<br />SUMMIT</h3>
                                                        </div>
                                                        <div className="text-right space-y-1">
                                                            <div className="inline-block bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-[9px] font-bold tracking-wider">2026</div>
                                                            <p className="font-black text-2xl">March 31 - April 2</p>
                                                            <p className="text-[10px] font-medium opacity-90">ADDIS ABABA</p>
                                                        </div>
                                                    </div>
                                                    <div className="absolute bottom-4 right-6 flex space-x-1 opacity-50">
                                                        <div className="w-1 h-1 rounded-full bg-white"></div>
                                                        <div className="w-1 h-1 rounded-full bg-white"></div>
                                                        <div className="w-1 h-1 rounded-full bg-white"></div>
                                                    </div>
                                                </div>

                                                <div className="relative h-8 bg-white -mt-4">
                                                    <div className="absolute -left-3 top-0 bottom-0 my-auto w-6 h-6 bg-gray-50 rounded-full z-10 border-r border-gray-100"></div>
                                                    <div className="absolute -right-3 top-0 bottom-0 my-auto w-6 h-6 bg-gray-50 rounded-full z-10 border-l border-gray-100"></div>
                                                    <div className="absolute top-1/2 left-4 right-4 border-t-2 border-dashed border-gray-200"></div>
                                                </div>

                                                <div className="p-6 pt-2 bg-white flex-1 flex flex-col">
                                                    <div className="flex justify-between items-start mb-6">
                                                        <div className="flex-1">
                                                            <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Passenger</p>
                                                            <h2 className="text-lg font-bold text-gray-800 leading-tight line-clamp-2">{badge.fullName}</h2>
                                                        </div>
                                                        <div className="text-right ml-2">
                                                            <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Role</p>
                                                            <p className="font-bold text-[#2575fc] bg-blue-50 px-2 py-0.5 rounded text-[10px] whitespace-nowrap inline-block">{badge.role}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-between items-end mt-auto">
                                                        <div className="space-y-4 flex-1 pr-4">
                                                            <div>
                                                                <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Church</p>
                                                                <p className="text-[11px] font-bold text-gray-700 line-clamp-1">{badge.churchName}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Ticket No</p>
                                                                <p className="font-mono text-xs font-bold text-gray-600 tracking-wide">{badge.id}</p>
                                                            </div>
                                                        </div>
                                                        <div className="bg-white p-2 border border-gray-100 rounded-xl shadow-sm shrink-0 qr-code-box">
                                                            <QRCodeSVG
                                                                value={badge.id}
                                                                size={70}
                                                                level="M"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="mt-8 pt-3 border-t border-gray-100 text-center">
                                                        <p className="text-[8px] text-gray-400 tracking-[0.2em] font-medium">SCAN QR CODE FOR ENTRY</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Minimal Info for QR-Only Print */}
                                            <div className="hidden qr-print-only">
                                                <div className="mb-4">
                                                    <p className="text-[12px] font-black uppercase tracking-[0.3em] text-gray-400">GCME SUMMIT 2025</p>
                                                </div>
                                                <QRCodeSVG
                                                    value={badge.id}
                                                    size={250}
                                                    level="H"
                                                />
                                                <div className="mt-6 text-center">
                                                    <p className="text-[18px] font-black text-gray-900 tracking-tight">{badge.fullName}</p>
                                                    <p className="text-[14px] font-mono font-bold text-[#22C55E] mt-1">{badge.id}</p>
                                                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-1">{badge.churchName}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
