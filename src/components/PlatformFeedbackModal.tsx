'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, MessageSquareHeart, X } from 'lucide-react';
import type { PlatformEaseRating } from '@/lib/platform-feedback';

const EASE_OPTIONS: { value: PlatformEaseRating; label: string }[] = [
    { value: 'EASY', label: 'Easy' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HARD', label: 'Hard' },
];

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export type PlatformFeedbackModalContext = {
    campaignId?: string;
    title?: string;
    organizationName?: string;
    eventName?: string;
    isAutoPrompt?: boolean;
};

type Props = {
    open: boolean;
    onClose: () => void;
    context?: PlatformFeedbackModalContext;
};

export function PlatformFeedbackModal({ open, onClose, context }: Props) {
    const [easeRating, setEaseRating] = useState<PlatformEaseRating | ''>('');
    const [recommendScore, setRecommendScore] = useState<number | null>(null);
    const [additionalText, setAdditionalText] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [thankYou, setThankYou] = useState(false);

    const loadExisting = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/platform-feedback/me', { credentials: 'include' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to load');
            if (data.submitted && data.feedback) {
                setEaseRating(data.feedback.easeRating);
                setRecommendScore(data.feedback.recommendScore);
                setAdditionalText(data.feedback.additionalText ?? '');
            } else {
                setEaseRating('');
                setRecommendScore(null);
                setAdditionalText('');
            }
        } catch {
            setEaseRating('');
            setRecommendScore(null);
            setAdditionalText('');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (open) {
            setThankYou(false);
            setError('');
            void loadExisting();
        }
    }, [open, loadExisting]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!easeRating) {
            setError('Please choose how easy the platform feels to use.');
            return;
        }
        if (recommendScore === null) {
            setError('Please select a score from 1 to 10.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch('/api/platform-feedback', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    easeRating,
                    recommendScore,
                    additionalText: additionalText.trim() || null,
                    campaignId: context?.campaignId ?? null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to submit');
            setThankYou(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to submit feedback');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemindLater = async () => {
        if (context?.campaignId) {
            try {
                await fetch('/api/platform-feedback/prompt', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ campaignId: context.campaignId, snoozeDays: 1 }),
                });
            } catch {
                /* ignore */
            }
        }
        onClose();
    };

    const modalTitle = context?.title?.trim() || 'Platform feedback';
    const contextLine =
        context?.eventName && context?.organizationName
            ? `${context.organizationName} · ${context.eventName}`
            : context?.organizationName || null;

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={context?.isAutoPrompt ? handleRemindLater : onClose}
                aria-hidden
            />
            <div
                className="relative bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto"
                role="dialog"
                aria-labelledby="platform-feedback-title"
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition z-10"
                    aria-label="Close"
                >
                    <X className="w-5 h-5" />
                </button>

                {thankYou ? (
                    <div className="p-10 text-center">
                        <div className="mx-auto w-16 h-16 rounded-full bg-[#F0FDF4] flex items-center justify-center mb-6">
                            <CheckCircle2 className="w-9 h-9 text-[#22C55E]" />
                        </div>
                        <h2 id="platform-feedback-title" className="text-2xl font-black text-slate-900 mb-3">
                            Thank you!
                        </h2>
                        <p className="text-slate-500 leading-relaxed mb-8">
                            We appreciate you taking the time to share your feedback. Your responses help us improve
                            the platform for everyone.
                        </p>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full bg-[#22C55E] text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-[#22C55E]/20 hover:scale-[1.02] active:scale-[0.98] transition"
                        >
                            Close
                        </button>
                    </div>
                ) : (
                    <div className="p-8 pt-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 rounded-xl bg-[#F0FDF4]">
                                <MessageSquareHeart className="w-6 h-6 text-[#22C55E]" />
                            </div>
                            <h2 id="platform-feedback-title" className="text-2xl font-black text-slate-900">
                                {modalTitle}
                            </h2>
                        </div>
                        {contextLine && (
                            <p className="text-xs font-bold text-[#22C55E] mb-2">{contextLine}</p>
                        )}
                        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                            Tell us how the platform is working for you.
                        </p>

                        {loading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-[#22C55E]" />
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-8">
                                <fieldset>
                                    <legend className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                                        1. How is the platform?
                                    </legend>
                                    <div className="grid grid-cols-3 gap-2">
                                        {EASE_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setEaseRating(opt.value)}
                                                className={`py-3.5 px-2 rounded-2xl border-2 font-bold text-sm transition ${
                                                    easeRating === opt.value
                                                        ? 'border-[#22C55E] bg-[#F0FDF4] text-slate-900'
                                                        : 'border-slate-100 text-slate-600 hover:border-slate-200'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </fieldset>

                                <fieldset>
                                    <legend className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                                        2. How likely are you to recommend this platform to others?
                                    </legend>
                                    <p className="text-xs text-slate-400 mb-3">Select a number from 1 (not likely) to 10 (very likely).</p>
                                    <div className="grid grid-cols-5 gap-2">
                                        {SCORES.map((n) => (
                                            <button
                                                key={n}
                                                type="button"
                                                onClick={() => setRecommendScore(n)}
                                                className={`aspect-square rounded-xl border-2 font-bold text-sm transition ${
                                                    recommendScore === n
                                                        ? 'border-[#22C55E] bg-[#22C55E] text-white'
                                                        : 'border-slate-100 text-slate-600 hover:border-slate-200'
                                                }`}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                </fieldset>

                                <div>
                                    <label
                                        htmlFor="platform-feedback-extra"
                                        className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3"
                                    >
                                        3. Additional feedback <span className="font-normal normal-case">(optional)</span>
                                    </label>
                                    <textarea
                                        id="platform-feedback-extra"
                                        value={additionalText}
                                        onChange={(e) => setAdditionalText(e.target.value)}
                                        rows={4}
                                        placeholder="Share anything else that would help us improve…"
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-[#22C55E]/10 focus:border-[#22C55E] outline-none text-sm resize-y min-h-[100px]"
                                    />
                                </div>

                                {error && (
                                    <p className="text-sm text-red-600 font-medium" role="alert">
                                        {error}
                                    </p>
                                )}

                                <div className="flex flex-col gap-3 pt-2">
                                    {context?.isAutoPrompt && context.campaignId && (
                                        <button
                                            type="button"
                                            onClick={handleRemindLater}
                                            className="w-full text-center text-sm font-bold text-slate-400 hover:text-slate-600 transition py-1"
                                        >
                                            Remind me tomorrow
                                        </button>
                                    )}
                                    <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={context?.isAutoPrompt ? handleRemindLater : onClose}
                                        className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 transition"
                                    >
                                        {context?.isAutoPrompt ? 'Not now' : 'Cancel'}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex-1 bg-[#22C55E] text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-[#22C55E]/20 hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Sending…
                                            </>
                                        ) : (
                                            'Submit feedback'
                                        )}
                                    </button>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
