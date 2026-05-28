'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { AuthGate } from '@/components/AuthGate';
import { DashboardMobileMenuButton } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';
import { MessageSquare, Loader2, Send, Users } from 'lucide-react';

type EventRow = { id: string; name: string; slug: string };
type SmsBatchRow = { batchNumber: number; count: number; label: string; phones: string[] };

export default function TeamSmsPage() {
    const { data: session } = authClient.useSession();
    const [authorized, setAuthorized] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [sendingSms, setSendingSms] = useState(false);

    const [events, setEvents] = useState<EventRow[]>([]);
    const [smsBatches, setSmsBatches] = useState<SmsBatchRow[]>([]);
    const [brandingTitle, setBrandingTitle] = useState('');

    const [eventId, setEventId] = useState('');
    const [smsTo, setSmsTo] = useState('');
    const [smsText, setSmsText] = useState('');
    const [smsBatchNumber, setSmsBatchNumber] = useState('');
    const [statusMsg, setStatusMsg] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (!session?.user) return;
        const u = session.user as {
            legacyRole?: string;
            role?: string;
            orgRole?: string | null;
            orgPermissions?: string[];
            isPlatformSuperAdmin?: boolean;
        };
        const plat = hasPlatformElevatedAccess(u.isPlatformSuperAdmin, u.legacyRole ?? u.role);
        const orgRole = u.orgRole;
        const orgPerms = u.orgPermissions || [];
        const can = plat || orgRole === 'OWNER' || orgRole === 'ADMIN' || orgPerms.includes('manage_users');
        setAuthorized(can);
    }, [session?.user]);

    const load = useCallback(() => {
        setLoading(true);
        const query = eventId ? `?eventId=${encodeURIComponent(eventId)}` : '';
        fetch(`/api/org-emails${query}`, { credentials: 'include' })
            .then((r) => r.json())
            .then((d) => {
                if (d.error) {
                    setErrorMsg(d.error);
                    return;
                }
                setEvents(d.events || []);
                setSmsBatches(d.registrationSmsBatches || []);
                setBrandingTitle(d.branding?.eventTitle || d.organization?.name || '');
                if (d.effectiveEventId && d.effectiveEventId !== eventId) {
                    setEventId(d.effectiveEventId);
                } else if (!eventId && d.events?.[0]?.id) {
                    setEventId(d.events[0].id);
                }
            })
            .catch(() => setErrorMsg('Could not load SMS data'))
            .finally(() => setLoading(false));
    }, [eventId]);

    useEffect(() => {
        if (authorized) load();
    }, [authorized, load]);

    const selectedBatch = useMemo(
        () => smsBatches.find((b) => String(b.batchNumber) === smsBatchNumber) || null,
        [smsBatches, smsBatchNumber]
    );

    const parsePhones = (raw: string): string[] =>
        raw
            .split(/[,;\n\r]+/)
            .map((s) => s.trim().replace(/\s+/g, ''))
            .filter((s) => s.length >= 6);

    const sendSingleSms = (phone: string, text: string) => {
        const encoded = encodeURIComponent(text);
        window.location.href = `sms:${phone}?body=${encoded}`;
    };

    const handleSendSms = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setStatusMsg(null);

        if (!smsText.trim()) {
            setErrorMsg('SMS message is required');
            return;
        }

        let recipients: string[] = [];
        if (selectedBatch) {
            recipients = selectedBatch.phones;
        } else {
            recipients = parsePhones(smsTo);
        }

        if (recipients.length === 0) {
            setErrorMsg('Add at least one phone number or select an SMS batch');
            return;
        }

        setSendingSms(true);
        try {
            if (recipients.length === 1) {
                sendSingleSms(recipients[0], smsText);
            } else {
                const ok = confirm(
                    `Send SMS to ${recipients.length} recipients? This opens your SMS app for each recipient.`
                );
                if (!ok) return;
                recipients.forEach((phone, idx) => {
                    setTimeout(() => sendSingleSms(phone, smsText), idx * 900);
                });
            }
            setStatusMsg(`SMS dispatch started for ${recipients.length} recipient(s).`);
        } finally {
            setSendingSms(false);
        }
    };

    if (authorized === null) {
        return <div className="p-10 text-center">Checking permissions…</div>;
    }
    if (!authorized) {
        return (
            <AuthGate
                variant="forbidden"
                title="Access denied"
                message="You need manage-users permission to send team SMS."
                actionLabel="Back to Dashboard"
                actionHref="/dashboard"
            />
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-100 px-4 lg:px-8 py-4 flex items-center gap-3 sticky top-0 z-30">
                <DashboardMobileMenuButton />
                <div className="flex-1">
                    <h1 className="text-xl lg:text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <MessageSquare className="w-6 h-6 text-[#22C55E]" />
                        Team SMS
                    </h1>
                    <p className="text-sm text-gray-500">
                        Org/event batches of 99 recipients
                        {brandingTitle ? ` · ${brandingTitle}` : ''}
                    </p>
                </div>
                <Link
                    href="/messages"
                    className="text-sm font-medium text-[#22C55E] hover:underline flex items-center gap-1"
                >
                    <Users className="w-4 h-4" />
                    Team email
                </Link>
            </header>

            <div className="p-4 lg:p-8 max-w-3xl">
                <form
                    onSubmit={handleSendSms}
                    className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4 shadow-sm"
                >
                    <h2 className="text-lg font-semibold text-gray-900">SMS batch send</h2>

                    {errorMsg && (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                            {errorMsg}
                        </p>
                    )}
                    {statusMsg && (
                        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                            {statusMsg}
                        </p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="event">Event</Label>
                            <select
                                id="event"
                                value={eventId}
                                onChange={(e) => setEventId(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                            >
                                <option value="">Organization default</option>
                                {events.map((ev) => (
                                    <option key={ev.id} value={ev.id}>
                                        {ev.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sms-batch">SMS batch (99 each)</Label>
                            <select
                                id="sms-batch"
                                value={smsBatchNumber}
                                onChange={(e) => setSmsBatchNumber(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                            >
                                <option value="">Manual phone list</option>
                                {smsBatches.map((b) => (
                                    <option key={b.batchNumber} value={String(b.batchNumber)}>
                                        {b.label} - {b.count} recipients
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="sms-to">To (phone numbers)</Label>
                        <textarea
                            id="sms-to"
                            value={smsTo}
                            onChange={(e) => setSmsTo(e.target.value)}
                            rows={2}
                            disabled={Boolean(selectedBatch)}
                            className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm font-mono"
                            placeholder="2519..., one per line or comma separated"
                        />
                        <p className="text-xs text-gray-500">
                            {selectedBatch
                                ? `Batch ${selectedBatch.batchNumber} selected: sends only to this batch.`
                                : 'Use manual phone list when no batch is selected.'}
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="sms-text">Text</Label>
                        <textarea
                            id="sms-text"
                            value={smsText}
                            onChange={(e) => setSmsText(e.target.value)}
                            rows={6}
                            required
                            className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                            placeholder="Write your SMS message"
                        />
                    </div>

                    <Button
                        type="submit"
                        disabled={sendingSms || loading}
                        className="bg-slate-700 hover:bg-slate-900 text-white w-full sm:w-auto"
                    >
                        {sendingSms ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Sending SMS…
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4 mr-2" />
                                Send SMS
                            </>
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
}
