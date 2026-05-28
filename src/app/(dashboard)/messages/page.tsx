'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { AuthGate } from '@/components/AuthGate';
import { DashboardMobileMenuButton } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';
import {
    Mail,
    Loader2,
    Send,
    Trash2,
    Users,
    FileText,
    Clock,
    Bookmark,
} from 'lucide-react';

type Member = { id: string; name: string | null; email: string; orgRole: string };
type EventRow = { id: string; name: string; slug: string };
type TemplateRow = {
    id: string;
    title: string;
    subject: string;
    cc: string;
    bodyText: string;
    eventId: string | null;
    updatedAt: string;
};
type SentRow = {
    id: string;
    title: string;
    subject: string;
    toEmails: string[];
    ccEmails: string[];
    bodyText: string;
    eventId: string | null;
    recipientCount: number;
    createdAt: string;
};
type BatchRow = { batchNumber: number; count: number; label: string };
type SmsBatchRow = { batchNumber: number; count: number; label: string; phones: string[] };

function MessagesContent() {
    const searchParams = useSearchParams();
    const preselected = useMemo(() => {
        const raw = searchParams.get('userIds') || '';
        return raw.split(',').map((s) => s.trim()).filter(Boolean);
    }, [searchParams]);

    const { data: session } = authClient.useSession();
    const [authorized, setAuthorized] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);
    const [events, setEvents] = useState<EventRow[]>([]);
    const [templates, setTemplates] = useState<TemplateRow[]>([]);
    const [sent, setSent] = useState<SentRow[]>([]);
    const [batches, setBatches] = useState<BatchRow[]>([]);
    const [smsBatches, setSmsBatches] = useState<SmsBatchRow[]>([]);
    const [brandingTitle, setBrandingTitle] = useState('');

    const [eventId, setEventId] = useState('');
    const [title, setTitle] = useState('');
    const [subject, setSubject] = useState('');
    const [to, setTo] = useState('');
    const [cc, setCc] = useState('');
    const [bodyText, setBodyText] = useState('');
    const [saveAsTemplate, setSaveAsTemplate] = useState(false);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [selectedBatchNumber, setSelectedBatchNumber] = useState('');
    const [smsTo, setSmsTo] = useState('');
    const [smsText, setSmsText] = useState('');
    const [smsBatchNumber, setSmsBatchNumber] = useState('');
    const [sendingSms, setSendingSms] = useState(false);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [sidebarTab, setSidebarTab] = useState<'templates' | 'sent'>('templates');

    useEffect(() => {
        if (preselected.length > 0) {
            setSelectedUserIds(preselected);
        }
    }, [preselected]);

    useEffect(() => {
        if (!session?.user) return;
        const u = session.user as {
            permissions?: string[];
            legacyRole?: string;
            role?: string;
            orgRole?: string | null;
            orgPermissions?: string[];
            isPlatformSuperAdmin?: boolean;
        };
        const plat = hasPlatformElevatedAccess(u.isPlatformSuperAdmin, u.legacyRole ?? u.role);
        const orgRole = u.orgRole;
        const orgPerms = u.orgPermissions || [];
        const can =
            plat ||
            orgRole === 'OWNER' ||
            orgRole === 'ADMIN' ||
            orgPerms.includes('manage_users');
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
                setMembers(d.members || []);
                setEvents(d.events || []);
                setTemplates(d.templates || []);
                setSent(d.sent || []);
                setBatches(d.registrationEmailBatches || []);
                setSmsBatches(d.registrationSmsBatches || []);
                setBrandingTitle(d.branding?.eventTitle || d.organization?.name || '');
                if (d.effectiveEventId && d.effectiveEventId !== eventId) {
                    setEventId(d.effectiveEventId);
                } else if (!eventId && d.events?.[0]?.id) {
                    setEventId(d.events[0].id);
                }
            })
            .catch(() => setErrorMsg('Could not load email data'))
            .finally(() => setLoading(false));
    }, [eventId]);

    useEffect(() => {
        if (authorized) load();
    }, [authorized, load]);

    const applyCompose = (row: {
        title: string;
        subject: string;
        cc?: string;
        bodyText: string;
        eventId?: string | null;
        toEmails?: string[];
    }) => {
        setTitle(row.title);
        setSubject(row.subject);
        setCc(row.cc || '');
        setBodyText(row.bodyText);
        if (row.eventId) setEventId(row.eventId);
        if (row.toEmails?.length) {
            setTo(row.toEmails.join(', '));
        }
        setErrorMsg(null);
        setStatusMsg('Loaded into compose form');
    };

    const toggleMember = (id: string) => {
        setSelectedUserIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const addSelectedEmailsToTo = () => {
        const emails = members
            .filter((m) => selectedUserIds.includes(m.id))
            .map((m) => m.email)
            .filter(Boolean);
        if (emails.length === 0) return;
        const existing = to
            .split(/[,;\n]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        const merged = [...new Set([...existing, ...emails])];
        setTo(merged.join(', '));
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        setErrorMsg(null);
        setStatusMsg(null);
        try {
            const res = await fetch('/api/org-emails/send', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    subject,
                    to,
                    cc,
                    bodyText,
                    eventId: eventId || null,
                    userIds: selectedUserIds,
                    batchNumber: selectedBatchNumber ? Number(selectedBatchNumber) : null,
                    saveAsTemplate,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setErrorMsg((data as { error?: string }).error || 'Send failed');
                return;
            }
            setStatusMsg((data as { message?: string }).message || 'Email sent');
            if ((data as { failed?: unknown[] }).failed?.length) {
                setErrorMsg(
                    `Some failed: ${JSON.stringify((data as { failed: { email: string; error: string }[] }).failed)}`
                );
            }
            load();
        } catch {
            setErrorMsg('Send failed');
        } finally {
            setSending(false);
        }
    };

    const deleteTemplate = async (id: string) => {
        if (!confirm('Delete this saved template?')) return;
        await fetch(`/api/org-emails/templates/${id}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        load();
    };

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
        if (smsBatchNumber) {
            const batch = smsBatches.find((b) => String(b.batchNumber) === smsBatchNumber);
            if (!batch) {
                setErrorMsg(`Batch ${smsBatchNumber} not found`);
                return;
            }
            recipients = batch.phones;
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
                message="You need manage-users permission to send team emails."
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
                        <Mail className="w-6 h-6 text-[#22C55E]" />
                        Team email
                    </h1>
                    <p className="text-sm text-gray-500">
                        Branded with active org / event settings
                        {brandingTitle ? ` · ${brandingTitle}` : ''}
                    </p>
                </div>
                <Link
                    href="/users"
                    className="text-sm font-medium text-[#22C55E] hover:underline flex items-center gap-1"
                >
                    <Users className="w-4 h-4" />
                    User management
                </Link>
            </header>

            <div className="p-4 lg:p-8 grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                    <form
                        onSubmit={handleSend}
                        className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4 shadow-sm"
                    >
                        <h2 className="text-lg font-semibold text-gray-900">Compose</h2>

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
                                <Label htmlFor="event">Event (branding)</Label>
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
                                <Label htmlFor="section-title">Section title</Label>
                                <Input
                                    id="section-title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Team update"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="subject">Subject</Label>
                            <Input
                                id="subject"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="to">To</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label htmlFor="batch">Recipient batch (99 each)</Label>
                                    <select
                                        id="batch"
                                        value={selectedBatchNumber}
                                        onChange={(e) => setSelectedBatchNumber(e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                                    >
                                        <option value="">Manual / selected users</option>
                                        {batches.map((b) => (
                                            <option key={b.batchNumber} value={String(b.batchNumber)}>
                                                {b.label} - {b.count} recipients
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <textarea
                                id="to"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                                rows={2}
                                className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm font-mono"
                                placeholder="email@example.com, or one per line"
                                disabled={Boolean(selectedBatchNumber)}
                            />
                            <p className="text-xs text-gray-500">
                                {selectedBatchNumber
                                    ? `Batch ${selectedBatchNumber} is selected. Email will send only to that batch recipients.`
                                    : `Selected members (${selectedUserIds.length}) are included automatically. Use the button below to copy their emails into To.`}
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addSelectedEmailsToTo}
                                disabled={selectedUserIds.length === 0 || Boolean(selectedBatchNumber)}
                            >
                                Add selected emails to To
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="cc">CC</Label>
                            <Input
                                id="cc"
                                value={cc}
                                onChange={(e) => setCc(e.target.value)}
                                placeholder="Optional, comma-separated"
                                className="font-mono text-sm"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="body">Message</Label>
                            <textarea
                                id="body"
                                value={bodyText}
                                onChange={(e) => setBodyText(e.target.value)}
                                rows={8}
                                required
                                className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                                placeholder="Write your message…"
                            />
                        </div>

                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input
                                type="checkbox"
                                checked={saveAsTemplate}
                                onChange={(e) => setSaveAsTemplate(e.target.checked)}
                                className="accent-[#22C55E]"
                            />
                            Save as template for reuse
                        </label>

                        <Button
                            type="submit"
                            disabled={sending}
                            className="bg-[#22C55E] hover:bg-[#1DAE50] text-white w-full sm:w-auto"
                        >
                            {sending ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    Sending…
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4 mr-2" />
                                    Send email
                                </>
                            )}
                        </Button>
                    </form>

                    <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">Recipients</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            {selectedBatchNumber
                                ? `Recipient list is locked because batch ${selectedBatchNumber} is selected.`
                                : 'Select team members to include (in addition to any addresses in To).'}
                        </p>
                        {loading ? (
                            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        ) : (
                            <ul className="max-h-64 overflow-y-auto space-y-2">
                                {members.map((m) => (
                                    <li
                                        key={m.id}
                                        className="flex items-center gap-3 border border-gray-50 rounded-lg px-3 py-2"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedUserIds.includes(m.id)}
                                            onChange={() => toggleMember(m.id)}
                                            className="accent-[#22C55E] w-4 h-4"
                                            disabled={Boolean(selectedBatchNumber)}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-gray-900 truncate">
                                                {m.name || 'No name'}
                                            </p>
                                            <p className="text-xs text-gray-500 font-mono truncate">
                                                {m.email}
                                            </p>
                                        </div>
                                        <span className="text-xs text-gray-400">{m.orgRole}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <form
                        onSubmit={handleSendSms}
                        className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4 shadow-sm"
                    >
                        <h2 className="text-lg font-semibold text-gray-900">SMS compose</h2>
                        <p className="text-sm text-gray-500">
                            Use manual phone numbers or choose a 99-recipient SMS batch.
                        </p>

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

                        <div className="space-y-2">
                            <Label htmlFor="sms-to">To (phone numbers)</Label>
                            <textarea
                                id="sms-to"
                                value={smsTo}
                                onChange={(e) => setSmsTo(e.target.value)}
                                rows={2}
                                disabled={Boolean(smsBatchNumber)}
                                className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm font-mono"
                                placeholder="2519..., one per line or comma separated"
                            />
                            <p className="text-xs text-gray-500">
                                {smsBatchNumber
                                    ? `Batch ${smsBatchNumber} selected: SMS will be sent only to that batch.`
                                    : 'Manual SMS recipients'}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="sms-text">Text</Label>
                            <textarea
                                id="sms-text"
                                value={smsText}
                                onChange={(e) => setSmsText(e.target.value)}
                                rows={5}
                                required
                                className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                                placeholder="Write your SMS message"
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={sendingSms}
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

                <aside className="space-y-4">
                    <div className="flex bg-white rounded-xl border border-gray-100 p-1">
                        <button
                            type="button"
                            onClick={() => setSidebarTab('templates')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-1 ${
                                sidebarTab === 'templates'
                                    ? 'bg-[#F0FDF4] text-[#22C55E]'
                                    : 'text-gray-500'
                            }`}
                        >
                            <Bookmark className="w-4 h-4" />
                            Templates
                        </button>
                        <button
                            type="button"
                            onClick={() => setSidebarTab('sent')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-1 ${
                                sidebarTab === 'sent'
                                    ? 'bg-[#F0FDF4] text-[#22C55E]'
                                    : 'text-gray-500'
                            }`}
                        >
                            <Clock className="w-4 h-4" />
                            Sent
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm max-h-[70vh] overflow-y-auto">
                        {sidebarTab === 'templates' ? (
                            templates.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-8">
                                    No saved templates yet. Check &quot;Save as template&quot; when sending.
                                </p>
                            ) : (
                                <ul className="space-y-3">
                                    {templates.map((t) => (
                                        <li
                                            key={t.id}
                                            className="border border-gray-100 rounded-xl p-3 hover:border-[#22C55E]/30"
                                        >
                                            <p className="font-semibold text-gray-900 text-sm">{t.title}</p>
                                            <p className="text-xs text-gray-500 truncate">{t.subject}</p>
                                            <div className="flex gap-2 mt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => applyCompose(t)}
                                                    className="text-xs font-bold text-[#22C55E] hover:underline"
                                                >
                                                    Use
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => deleteTemplate(t.id)}
                                                    className="text-xs text-red-500 hover:underline flex items-center gap-0.5"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                    Delete
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )
                        ) : sent.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-8">No sent emails yet.</p>
                        ) : (
                            <ul className="space-y-3">
                                {sent.map((s) => (
                                    <li
                                        key={s.id}
                                        className="border border-gray-100 rounded-xl p-3 hover:border-[#22C55E]/30"
                                    >
                                        <p className="font-semibold text-gray-900 text-sm flex items-center gap-1">
                                            <FileText className="w-3.5 h-3.5" />
                                            {s.title}
                                        </p>
                                        <p className="text-xs text-gray-500 truncate">{s.subject}</p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {s.recipientCount} recipient(s) ·{' '}
                                            {new Date(s.createdAt).toLocaleString()}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                applyCompose({
                                                    title: s.title,
                                                    subject: s.subject,
                                                    bodyText: s.bodyText,
                                                    eventId: s.eventId,
                                                    toEmails: s.toEmails,
                                                    cc: s.ccEmails.join(', '),
                                                })
                                            }
                                            className="text-xs font-bold text-[#22C55E] hover:underline mt-2"
                                        >
                                            Use as template
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}

export default function MessagesPage() {
    return (
        <Suspense
            fallback={
                <div className="p-10 flex justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-[#22C55E]" />
                </div>
            }
        >
            <MessagesContent />
        </Suspense>
    );
}
