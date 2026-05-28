'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { authClient } from "@/lib/auth-client";
import { LogIn, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';

export function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            const { error: signInError } = await authClient.signIn.email({
                email,
                password,
            });

            if (signInError) {
                setError(signInError.message || "Invalid email or password");
            }
            // Better-auth useSession hook will automatically update on sign-in success
        } catch (err) {
            setError("An unexpected error occurred. Please try again.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
            <div className="bg-white rounded-[32px] shadow-[0_32px_80px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden">
                <div className="p-8 sm:p-12">
                    <div className="flex justify-center mb-8">
                        <div className="w-16 h-16 bg-[#F0FDF4] rounded-2xl flex items-center justify-center text-[#22C55E]">
                            <LogIn className="w-8 h-8" />
                        </div>
                    </div>
                    
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-black text-gray-900 mb-2">Welcome Back</h2>
                        <p className="text-gray-500 font-medium">Please enter your credentials to access the summit management system.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3 text-red-600 animate-in slide-in-from-top-2">
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                <p className="text-sm font-bold">{error}</p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder="admin@example.com"
                                    className="w-full pl-14 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-[#22C55E]/10 focus:border-[#22C55E] outline-none font-bold transition-all text-gray-900"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between ml-2 mr-2">
                                <label className="block text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Password</label>
                                <Link
                                    href="/auth/forgot-password"
                                    className="text-xs font-bold text-[#22C55E] hover:underline"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                    className="w-full pl-14 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-4 focus:ring-[#22C55E]/10 focus:border-[#22C55E] outline-none font-bold transition-all text-gray-900"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#22C55E] hover:bg-[#1DAE50] text-white py-5 rounded-[20px] font-black text-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-[#22C55E]/20 flex items-center justify-center gap-3 disabled:opacity-70 disabled:hover:scale-100"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    <span>Verifying...</span>
                                </>
                            ) : (
                                <>
                                    <span>Access Dashboard</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
            
            <p className="text-center mt-8 text-gray-400 text-sm font-medium">
                Authorized Personnel Only • GCME Event Management
            </p>
        </div>
    );
}
