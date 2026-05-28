'use client';

import { useEffect, useState } from 'react';
import type { FormField } from '@prisma/client';
import { DynamicForm } from '@/components/forms/DynamicForm';
import ChurchLeadershipSummitRegistration from '@/components/register/ChurchLeadershipSummitRegistration';
import { isSummitLegacyForm } from '@/lib/form-templates';
import type { SummitRegistrationClientPayload } from '@/lib/summit-registration-config';

import { PremiumRegistrationView } from '@/components/forms/PremiumRegistrationView';

type PublicEventPayload = {
    organization: { id: string; name: string; slug: string };
    event: {
        id: string;
        name: string;
        slug: string;
        startsAt?: string | null;
        endsAt?: string | null;
    };
    form: { id: string; name: string; fields: FormField[]; i18nMeta?: any };
    summitRegistration?: SummitRegistrationClientPayload;
};

type Props = {
    orgSlug: string;
    eventSlug: string;
    /** Admin booth: slightly different copy */
    variant?: 'public' | 'admin';
};

export function OrgEventRegistration({ orgSlug, eventSlug, variant = 'public' }: Props) {
    const [payload, setPayload] = useState<PublicEventPayload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [submitErr, setSubmitErr] = useState<string | null>(null);
    const [done, setDone] = useState<{ id: string; qrPayload?: string } | null>(null);

    useEffect(() => {
        setPayload(null);
        setError(null);
        setDone(null);
        fetch(`/api/public/events/${encodeURIComponent(orgSlug)}/${encodeURIComponent(eventSlug)}`)
            .then((r) => {
                if (!r.ok) throw new Error('Failed to load form');
                return r.json();
            })
            .then((d: PublicEventPayload) => setPayload(d))
            .catch(() => setError('Could not load registration form for this organization and event.'));
    }, [orgSlug, eventSlug]);

    if (error) {
        return (
            <div className="p-6 text-center text-red-600 rounded-xl border border-red-100 bg-red-50 max-w-lg mx-auto">
                {error}
            </div>
        );
    }

    if (!payload) {
        return (
            <div className="p-8 text-center text-gray-600">
                {variant === 'admin' ? 'Loading form…' : 'Loading…'}
            </div>
        );
    }

    if (isSummitLegacyForm(payload.form)) {
        return (
            <ChurchLeadershipSummitRegistration
                orgSlug={orgSlug}
                eventSlug={eventSlug}
                isAdmin={variant === 'admin'}
                summitRegistration={payload.summitRegistration}
            />
        );
    }

    // New Premium Logic
    if (payload.form.i18nMeta?.registrationSettings) {
        return (
            <PremiumRegistrationView 
                orgSlug={orgSlug}
                eventSlug={eventSlug}
                form={payload.form as any}
                event={payload.event}
                variant={variant}
                summitRegistration={payload.summitRegistration}
            />
        );
    }

    if (done) {
        return (
            <div className="p-8 text-center max-w-md mx-auto space-y-3">
                <h2 className="text-2xl font-bold text-[#22C55E]">Registration submitted</h2>
                <p className="text-gray-600">
                    {variant === 'admin'
                        ? 'The registrant has been recorded for this organization and event.'
                        : 'Thank you. You will receive confirmation when applicable.'}
                </p>
                <p className="text-xs text-gray-400 font-mono break-all">Ref: {done.id}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="text-center space-y-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#22C55E]">
                    {payload.organization.name}
                </p>
                <h1 className="text-2xl font-bold text-gray-900">{payload.event.name}</h1>
                <p className="text-sm text-gray-500">
                    {variant === 'admin' ? 'Internal registration (active organization)' : 'Event registration'}
                </p>
            </div>
            {submitErr && (
                <p className="text-center text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg py-2 px-3">
                    {submitErr}
                </p>
            )}
            <DynamicForm
                fields={payload.form.fields}
                onSubmit={async (responses) => {
                    setSubmitErr(null);
                    const res = await fetch('/api/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            orgSlug,
                            eventSlug,
                            responses,
                            isGroup: false,
                        }),
                    });
                    if (!res.ok) {
                        const j = await res.json().catch(() => ({}));
                        setSubmitErr((j as { error?: string }).error || 'Submit failed');
                        return;
                    }
                    const data = await res.json();
                    setDone({ id: data.id as string, qrPayload: data.qrPayload as string | undefined });
                }}
                submitLabel={variant === 'admin' ? 'Save registration' : 'Register'}
            />
        </div>
    );
}
