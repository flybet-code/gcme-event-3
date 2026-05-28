'use client'
import React, { useState } from "react";
import { QRCodeSVG } from 'qrcode.react';
import {
    CheckCircle, AlertCircle, Search,
    Building2, User, Phone, Loader2, Download, Ticket
} from 'lucide-react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { formatSummitPersonName } from '@/lib/summit-registration-config';

interface CheckInResult {
    title?: string;
    fullName: string;
    role: string;
    churchName: string;
    checkedInAt: string;
    isGroupMember: boolean;
    activity: string;
}

export default function BadgeSearchPage() {
    const [status, setStatus] = useState<'idle' | 'searching' | 'results' | 'error' | 'empty'>('idle');
    const [phoneNumber, setPhoneNumber] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [errorMessage, setErrorMessage] = useState("");
    const [badgeTemplateSrc, setBadgeTemplateSrc] = useState('/badge_template.jpg');
    const [showTitleField, setShowTitleField] = useState(true);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!phoneNumber) return;

        setStatus('searching');
        setErrorMessage("");

        try {
            const response = await fetch(`/api/self-checkin/search?phone=${encodeURIComponent(phoneNumber)}`);
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Search failed');

            if (data.data && data.data.length > 0) {
                setResults(data.data);
                setShowTitleField(data.showTitleField !== false);
                setBadgeTemplateSrc(
                    typeof data.badgeTemplateSrc === 'string' && data.badgeTemplateSrc
                        ? data.badgeTemplateSrc
                        : '/badge_template.jpg'
                );
                setStatus('results');
            } else {
                setResults([]);
                setStatus('empty');
            }
        } catch (err) {
            console.error(err);
            setStatus('error');
            setErrorMessage(err instanceof Error ? err.message : 'Failed to search for badges');
        }
    };

    const downloadBadge = async (elementId: string, fileName: string) => {
        const element = document.getElementById(elementId);
        if (!element) return;

        try {
            const dataUrl = await toPng(element, {
                cacheBust: true,
                pixelRatio: 4,
                backgroundColor: '#ffffff',
                width: element.offsetWidth,
                height: element.offsetHeight
            });

            const link = document.createElement('a');
            link.download = `${fileName}.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('Download error:', error);
            alert('Failed to download badge. Please try again.');
        }
    };

    const reset = () => {
        setStatus('idle');
        setResults([]);
        setErrorMessage("");
        setBadgeTemplateSrc('/badge_template.jpg');
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans bg-slate-900 py-12">
            {/* Background Image with Overlay */}
            <div className="absolute inset-0 z-0">
                <img
                    src="/summit_bg.png"
                    alt="Summit Background"
                    className="w-full h-full object-cover opacity-60 scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80"></div>
            </div>

            <div className="w-full max-w-[640px] px-6 relative z-10">
                {/* Branding */}
                <div className="text-center mb-8 animate-in fade-in slide-in-from-top-10 duration-1000">
                    <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 mb-6 font-bold text-white text-sm tracking-widest uppercase">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                        Badge Finder
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tighter mb-4">
                        GCME Summit <span className="text-green-400">2025</span>
                    </h1>
                    <p className="text-white/60 text-lg font-medium">Enter your registered phone number to download your digital ticket.</p>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-[40px] shadow-[0_48px_80px_rgba(0,0,0,0.4)] overflow-hidden transition-all duration-500">
                    <div className="p-10 md:p-14 text-center">
                        {status === 'idle' && (
                            <form onSubmit={handleSearch} className="animate-in fade-in zoom-in-95 duration-500">
                                <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8 text-green-500 shadow-inner">
                                    <Ticket size={48} strokeWidth={1.5} />
                                </div>
                                <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Find My Badge</h2>
                                <p className="text-gray-500 mb-10 text-lg">Enter the phone number you used during registration to retrieve your badge.</p>

                                <div className="relative mb-6">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Phone className="h-6 w-6 text-gray-400" />
                                    </div>
                                    <input
                                        type="tel"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        placeholder="0911223344"
                                        required
                                        className="block w-full pl-14 pr-4 py-6 border border-gray-200 rounded-2xl text-xl focus:ring-4 focus:ring-green-100 focus:border-green-500 transition-all outline-none"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-[#050505] text-white py-6 rounded-2xl font-black text-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-2xl flex items-center justify-center gap-4 group"
                                >
                                    <Search className="w-6 h-6 transition-transform group-hover:scale-110" />
                                    Search Badge
                                </button>
                            </form>
                        )}

                        {status === 'searching' && (
                            <div className="py-12 animate-in fade-in zoom-in-95 duration-300">
                                <div className="relative w-28 h-28 mx-auto mb-10">
                                    <div className="absolute inset-0 border-4 border-green-100 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Loader2 className="w-10 h-10 text-green-500 animate-pulse" />
                                    </div>
                                </div>
                                <h2 className="text-3xl font-black text-gray-900 mb-4">Searching...</h2>
                                <p className="text-gray-500 text-lg">We're looking for your registration records.</p>
                            </div>
                        )}

                        {status === 'results' && (
                            <div className="animate-in fade-in zoom-in-95 duration-500">
                                <h2 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">Badge(s) Found!</h2>
                                <p className="text-green-600 font-bold uppercase tracking-widest text-xs mb-10 bg-green-50 inline-block px-4 py-1.5 rounded-full">
                                    {results.length} Ticket{results.length > 1 ? 's' : ''} Ready
                                </p>

                                <div className="space-y-20 max-h-[60vh] overflow-y-auto px-2 pb-10 custom-scrollbar">
                                    {results.map((badge, index) => {
                                        const badgeId = `badge-result-${index}`;
                                        const qrData = {
                                            id: badge.rawId,
                                            name: formatSummitPersonName(badge.fullName, badge.title, showTitleField),
                                            church: badge.churchName,
                                            type: badge.type,
                                            timestamp: new Date().toISOString()
                                        };

                                        return (
                                            <div key={index} className="flex flex-col items-center">
                                                <div id={badgeId} className="w-[360px] h-[227px] bg-white shadow-2xl overflow-hidden relative font-sans text-left">
                                                    {/* Full Ticket Info - Using Template Image */}
                                                    <div className="relative w-full h-full overflow-hidden">
                                                        {/* Background Image Tag */}
                                                        <img
                                                            src={badgeTemplateSrc}
                                                            alt="Badge Template"
                                                            className="absolute inset-0 w-full h-full object-cover z-0"
                                                        />

                                                        {/* QR Code Overlay - Positioned in the brown square */}
                                                        <div className="absolute left-[9.5%] bottom-[9.5%] w-[20%] aspect-square flex items-center justify-center p-1 z-10">
                                                            <QRCodeSVG
                                                                value={badge.id}
                                                                size={100}
                                                                level="H"
                                                                bgColor="transparent"
                                                                fgColor="#FFFFFF"
                                                                className="w-full h-full drop-shadow-sm"
                                                            />
                                                        </div>

                                                        {/* Ticket Number Overlay - Top right orange box */}
                                                        <div className="absolute top-[9%] right-[2%] w-[18%] h-[12%] flex items-center justify-center z-10">
                                                            <span className="font-mono text-[12px] font-black text-white tracking-widest drop-shadow-sm leading-none pt-1">
                                                                {badge.ticketNo ? badge.ticketNo.toString().padStart(4, '0') : '0000'}
                                                            </span>
                                                        </div>

                                                        {/* Name Overlay - Centered in white area */}
                                                        <div className="absolute right-0 top-[8%] bottom-[8%] w-[62%] flex flex-col items-center justify-center text-center px-4 z-10">
                                                            <h2 className="text-[16px] font-black text-[#5D2E17] leading-none line-clamp-2 uppercase drop-shadow-sm" style={{ fontFamily: 'system-ui, sans-serif' }}>
                                                                {formatSummitPersonName(badge.fullName, badge.title, showTitleField)}
                                                            </h2>
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => downloadBadge(badgeId, `badge-${badge.fullName.replace(/\s+/g, '_')}`)}
                                                    className="mt-4 flex items-center px-6 py-2.5 bg-gray-900 text-white rounded-full hover:bg-black transition-all shadow-lg hover:shadow-xl text-sm font-medium"
                                                >
                                                    <Download className="w-4 h-4 mr-2" /> Download Ticket
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={reset}
                                    className="mt-8 text-green-500 font-bold hover:text-green-600 transition-colors uppercase tracking-[0.2em] text-[10px]"
                                >
                                    Search for another number
                                </button>
                            </div>
                        )}

                        {status === 'empty' && (
                            <div className="animate-in fade-in zoom-in-95 duration-500">
                                <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-8 text-amber-500">
                                    <AlertCircle size={56} />
                                </div>
                                <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">No Badges Found</h2>
                                <p className="text-gray-500 mb-10 text-lg">We couldn't find any successful registrations for <strong>{phoneNumber}</strong>. Please check the number or ensure payment is confirmed.</p>

                                <button
                                    onClick={reset}
                                    className="w-full bg-amber-500 text-white py-6 rounded-2xl font-black text-xl hover:bg-amber-600 transition-all shadow-xl"
                                >
                                    Try Again
                                </button>
                            </div>
                        )}

                        {status === 'error' && (
                            <div className="animate-in fade-in zoom-in-95 duration-500">
                                <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-8 text-red-500">
                                    <AlertCircle size={56} />
                                </div>
                                <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Something Went Wrong</h2>
                                <p className="text-red-500 font-medium mb-10 text-lg bg-red-50 p-4 rounded-2xl">{errorMessage}</p>

                                <button
                                    onClick={reset}
                                    className="w-full bg-red-500 text-white py-6 rounded-2xl font-black text-xl hover:bg-red-600 transition-all shadow-xl"
                                >
                                    Try Again
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Links */}
                <div className="mt-12 text-center text-white/30 text-[10px] font-black uppercase tracking-[0.5em]">
                    Powered by Yotor Church Management System &copy; 2026
                </div>
            </div >
        </div >
    );
}
