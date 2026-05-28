'use client'
import React, { useState } from "react";
import dynamic from 'next/dynamic';

const Scanner = dynamic(() => import('@yudiel/react-qr-scanner').then(mod => mod.Scanner), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full bg-black flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
        </div>
    )
});
import {
    Search, QrCode, AlertCircle, CheckCircle, Coffee,
    Utensils, Gift, CalendarCheck, Building2, X, Store
} from 'lucide-react';

interface CheckInResult {
    fullName: string;
    role: string;
    churchName: string;
    checkedInAt: string;
    isGroupMember: boolean;
    activity: string;
    allActivities?: Record<string, string>;
    vendorName?: string;
}

interface SearchResult {
    id: string;
    fullName: string;
    role: string;
    churchName: string;
    checkedIn: boolean;
    isGroupMember: boolean;
    mainId: string;
    discountApplied?: string;
    ticketNumber?: number;
    phoneNumber?: string;
    activities?: Record<string, string>;
    paymentStatus: string;
}



const ACTIVITIES = [
    // Day 1 (Mar 31)
    { id: 'check_in_day1', label: 'Check-In (Day 1)', icon: CalendarCheck, color: 'blue', day: 1 },
    { id: 'tea_break_day1_am', label: 'Tea Break AM (Day 1)', icon: Coffee, color: 'amber', day: 1 },
    { id: 'lunch_day1', label: 'Lunch (Day 1)', icon: Utensils, color: 'orange', day: 1 },
    { id: 'tea_break_day1_pm', label: 'Tea Break PM (Day 1)', icon: Coffee, color: 'amber', day: 1 },

    // Day 2 (April 1)
    { id: 'check_in_day2', label: 'Check-In (Day 2)', icon: CalendarCheck, color: 'blue', day: 2 },
    { id: 'tea_break_day2_am', label: 'Tea Break AM (Day 2)', icon: Coffee, color: 'amber', day: 2 },
    { id: 'lunch_day2', label: 'Lunch (Day 2)', icon: Utensils, color: 'orange', day: 2 },
    { id: 'tea_break_day2_pm', label: 'Tea Break PM (Day 2)', icon: Coffee, color: 'amber', day: 2 },

    // Day 3 (April 2)
    { id: 'check_in_day3', label: 'Check-In (Day 3)', icon: CalendarCheck, color: 'blue', day: 3 },
    { id: 'tea_break_day3_am', label: 'Tea Break AM (Day 3)', icon: Coffee, color: 'amber', day: 3 },
    { id: 'lunch_day3', label: 'Lunch (Day 3)', icon: Utensils, color: 'orange', day: 3 },
    { id: 'tea_break_day3_pm', label: 'Tea Break PM (Day 3)', icon: Coffee, color: 'amber', day: 3 },

    // Special
    { id: 'swag_collection', label: 'Swag Collection', icon: Gift, color: 'purple', day: 0 },
];

