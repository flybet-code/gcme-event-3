'use client'
import React, { useState, useRef } from "react";
import jsQR from "jsqr";
import Tesseract from "tesseract.js";
import {
    CheckCircle, AlertCircle, Upload, QrCode,
    Building2, User, Phone, Calendar, Loader2
} from 'lucide-react';

interface CheckInResult {
    fullName: string;
    role: string;
    churchName: string;
    checkedInAt: string;
    isGroupMember: boolean;
    activity: string;
}

export default function SelfCheckInPage() {
    const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error' | 'already_checked_in'>('idle');
    const [result, setResult] = useState<CheckInResult | null>(null);
    const [errorMessage, setErrorMessage] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setStatus('processing');
        setErrorMessage("");

        try {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = async () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        setStatus('error');
                        setErrorMessage("Could not initialize scanner context");
                        return;
                    }

                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);

                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: "dontInvert",
                    });

                    if (code) {
                        processCheckIn(code.data);
                    } else {
                        // Fallback to OCR
                        console.log("QR code not found, trying OCR...");
                        try {
                            const { data: { text } } = await Tesseract.recognize(
                                canvas,
                                'eng',
                                { logger: m => console.log(m) }
                            );
                            console.log("OCR Result:", text);

                            // Regex to find Ticket Format: CLS-123 or CLS-123-1
                            // We look for "CLS-" followed by digits and dashes
                            const match = text.match(/CLS-[\d]+(-[\d]+)?/);

                            if (match) {
                                console.log("OCR Found Ticket:", match[0]);
                                processCheckIn(match[0]);
                            } else {
                                setStatus('error');
                                setErrorMessage("We couldn't find a QR code or the Ticket Number (CLS-...) in this image. Please ensure the ticket is legible.");
                            }
                        } catch (ocrError) {
                            console.error("OCR Error:", ocrError);
                            setStatus('error');
                            setErrorMessage("Failed to analyze the image text.");
                        }
                    }
                };
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error(err);
            setStatus('error');
            setErrorMessage("Failed to process the image.");
        }
    };

    const processCheckIn = async (qrData: string) => {
        let idToCheck = qrData;

        // 1. Try JSON format (Backward compatibility)
        try {
            const parsed = JSON.parse(qrData);
            if (parsed.id) idToCheck = parsed.id;
        } catch (e) {
            // Not JSON, continue with raw string
        }

        // 2. Parse "CLS-" format (New Ticket Number)
        if (typeof idToCheck === 'string' && idToCheck.startsWith('CLS-')) {
            // Check for Group Format: CLS-{ID}-{INDEX_1_BASED}
            const groupMatch = idToCheck.match(/^CLS-(.+)-(\d+)$/);

            if (groupMatch) {
                const realId = groupMatch[1];
                const idx = parseInt(groupMatch[2]);
                // Convert 1-based index back to 0-based ATT format
                idToCheck = `${realId}-ATT-${idx - 1}`;
            } else {
                // Must be Single Format: CLS-{ID}
                idToCheck = idToCheck.replace(/^CLS-/, '');
            }
        }

        try {
            const response = await fetch('/api/check_in_church_summit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    qrId: idToCheck,
                    activity: 'check_in'
                })
            });

            const resultData = await response.json();

            if (!response.ok) {
                throw new Error(resultData.error || 'Check-in failed');
            }

            setResult(resultData.data);
            if (resultData.status === 'already_checked_in') {
                setStatus('already_checked_in');
            } else {
                setStatus('success');
            }

        } catch (err) {
            console.error(err);
            setStatus('error');
            setErrorMessage(err instanceof Error ? err.message : 'Unknown error occurred during check-in');
        }
    };

    const reset = () => {
        setStatus('idle');
        setResult(null);
        setErrorMessage("");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans bg-slate-900">
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
                <div className="text-center mb-12 animate-in fade-in slide-in-from-top-10 duration-1000">
                    <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 mb-6 font-bold text-white text-sm tracking-widest uppercase">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                        Self Check-In Portal
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tighter mb-4">
                        GCME Summit <span className="text-green-400">2026</span>
                    </h1>
                    <p className="text-white/60 text-lg font-medium">Welcome! Please upload your ticket to mark your attendance.</p>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-[40px] shadow-[0_48px_80px_rgba(0,0,0,0.4)] overflow-hidden transition-all duration-500 hover:shadow-[0_48px_100px_rgba(0,0,0,0.5)]">
                    <div className="p-10 md:p-14 text-center">
                        {status === 'idle' && (
                            <div className="animate-in fade-in zoom-in-95 duration-500">
                                <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8 text-green-500 shadow-inner">
                                    <QrCode size={48} strokeWidth={1.5} />
                                </div>
                                <h2 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Ready to Check-In?</h2>
                                <p className="text-gray-500 mb-10 text-lg">Select the image of your digital ticket or use your camera to take a photo of your badge.</p>

                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full bg-[#050505] text-white py-6 rounded-2xl font-black text-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-2xl flex items-center justify-center gap-4 group"
                                >
                                    <Upload className="w-6 h-6 transition-transform group-hover:-translate-y-1" />
                                    Upload Ticket
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept="image/*"
                                    className="hidden"
                                    capture="environment"
                                />
                            </div>
                        )}

                        {status === 'processing' && (
                            <div className="py-12 animate-in fade-in zoom-in-95 duration-300">
                                <div className="relative w-28 h-28 mx-auto mb-10">
                                    <div className="absolute inset-0 border-4 border-green-100 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Loader2 className="w-10 h-10 text-green-500 animate-pulse" />
                                    </div>
                                </div>
                                <h2 className="text-3xl font-black text-gray-900 mb-4">Processing Ticket</h2>
                                <p className="text-gray-500 text-lg">Our system is decoding your ticket details. Please wait a moment...</p>
                            </div>
                        )}

                        {status === 'success' && result && (
                            <div className="animate-in fade-in zoom-in-95 duration-500">
                                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8 text-green-600 shadow-lg shadow-green-100/50">
                                    <CheckCircle size={56} />
                                </div>
                                <h2 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">Successfully Checked In!</h2>
                                <p className="text-green-600 font-bold uppercase tracking-widest text-xs mb-10 bg-green-50 inline-block px-4 py-1.5 rounded-full">Attendance Recorded</p>

                                <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 mb-10 text-left space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Attendee Name</label>
                                        <p className="text-2xl font-black text-gray-900 leading-none">{result.fullName}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200/60">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Church</label>
                                            <p className="font-bold text-gray-700 text-sm flex items-center gap-2">
                                                <Building2 className="w-4 h-4" /> {result.churchName}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Entry Time</label>
                                            <p className="font-bold text-gray-700 text-sm">
                                                {new Date(result.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={reset}
                                    className="w-full bg-green-500 text-white py-6 rounded-2xl font-black text-xl hover:bg-green-600 transition-all shadow-xl shadow-green-100 active:scale-95"
                                >
                                    Check-In Another
                                </button>
                            </div>
                        )}

                        {status === 'already_checked_in' && result && (
                            <div className="animate-in fade-in zoom-in-95 duration-500">
                                <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-8 text-amber-600 shadow-lg shadow-amber-100/50">
                                    <AlertCircle size={56} />
                                </div>
                                <h2 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">Already Registered</h2>
                                <p className="text-amber-600 font-bold uppercase tracking-widest text-xs mb-10 bg-amber-50 inline-block px-4 py-1.5 rounded-full">Attendance Already Tracked</p>

                                <div className="bg-amber-50/50 rounded-3xl p-8 border border-amber-100/50 mb-10 text-left italic">
                                    <p className="text-gray-700 font-medium">
                                        Hello <strong>{result.fullName}</strong>, you have already checked in today at {new Date(result.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Enjoy the summit!
                                    </p>
                                </div>

                                <button
                                    onClick={reset}
                                    className="w-full bg-gray-900 text-white py-6 rounded-2xl font-black text-xl hover:bg-black transition-all shadow-xl shadow-gray-200 active:scale-95"
                                >
                                    Done
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
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full bg-red-500 text-white py-6 rounded-2xl font-black text-xl hover:bg-red-600 transition-all shadow-xl shadow-red-100 mb-4"
                                >
                                    Try Another Image
                                </button>
                                <button
                                    onClick={reset}
                                    className="text-gray-400 font-bold hover:text-gray-600 transition-colors uppercase tracking-[0.2em] text-[10px]"
                                >
                                    Return to Home
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept="image/*"
                                    className="hidden"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Links */}
                <div className="mt-12 text-center text-white/30 text-[10px] font-black uppercase tracking-[0.5em]">
                    Powered by GCME Technology &copy; 2026
                </div>
            </div>
        </div>
    );
}
