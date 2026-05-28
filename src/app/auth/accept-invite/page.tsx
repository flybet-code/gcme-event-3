'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';

type InviteData = {
    email: string;
    inviteKind: 'org' | 'platform';
    accountExists?: boolean;
    existingUserName?: string | null;
    organizationName?: string;
    organizationSlug?: string;
    orgRole?: string;
    grantPlatformSuperAdmin?: boolean;
    role?: { name?: string };
};

function isEmailAlreadyRegisteredMessage(message: string): boolean {
    const m = message.toLowerCase();
    return (
        m.includes('already') &&
        (m.includes('exist') || m.includes('registered') || m.includes('use') || m.includes('taken'))
    );
}

function AcceptInviteContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isVerifying, setIsVerifying] = useState(true);
    const [invitationData, setInvitationData] = useState<InviteData | null>(null);

    const accountExists = Boolean(invitationData?.accountExists);

    useEffect(() => {
        if (!token) {
            setError('Invalid invitation link');
            setIsVerifying(false);
            return;
        }

        fetch(`/api/auth/validate-invite?token=${token}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.error) {
                    setError(data.error);
                } else {
                    setInvitationData(data);
                    if (data.existingUserName) {
                        setName(data.existingUserName);
                    }
                }
            })
            .catch(() => setError('Failed to validate invitation'))
            .finally(() => setIsVerifying(false));
    }, [token]);

    const finishInvite = async () => {
        const res = await fetch('/api/auth/complete-invite', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, name: name.trim() || undefined }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            setError((data as { error?: string }).error || 'Could not complete invitation');
            setLoading(false);
            return false;
        }
        setSuccess(true);
        setTimeout(() => {
            const slug = invitationData?.organizationSlug;
            if (invitationData?.inviteKind === 'org' && slug) {
                window.location.href = `/${slug}/events`;
            } else {
                window.location.href = '/dashboard';
            }
        }, 1200);
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!invitationData?.email || !token) {
            setError('Invalid invitation');
            return;
        }

        if (!accountExists) {
            if (password !== confirmPassword) {
                setError('Passwords do not match');
                return;
            }
            if (password.length < 8) {
                setError('Password must be at least 8 characters');
                return;
            }
            if (!name.trim()) {
                setError('Full name is required');
                return;
            }
        } else if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setLoading(true);

        try {
            if (accountExists) {
                const { error: signInError } = await authClient.signIn.email({
                    email: invitationData.email,
                    password,
                });
                if (signInError) {
                    setError(
                        signInError.message ||
                            'Could not sign in. Use the password from your previous signup, or reset your password from the login page.'
                    );
                    setLoading(false);
                    return;
                }
                await finishInvite();
                return;
            }

            await authClient.signUp.email(
                {
                    email: invitationData.email,
                    password,
                    name: name.trim(),
                },
                {
                    onSuccess: async () => {
                        await finishInvite();
                    },
                    onError: (ctx) => {
                        const msg = ctx.error.message || 'Could not create account';
                        if (isEmailAlreadyRegisteredMessage(msg)) {
                            setInvitationData((prev) =>
                                prev ? { ...prev, accountExists: true } : prev
                            );
                            setError(
                                'This email already has an account. Enter your existing password below to accept the invitation.'
                            );
                        } else {
                            setError(msg);
                        }
                        setLoading(false);
                    },
                }
            );
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'An error occurred during registration';
            if (isEmailAlreadyRegisteredMessage(message)) {
                setInvitationData((prev) => (prev ? { ...prev, accountExists: true } : prev));
                setError(
                    'This email already has an account. Enter your existing password below to accept the invitation.'
                );
            } else {
                setError(message);
            }
            setLoading(false);
        }
    };

    if (isVerifying) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 animate-spin text-[#22C55E]" />
            </div>
        );
    }

    if (error && !invitationData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">❌</span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Invitation</h2>
                    <p className="text-gray-500 mb-6">{error}</p>
                    <button
                        type="button"
                        onClick={() => router.push('/')}
                        className="text-[#22C55E] font-medium hover:underline"
                    >
                        Return to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-[#22C55E]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-8 h-8 text-[#22C55E]" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Accept Invitation</h1>
                    <p className="text-gray-500 mt-2">
                        {invitationData?.inviteKind === 'org' ? (
                            <>
                                Join{' '}
                                <span className="font-semibold text-gray-900">
                                    {invitationData?.organizationName}
                                </span>{' '}
                                as{' '}
                                <span className="font-semibold text-gray-900">{invitationData?.orgRole}</span>
                            </>
                        ) : (
                            <>
                                You&apos;ve been invited as{' '}
                                <span className="font-semibold text-gray-900">
                                    {invitationData?.grantPlatformSuperAdmin
                                        ? 'Platform super admin'
                                        : invitationData?.role?.name || 'Team member'}
                                </span>
                            </>
                        )}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">{invitationData?.email}</p>
                    {accountExists && (
                        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-4">
                            You already have an account for this email. Sign in with your password to join.
                        </p>
                    )}
                </div>

                {success ? (
                    <div className="text-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-[#22C55E] mx-auto mb-4" />
                        <p className="text-gray-600 font-medium">Setting up your account...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!accountExists && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20 outline-none transition"
                                    placeholder="Enter your full name"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {accountExists ? 'Your password' : 'Create Password'}
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20 outline-none transition"
                                    placeholder="Min. 8 characters"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            {accountExists && (
                                <p className="mt-2 text-xs text-gray-500">
                                    <Link href="/auth/forgot-password" className="text-[#22C55E] font-medium hover:underline">
                                        Forgot password?
                                    </Link>
                                </p>
                            )}
                        </div>

                        {!accountExists && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20 outline-none transition"
                                    placeholder="Re-enter password"
                                />
                            </div>
                        )}

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center">{error}</div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#22C55E] text-white py-3 rounded-xl font-bold hover:bg-[#16A34A] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : accountExists ? (
                                'Sign in & accept invitation'
                            ) : (
                                'Create account'
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

export default function AcceptInvitePage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <Loader2 className="w-8 h-8 animate-spin text-[#22C55E]" />
                </div>
            }
        >
            <AcceptInviteContent />
        </Suspense>
    );
}