export default function AttendancePage() {
    // Public access - no authentication required
    const [isAuthorized] = useState<boolean>(true);

    const [activeTab, setActiveTab] = useState<'scan' | 'manual'>('scan');
    const [currentActivity, setCurrentActivity] = useState<string>('check_in_day1');

    const [scanResult, setScanResult] = useState<string | null>(null);
    const [checkInStatus, setCheckInStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'already_checked_in'>('idle');
    const [lastCheckIn, setLastCheckIn] = useState<CheckInResult | null>(null);
    const [errorMessage, setErrorMessage] = useState("");

    // Manual Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'error' | 'warning' } | null>(null);

    const showStatus = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
        setStatusMessage({ text, type });
        setTimeout(() => setStatusMessage(null), 3000);
    };

    const playSuccessSound = () => {
        try {
            const audio = new Audio('/sounds/success.mp3');
            audio.play().catch(e => console.log('Audio play failed', e));
        } catch (e) { console.log('Audio error', e); }
    };

    const processCheckIn = async (qrData: string) => {
        if (checkInStatus === 'loading') return;

        const rawData = qrData.trim();
        setScanResult(rawData); // Track which ID is being processed
        let idToCheck: string = rawData;

        console.log("[Check-In] Raw Data Scanned:", rawData);

        // 1. Try JSON format (Backward compatibility)
        try {
            const parsed = JSON.parse(rawData);
            if (parsed.id) idToCheck = String(parsed.id);
        } catch (e) {
            // Not JSON, continue with raw string
        }

        // 2. Parse "CLS-" format (Direct processing by backend now)
        if (typeof idToCheck === 'string' && idToCheck.startsWith('CLS-')) {
            console.log("[Check-In] Passing CLS ID to backend:", idToCheck);
        }

        console.log("[Check-In] Processed ID to check:", idToCheck);

        setCheckInStatus('loading');
        setErrorMessage("");

        try {
            const response = await fetch('/api/check_in_church_summit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    qrId: idToCheck,
                    activity: currentActivity
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Check-in failed');
            }

            setLastCheckIn(result.data);

            // Update the search results state locally for manual check-ins
            // We use result.status == success to update the state
            setSearchResults(prev => prev.map(item => {
                if (item.mainId === idToCheck) {
                    return {
                        ...item,
                        activities: result.data.allActivities
                    };
                }
                return item;
            }));

            if (result.status === 'already_checked_in') {
                setCheckInStatus('already_checked_in');
                if (activeTab === 'manual') showStatus(`Already recorded for ${selectedActivityObj.label}`, 'warning');
            } else {
                setCheckInStatus('success');
                playSuccessSound();
                if (activeTab === 'manual') showStatus(`Check-in successful for ${result.data.fullName}`, 'success');
            }

        } catch (err) {
            console.error(err);
            setCheckInStatus('error');
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setErrorMessage(msg);
            if (activeTab === 'manual') showStatus(msg, 'error');
        }
    };

    const handleScan = (detectedCodes: any[]) => {
        if (detectedCodes && detectedCodes.length > 0) {
            const value = detectedCodes[0].rawValue;
            if (value && value !== scanResult) {
                setScanResult(value);
                processCheckIn(value);
            }
        }
    };

    const handleManualSearch = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        try {
            const response = await fetch(`/api/register_church_summit/?search=${searchQuery}&limit=20`);
            const result = await response.json();
            const data = result.data || [];

            const flattened: SearchResult[] = [];
            data.forEach((reg: any) => {
                if (!reg.isGroup || !reg.attendees || reg.attendees.length === 0) {
                    flattened.push({
                        id: reg.id,
                        fullName: reg.fullName,
                        role: reg.serviceRole,
                        churchName: reg.churchName,
                        checkedIn: !!reg.checkedIn,
                        isGroupMember: false,
                        mainId: reg.id.toString(),
                        discountApplied: reg.discountApplied,
                        ticketNumber: reg.ticketNumber,
                        phoneNumber: reg.phoneNumber,
                        activities: reg.activities,
                        paymentStatus: reg.paymentStatus
                    });
                }
                if (reg.isGroup && reg.attendees) {
                    reg.attendees.forEach((att: any, idx: number) => {
                        flattened.push({
                            id: `${reg.id}-ATT-${idx}`,
                            fullName: att.fullName,
                            role: att.role,
                            churchName: reg.churchName,
                            checkedIn: !!att.checkedIn,
                            isGroupMember: true,
                            mainId: `${reg.id}-ATT-${idx}`,
                            ticketNumber: att.ticketNumber,
                            phoneNumber: att.phoneNumber || reg.phoneNumber,
                            activities: att.activities,
                            paymentStatus: reg.paymentStatus
                        });
                    });
                }
            });

            const filtered = flattened.filter(f => {
                const s = searchQuery.toLowerCase();
                const phone = (f.phoneNumber || '').toLowerCase();

                // Simple phone match logic
                let isPhoneMatch = phone.includes(s);
                if (s.length >= 3) {
                    const cleanS = s.replace(/[^\d]/g, '');
                    if (cleanS.length >= 3) {
                        const core = cleanS.startsWith('0') ? cleanS.substring(1) : (cleanS.startsWith('251') ? cleanS.substring(3) : cleanS);
                        if (phone.includes(core)) isPhoneMatch = true;
                    }
                }

                return f.fullName.toLowerCase().includes(s) ||
                    f.role.toLowerCase().includes(s) ||
                    f.id.toString().includes(s) ||
                    (f.ticketNumber && String(f.ticketNumber).includes(s)) ||
                    isPhoneMatch;
            });

            setSearchResults(filtered);
        } catch (e) {
            console.error(e);
        } finally {
            setSearching(false);
        }
    };

    const resetScan = () => {
        setScanResult(null);
        setCheckInStatus('idle');
        setLastCheckIn(null);
    };

    const selectedActivityObj = ACTIVITIES.find(a => a.id === currentActivity) || ACTIVITIES[0];




    return (
        <div className="min-h-screen bg-gray-50 flex">

            {/* Sidebar - Hidden for public access */}
            {/* <aside className={`w-64 bg-white border-r border-gray-100 flex flex-col fixed h-full z-50 transform transition-transform duration-300 lg:transform-none ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                ... sidebar content ...
            </aside> */}

            <main className="flex-1">
                <header className="bg-white border-b border-gray-100 px-4 lg:px-8 py-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sticky top-0 z-30">
                    <div className="flex items-center gap-4 w-full lg:w-auto">
                        <div>
                            <h1 className="text-xl lg:text-2xl font-black text-gray-900 leading-none">Check-In</h1>
                            <p className="text-gray-500 font-medium text-xs lg:text-sm mt-1">Scan QR codes or search manually</p>
                        </div>
                    </div>
                </header>

                {/* Calendar & Activity Selector */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 lg:p-8 mb-6 lg:mb-8 mx-4 lg:mx-8 mt-6 lg:mt-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 lg:mb-8">
                        <div>
                            <h3 className="font-bold text-xl lg:text-2xl text-gray-900 mb-1">Event Schedule</h3>
                            <p className="text-gray-400 text-xs lg:text-sm font-medium">Select a date to manage attendance</p>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
                            <button
                                onClick={() => { setCurrentActivity('swag_collection'); resetScan(); }}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${currentActivity === 'swag_collection'
                                    ? 'bg-purple-500 text-white shadow-md shadow-purple-200'
                                    : 'text-gray-500 hover:bg-gray-200/50 hover:text-purple-600'
                                    }`}
                            >
                                <Gift size={14} />
                                Swag Collection
                            </button>
                        </div>
                    </div>

                    {/* Calendar Strip */}
                    <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
                        {[1, 2, 3].map((day) => {
                            const dateMap = { 1: 'Mar 31', 2: 'Apr 1', 3: 'Apr 2' };
                            const weekDayMap = { 1: 'Tuesday', 2: 'Wednesday', 3: 'Thursday' };
                            const isActiveDay = ACTIVITIES.find(a => a.id === currentActivity)?.day === day;

                            return (
                                <button
                                    key={day}
                                    onClick={() => {
                                        const firstActivityOfDay = ACTIVITIES.find(a => a.day === day);
                                        if (firstActivityOfDay) setCurrentActivity(firstActivityOfDay.id);
                                        resetScan();
                                    }}
                                    className={`flex-1 min-w-[140px] p-4 rounded-2xl border-2 transition-all text-left relative overflow-hidden group ${isActiveDay
                                        ? 'border-[#22C55E] bg-[#F0FDF4] shadow-lg shadow-[#22C55E]/10'
                                        : 'border-transparent bg-gray-50 hover:bg-white hover:border-gray-200'
                                        }`}
                                >
                                    <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isActiveDay ? 'text-[#22C55E]' : 'text-gray-400'}`}>
                                        {weekDayMap[day as 1 | 2 | 3]}
                                    </div>
                                    <div className="flex items-end gap-1">
                                        <span className={`text-3xl font-black leading-none ${isActiveDay ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-600'}`}>
                                            {dateMap[day as 1 | 2 | 3].split(' ')[1]}
                                        </span>
                                        <span className={`text-sm font-bold mb-1 ${isActiveDay ? 'text-gray-500' : 'text-gray-300'}`}>
                                            {dateMap[day as 1 | 2 | 3].split(' ')[0]}
                                        </span>
                                    </div>

                                    {isActiveDay && (
                                        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-[#22C55E] animate-pulse"></div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="h-px bg-gray-100 mb-8"></div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {ACTIVITIES
                            .filter(act => {
                                // If currently on swag (day 0), show nothing or show all? 
                                // Let's stick to showing the day's activities if a day is selected.
                                // If 'swag_collection' is selected, maybe we shouldn't show this grid or filter for day 0? 
                                // Original logic:
                                const currentDayObj = ACTIVITIES.find(a => a.id === currentActivity);
                                let selectedDay = currentDayObj?.day || 1;
                                if (currentActivity === 'swag_collection') selectedDay = 0;

                                return act.day === selectedDay;
                            })
                            .map((act) => {
                                const Icon = act.icon;
                                const isSelected = currentActivity === act.id;
                                if (act.day === 0) return null; // Don't show swag in this grid, it has its own button

                                return (
                                    <button
                                        key={act.id}
                                        onClick={() => { setCurrentActivity(act.id); resetScan(); }}
                                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${isSelected
                                            ? `border-${act.color}-500 bg-${act.color}-50 shadow-md`
                                            : 'border-gray-100 bg-white hover:border-gray-300 hover:shadow-sm'
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isSelected ? `bg-white text-${act.color}-600` : `bg-gray-100 text-gray-400`}`}>
                                            <Icon size={18} />
                                        </div>
                                        <div>
                                            <span className={`block text-xs font-bold uppercase tracking-wider ${isSelected ? `text-${act.color}-700` : 'text-gray-400'}`}>
                                                {act.id.includes('am') ? 'Morning' : act.id.includes('pm') ? 'Afternoon' : 'All Day'}
                                            </span>
                                            <span className={`block font-bold leading-tight ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>
                                                {act.label.replace(/\(Day \d\)/, '').trim()}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}

                        {currentActivity === 'swag_collection' && (
                            <div className="col-span-full py-12 text-center text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                <Gift className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="font-medium">Distributing Swag / Gifts</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Interaction Area */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px] flex flex-col mx-4 lg:mx-8 mb-6 lg:mb-8">
                    <div className="flex border-b border-gray-100">
                        <button
                            className={`flex-1 py-5 text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'scan' ? 'text-[#22C55E] border-b-2 border-[#22C55E] bg-[#F0FDF4]/30' : 'text-gray-400 hover:text-gray-600'}`}
                            onClick={() => { setActiveTab('scan'); resetScan(); setStatusMessage(null); }}
                        >
                            <QrCode size={20} /> Camera Scanner
                        </button>
                        <button
                            className={`flex-1 py-5 text-sm font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'manual' ? 'text-[#22C55E] border-b-2 border-[#22C55E] bg-[#F0FDF4]/30' : 'text-gray-400 hover:text-gray-600'}`}
                            onClick={() => { setActiveTab('manual'); resetScan(); setStatusMessage(null); }}
                        >
                            <Search size={20} /> Manual Search
                        </button>
                    </div>

                    {/* Toast Notification for Manual Tab */}
                    {activeTab === 'manual' && statusMessage && (
                        <div className={`mx-8 mt-4 p-4 rounded-xl border flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 ${statusMessage.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' :
                            statusMessage.type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                                'bg-red-50 border-red-100 text-red-700'
                            }`}>
                            {statusMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                            <span className="font-bold text-sm">{statusMessage.text}</span>
                        </div>
                    )}

                    <div className="flex-1 p-8">
                        {activeTab === 'scan' ? (
                            <div className="flex flex-col items-center">
                                {(checkInStatus === 'idle' || checkInStatus === 'loading') && (
                                    <div className="w-full max-w-md aspect-square rounded-3xl overflow-hidden border-8 border-gray-50 relative bg-black shadow-2xl">
                                        <Scanner
                                            onScan={handleScan}
                                            allowMultiple={true}
                                            styles={{ container: { width: '100%', height: '100%' } }}
                                        />
                                        {checkInStatus === 'loading' && (
                                            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center text-white z-10 flex-col">
                                                <div className="w-12 h-12 border-4 border-[#22C55E] border-t-transparent rounded-full animate-spin mb-4"></div>
                                                <p className="font-bold tracking-widest uppercase text-xs">Authenticating...</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {checkInStatus === 'success' && lastCheckIn && (
                                    <div className="w-full max-w-md text-center animate-in zoom-in-95 duration-300">
                                        <div className="w-24 h-24 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-cyan-100">
                                            <CheckCircle className="w-12 h-12 text-[#22C55E]" />
                                        </div>
                                        <h2 className="text-3xl font-black text-gray-800 mb-2">Authenticated!</h2>
                                        <p className="text-[#22C55E] font-bold uppercase tracking-widest text-xs mb-8">
                                            Added to {selectedActivityObj.label}
                                        </p>

                                        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 mb-8 transform transition-all relative overflow-hidden">
                                            {lastCheckIn.vendorName && (
                                                <div className="absolute top-0 right-0 bg-[#22C55E]/10 text-[#22C55E] px-3 py-1 rounded-bl-xl text-[10px] font-black uppercase tracking-wider border-l border-b border-[#22C55E]/10 flex items-center gap-1.5">
                                                    <Store size={10} />
                                                    {lastCheckIn.vendorName}
                                                </div>
                                            )}
                                            <h3 className="text-2xl font-bold text-gray-900 mb-1">{lastCheckIn.fullName}</h3>
                                            <p className="text-gray-500 font-medium">{lastCheckIn.role}</p>
                                            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-center gap-2 text-gray-400">
                                                <Building2 size={16} />
                                                <span className="text-sm">{lastCheckIn.churchName}</span>
                                            </div>
                                        </div>

                                        {/* Daily Activity Summary */}
                                        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-8 text-left">
                                            <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-3 ml-1">Day {selectedActivityObj.day} Status</h4>
                                            <div className="space-y-2">
                                                {ACTIVITIES.filter(a => a.day === selectedActivityObj.day).map(act => {
                                                    const isDone = lastCheckIn.allActivities && lastCheckIn.allActivities[act.id];
                                                    // Special case for 'check_in' being implicit sometimes? 
                                                    // Ideally rely on allActivities from backend. 
                                                    // Note: backend maps 'check_in' (legacy) to checkedIn bool. 
                                                    // But for day specific check-ins, we use IDs.

                                                    // Visual check
                                                    const done = !!isDone;

                                                    return (
                                                        <div key={act.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50/50">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${done ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                                                <span className={`text-xs font-bold ${done ? 'text-gray-700' : 'text-gray-400'}`}>
                                                                    {act.label.replace(/\(Day \d\)/, '')}
                                                                </span>
                                                            </div>
                                                            {done && <CheckCircle className="w-4 h-4 text-green-500" />}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        <button
                                            onClick={resetScan}
                                            className="w-full py-4 bg-[#22C55E] text-white rounded-2xl hover:bg-[#16A34A] font-bold shadow-xl shadow-[#22C55E]/20 transition-all active:scale-95"
                                        >
                                            Scan Next Attendee
                                        </button>
                                    </div>
                                )}

                                {checkInStatus === 'already_checked_in' && lastCheckIn && (
                                    <div className="w-full max-w-md text-center animate-in zoom-in-95 duration-300">
                                        <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-100">
                                            <AlertCircle className="w-12 h-12 text-amber-600" />
                                        </div>
                                        <h2 className="text-3xl font-black text-gray-800 mb-2">Duplicate Entry</h2>
                                        <p className="text-amber-600 font-bold uppercase tracking-widest text-xs mb-8">
                                            Already recorded for {selectedActivityObj.label}
                                        </p>

                                        <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100 mb-8">
                                            <h3 className="text-xl font-bold text-gray-900 mb-1">{lastCheckIn.fullName}</h3>
                                            <div className="mt-4 pt-4 border-t border-amber-200 text-amber-700">
                                                <p className="text-xs font-bold uppercase tracking-wide mb-1">Last Timestamp</p>
                                                <p className="text-lg font-mono font-bold">
                                                    {new Date(lastCheckIn.checkedInAt).toLocaleTimeString()}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Daily Activity Summary */}
                                        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-8 text-left">
                                            <h4 className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-3 ml-1">Day {selectedActivityObj.day} Status</h4>
                                            <div className="space-y-2">
                                                {ACTIVITIES.filter(a => a.day === selectedActivityObj.day).map(act => {
                                                    const isDone = lastCheckIn.allActivities && lastCheckIn.allActivities[act.id];
                                                    const done = !!isDone;

                                                    return (
                                                        <div key={act.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50/50">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${done ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                                                <span className={`text-xs font-bold ${done ? 'text-gray-700' : 'text-gray-400'}`}>
                                                                    {act.label.replace(/\(Day \d\)/, '')}
                                                                </span>
                                                            </div>
                                                            {done && <CheckCircle className="w-4 h-4 text-green-500" />}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        <button
                                            onClick={resetScan}
                                            className="w-full py-4 bg-gray-800 text-white rounded-2xl hover:bg-black font-bold shadow-xl shadow-gray-100 transition-all"
                                        >
                                            Ready for Next
                                        </button>
                                    </div>
                                )}

                                {checkInStatus === 'error' && (
                                    <div className="w-full max-w-md text-center">
                                        <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-100">
                                            <X className="w-12 h-12 text-red-600" />
                                        </div>
                                        <h2 className="text-3xl font-black text-gray-800 mb-2">Check-in Failed</h2>
                                        <p className="text-red-500 font-medium mb-8 px-4">{errorMessage}</p>
                                        <button
                                            onClick={resetScan}
                                            className="w-full py-4 bg-red-500 text-white rounded-2xl hover:bg-red-600 font-bold shadow-xl shadow-red-100 transition-all"
                                        >
                                            Return to Scanner
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex gap-3">
                                    <div className="flex-1 relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                                            placeholder="Search name, phone, or church..."
                                            className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-[#22C55E]/10 focus:bg-white focus:border-[#22C55E] transition-all outline-none"
                                        />
                                    </div>
                                    <button
                                        onClick={handleManualSearch}
                                        disabled={searching}
                                        className="px-8 bg-[#22C55E] text-white font-bold rounded-2xl hover:bg-[#16A34A] disabled:opacity-50 shadow-lg shadow-[#22C55E]/20 transition-all"
                                    >
                                        {searching ? '...' : 'Search'}
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {searchResults.length === 0 && searchQuery && !searching ? (
                                        <div className="text-center py-20 text-gray-300">
                                            <Search className="w-16 h-16 mx-auto mb-4 opacity-10" />
                                            <p className="font-medium">No attendees found</p>
                                        </div>
                                    ) : (
                                        searchResults.map((person) => {
                                            const isPaid = person.paymentStatus === 'PAY_SUCCESS';
                                            const dayActivities = ACTIVITIES.filter(a => a.day === selectedActivityObj.day && a.day !== 0);

                                            return (
                                                <div key={person.id} className={`border rounded-[24px] p-6 lg:p-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 transition-all group ${isPaid ? 'bg-white border-gray-100 hover:border-[#BBF7D0] hover:shadow-xl hover:shadow-gray-200/50' : 'bg-amber-50/20 border-amber-100 opacity-80'}`}>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <h3 className={`font-black text-xl truncate transition-colors ${isPaid ? 'text-gray-900' : 'text-gray-500'}`}>{person.fullName}</h3>
                                                            {!isPaid && (
                                                                <span className="flex items-center gap-1 text-[10px] font-black uppercase text-amber-600 bg-amber-100 px-2 py-1 rounded-lg border border-amber-200 shrink-0">
                                                                    <AlertCircle size={10} /> Pending Payment
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 font-bold uppercase tracking-wider">
                                                            <span className="flex items-center gap-1.5"><Building2 size={14} /> {person.churchName}</span>
                                                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                            <span>{person.role}</span>
                                                            {person.discountApplied && (
                                                                <span className="bg-[#F0FDF4] text-[#22C55E] px-2 py-0.5 rounded-md border border-[#BBF7D0]">
                                                                    {person.discountApplied} OFF
                                                                </span>
                                                            )}
                                                        </div>
                                                        {person.isGroupMember && <div className="mt-3 inline-block text-[10px] font-black uppercase text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-100">Group Member</div>}
                                                    </div>

                                                    {/* Individual Services Grid for the day */}
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex items-center gap-3 w-full lg:w-auto">
                                                        {dayActivities.map(act => {
                                                            const actDone = person.activities && person.activities[act.id];
                                                            const ActIcon = act.icon;
                                                            const isProcessing = checkInStatus === 'loading' && scanResult === person.mainId && currentActivity === act.id;

                                                            return (
                                                                <button
                                                                    key={act.id}
                                                                    title={act.label}
                                                                    disabled={!!actDone || checkInStatus === 'loading' || !isPaid}
                                                                    onClick={() => {
                                                                        // Set current activity temporarily to use existing processCheckIn
                                                                        setCurrentActivity(act.id);
                                                                        processCheckIn(person.mainId);
                                                                    }}
                                                                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all min-w-[80px] lg:min-w-[100px] gap-1.5 ${actDone
                                                                        ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#22C55E]'
                                                                        : !isPaid
                                                                            ? 'bg-gray-50/50 border-gray-100 text-gray-300 cursor-not-allowed'
                                                                            : 'bg-white border-gray-50 text-gray-400 hover:border-gray-200 hover:text-gray-900 active:scale-95'}`}
                                                                >
                                                                    {isProcessing ? (
                                                                        <div className="w-5 h-5 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin"></div>
                                                                    ) : (
                                                                        <ActIcon size={18} />
                                                                    )}
                                                                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                                                                        {actDone ? 'Done' : act.label.split('(')[0].trim().replace('Tea Break ', '').replace('Check-In', 'Entry')}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}

                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
