'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { getPasswordResetRedirectUrl } from '@/lib/app-url';
import { Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { error: resetError } = await authClient.requestPasswordReset({
                email: email.trim(),
                redirectTo: getPasswordResetRedirectUrl(),
            });

            if (resetError) {
                setError(resetError.message || 'Could not send reset email. Try again later.');
                return;
            }

            setSent(true);
        } catch {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-[#22C55E]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Mail className="w-8 h-8 text-[#22C55E]" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Forgot password</h1>
                    <p className="text-gray-500 mt-2 text-sm">
                        Enter your email and we will send you a link to reset your password.
                    </p>
                </div>

                {sent ? (
                    <div className="text-center space-y-4">
                        <CheckCircle2 className="w-10 h-10 text-[#22C55E] mx-auto" />
                        <p className="text-gray-600 text-sm">
                            If an account exists for <strong>{email}</strong>, you will receive a reset link shortly.
                        </p>
                        <Link href="/login" className="inline-block text-[#22C55E] font-medium hover:underline text-sm">
                            Back to sign in
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20 outline-none transition"
                                placeholder="you@example.com"
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#22C55E] text-white py-3 rounded-xl font-bold hover:bg-[#16A34A] transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send reset link'}
                        </button>

                        <p className="text-center text-sm text-gray-500">
                            <Link href="/login" className="text-[#22C55E] font-medium hover:underline">
                                Back to sign in
                            </Link>
                        </p>
                    </form>
                )}
            </div>
        </div>
    );
}
