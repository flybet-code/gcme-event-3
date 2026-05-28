'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { AuthGate } from '@/components/AuthGate';
import { DashboardMobileMenuButton } from '@/components/DashboardLayout';
import { Loader2, MessageSquareHeart, ArrowLeft, CalendarClock } from 'lucide-react';
import { PlatformFeedbackCampaignsAdmin } from '@/components/PlatformFeedbackCampaignsAdmin';

type FeedbackRow = {
    id: string;
    userId: string;
    userName: string | null;
    userEmail: string;
    appRole: string | null;
    organizationName: string | null;
    eventName: string | null;
    campaignTitle: string | null;
    easeRating: string;
    easeLabel: string;
    recommendScore: number;
    additionalText: string | null;
    createdAt: string;
    updatedAt: string;
};

export default function PlatformFeedbackPage() {
    const { data: session } = authClient.useSession();
    const canViewFeedback = Boolean(
        (session?.user as { canViewPlatformFeedback?: boolean } | undefined)
            ?.canViewPlatformFeedback
    );

    const [authorized, setAuthorized] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<FeedbackRow[]>([]);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<'responses' | 'campaigns'>('responses');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/platform-feedback', { credentials: 'include' });
            const data = await res.json();
            if (res.status === 403) {
                setAuthorized(false);
                return;
            }
            if (!res.ok) throw new Error(data.error || 'Failed to load feedback');
            setAuthorized(true);
            setRows(data.data ?? []);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load');
            setAuthorized(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!session?.user) return;
        if (!canViewFeedback) {
            setAuthorized(false);
            setLoading(false);
            return;
        }
        void load();
    }, [session?.user, canViewFeedback, load]);

    if (authorized === null || loading) {
        return (
            <div className="p-10 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#22C55E]" />
            </div>
        );
    }

    if (authorized === false) {
        return (
            <AuthGate
                variant="forbidden"
                title="Access denied"
                message="Only global platform super admins can view feedback responses. Organization and event roles cannot access this page."
                actionLabel="Back to Dashboard"
                actionHref="/dashboard"
            />
        );
    }

    const avgScore =
        rows.length > 0
            ? (rows.reduce((s, r) => s + r.recommendScore, 0) / rows.length).toFixed(1)
            : '—';

    return (
        <>
            <header className="bg-white border-b border-gray-100 px-4 lg:px-8 py-6 sticky top-0 z-30">
                <div className="flex items-center gap-3 flex-wrap">
                    <DashboardMobileMenuButton />
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <MessageSquareHeart className="w-7 h-7 text-[#22C55E]" />
                            Platform feedback
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            Responses from users across the platform. Not visible to organization or event roles.
                        </p>
                    </div>
                    <Link
                        href="/users"
                        className="text-sm font-bold text-slate-600 hover:text-[#22C55E] flex items-center gap-1"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        User Management
                    </Link>
                </div>
            </header>

            <div className="max-w-7xl px-4 lg:px-8 py-6 lg:py-10">
                <div className="flex flex-wrap bg-slate-100 p-1.5 rounded-[20px] w-fit mb-6 gap-1">
                    <button
                        type="button"
                        onClick={() => setTab('responses')}
                        className={`px-6 py-2.5 rounded-[16px] text-sm font-bold transition flex items-center gap-2 ${
                            tab === 'responses'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <MessageSquareHeart className="w-4 h-4" />
                        Responses
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab('campaigns')}
                        className={`px-6 py-2.5 rounded-[16px] text-sm font-bold transition flex items-center gap-2 ${
                            tab === 'campaigns'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <CalendarClock className="w-4 h-4" />
                        Popup schedule
                    </button>
                </div>

                {tab === 'campaigns' ? (
                    <PlatformFeedbackCampaignsAdmin />
                ) : (
                <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total responses</p>
                        <p className="text-3xl font-black text-slate-900 mt-1">{rows.length}</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Avg. recommend score</p>
                        <p className="text-3xl font-black text-slate-900 mt-1">{avgScore}</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Easy / Medium / Hard</p>
                        <p className="text-sm font-bold text-slate-700 mt-2">
                            Easy: {rows.filter((r) => r.easeRating === 'EASY').length} · Medium:{' '}
                            {rows.filter((r) => r.easeRating === 'MEDIUM').length} · Hard:{' '}
                            {rows.filter((r) => r.easeRating === 'HARD').length}
                        </p>
                    </div>
                </div>

                {error && (
                    <p className="text-red-600 text-sm font-medium mb-4" role="alert">
                        {error}
                    </p>
                )}

                {rows.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-slate-500">
                        No feedback submitted yet.
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/80">
                                        <th className="px-5 py-4 font-bold text-slate-600">User</th>
                                        <th className="px-5 py-4 font-bold text-slate-600">Org / Event</th>
                                        <th className="px-5 py-4 font-bold text-slate-600">Ease</th>
                                        <th className="px-5 py-4 font-bold text-slate-600">Recommend</th>
                                        <th className="px-5 py-4 font-bold text-slate-600">Comments</th>
                                        <th className="px-5 py-4 font-bold text-slate-600">Submitted</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => (
                                        <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                            <td className="px-5 py-4">
                                                <div className="font-bold text-slate-900">{r.userName || '—'}</div>
                                                <div className="text-slate-500 text-xs">{r.userEmail}</div>
                                                {r.appRole && (
                                                    <div className="text-xs text-slate-400 mt-0.5">{r.appRole}</div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-slate-600 text-xs">
                                                {r.organizationName || '—'}
                                                {r.eventName && (
                                                    <div className="text-slate-400">{r.eventName}</div>
                                                )}
                                                {r.campaignTitle && (
                                                    <div className="text-slate-400 mt-0.5">{r.campaignTitle}</div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 font-medium">{r.easeLabel}</td>
                                            <td className="px-5 py-4">
                                                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#F0FDF4] text-[#16A34A] font-black">
                                                    {r.recommendScore}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-slate-600 max-w-md whitespace-pre-wrap">
                                                {r.additionalText || (
                                                    <span className="text-slate-300 italic">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-slate-500 text-xs whitespace-nowrap">
                                                {new Date(r.createdAt).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                </>
                )}
            </div>
        </>
    );
}
