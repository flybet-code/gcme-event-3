'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

type OrgRow = { id: string; name: string; slug: string };
type EventRow = { id: string; name: string; slug: string; endsAt: string | null };
type CampaignRow = {
    id: string;
    organizationId: string;
    organizationName: string;
    eventId: string | null;
    eventName: string | null;
    eventEndsAt: string | null;
    isActive: boolean;
    autoShowOnLogin: boolean;
    requireEventEnded: boolean;
    visibleFrom: string | null;
    visibleUntil: string | null;
    title: string | null;
    statusLabel: string;
};

export function PlatformFeedbackCampaignsAdmin() {
    const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
    const [orgs, setOrgs] = useState<OrgRow[]>([]);
    const [events, setEvents] = useState<EventRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const [organizationId, setOrganizationId] = useState('');
    const [eventId, setEventId] = useState('');
    const [title, setTitle] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [requireEventEnded, setRequireEventEnded] = useState(true);
    const [visibleFrom, setVisibleFrom] = useState('');
    const [visibleUntil, setVisibleUntil] = useState('');

    const loadCampaigns = useCallback(async () => {
        const res = await fetch('/api/platform-feedback/campaigns', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load campaigns');
        setCampaigns(data.data ?? []);
    }, []);

    const loadOrgs = useCallback(async () => {
        const res = await fetch('/api/orgs', { credentials: 'include' });
        const data = await res.json();
        if (res.ok && data.organizations) {
            setOrgs(
                data.organizations.map((o: { id: string; name: string; slug: string }) => ({
                    id: o.id,
                    name: o.name,
                    slug: o.slug,
                }))
            );
        }
    }, []);

    useEffect(() => {
        setLoading(true);
        Promise.all([loadCampaigns(), loadOrgs()])
            .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
            .finally(() => setLoading(false));
    }, [loadCampaigns, loadOrgs]);

    useEffect(() => {
        if (!organizationId) {
            setEvents([]);
            setEventId('');
            return;
        }
        const org = orgs.find((o) => o.id === organizationId);
        if (!org) return;
        fetch(`/api/events?orgSlug=${encodeURIComponent(org.slug)}`, { credentials: 'include' })
            .then((r) => r.json())
            .then((d) => {
                if (d.events) {
                    setEvents(
                        d.events.map((e: EventRow) => ({
                            id: e.id,
                            name: e.name,
                            slug: e.slug,
                            endsAt: e.endsAt,
                        }))
                    );
                }
            })
            .catch(() => setEvents([]));
    }, [organizationId, orgs]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!organizationId) {
            setError('Select an organization');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/platform-feedback/campaigns', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organizationId,
                    eventId: eventId || null,
                    title: title.trim() || null,
                    isActive,
                    autoShowOnLogin: true,
                    requireEventEnded,
                    visibleFrom: visibleFrom || null,
                    visibleUntil: visibleUntil || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create');
            await loadCampaigns();
            setTitle('');
            setEventId('');
            setVisibleFrom('');
            setVisibleUntil('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create campaign');
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (c: CampaignRow) => {
        try {
            const res = await fetch(`/api/platform-feedback/campaigns/${c.id}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !c.isActive }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Update failed');
            }
            await loadCampaigns();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Update failed');
        }
    };

    const removeCampaign = async (id: string) => {
        if (!confirm('Delete this feedback campaign?')) return;
        try {
            const res = await fetch(`/api/platform-feedback/campaigns/${id}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Delete failed');
            await loadCampaigns();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Delete failed');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-[#22C55E]" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="bg-white rounded-3xl border border-slate-100 p-6 lg:p-8 shadow-sm">
                <h2 className="text-lg font-black text-slate-900 mb-1">Schedule feedback popup</h2>
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                    Link a popup to an organization or a specific event. While an event is still running, users will
                    not see the popup if &quot;Wait until event ends&quot; is enabled. After the event ends (or when you
                    set a start date), members see the popup once per login until they submit feedback.
                </p>

                <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                            Organization
                        </label>
                        <select
                            required
                            value={organizationId}
                            onChange={(e) => setOrganizationId(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm"
                        >
                            <option value="">Select organization…</option>
                            {orgs.map((o) => (
                                <option key={o.id} value={o.id}>
                                    {o.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                            Event (optional)
                        </label>
                        <select
                            value={eventId}
                            onChange={(e) => setEventId(e.target.value)}
                            disabled={!organizationId}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm disabled:opacity-50"
                        >
                            <option value="">All org members (no specific event)</option>
                            {events.map((ev) => (
                                <option key={ev.id} value={ev.id}>
                                    {ev.name}
                                    {ev.endsAt
                                        ? ` · ends ${new Date(ev.endsAt).toLocaleDateString()}`
                                        : ' · no end date'}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                            Popup title (optional)
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Summit 2025 feedback"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                            Show from (optional)
                        </label>
                        <input
                            type="datetime-local"
                            value={visibleFrom}
                            onChange={(e) => setVisibleFrom(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                            Show until (optional)
                        </label>
                        <input
                            type="datetime-local"
                            value={visibleUntil}
                            onChange={(e) => setVisibleUntil(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm"
                        />
                    </div>
                    <div className="md:col-span-2 flex flex-wrap gap-6 items-center">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={requireEventEnded}
                                onChange={(e) => setRequireEventEnded(e.target.checked)}
                                disabled={!eventId}
                                className="rounded border-slate-300 text-[#22C55E]"
                            />
                            <span className="text-sm font-bold text-slate-700">
                                Wait until event ends before showing popup
                            </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                                className="rounded border-slate-300 text-[#22C55E]"
                            />
                            <span className="text-sm font-bold text-slate-700">Active immediately</span>
                        </label>
                    </div>
                    {error && (
                        <p className="md:col-span-2 text-sm text-red-600 font-medium" role="alert">
                            {error}
                        </p>
                    )}
                    <div className="md:col-span-2">
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-[#22C55E] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
                        >
                            {saving ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Plus className="w-5 h-5" />
                            )}
                            Create campaign
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100">
                    <h3 className="font-black text-slate-900">Active & scheduled campaigns</h3>
                </div>
                {campaigns.length === 0 ? (
                    <p className="p-8 text-center text-slate-500 text-sm">No campaigns yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-100">
                                    <th className="px-5 py-3 font-bold text-slate-600">Org / Event</th>
                                    <th className="px-5 py-3 font-bold text-slate-600">Status</th>
                                    <th className="px-5 py-3 font-bold text-slate-600">Schedule</th>
                                    <th className="px-5 py-3 font-bold text-slate-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {campaigns.map((c) => (
                                    <tr key={c.id} className="border-b border-slate-50">
                                        <td className="px-5 py-4">
                                            <div className="font-bold text-slate-900">{c.organizationName}</div>
                                            <div className="text-slate-500 text-xs">
                                                {c.eventName || 'Organization-wide'}
                                            </div>
                                            {c.title && (
                                                <div className="text-xs text-slate-400 mt-0.5">{c.title}</div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span
                                                className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                                                    c.statusLabel.startsWith('Live')
                                                        ? 'bg-[#F0FDF4] text-[#16A34A]'
                                                        : c.statusLabel.startsWith('Waiting')
                                                          ? 'bg-amber-50 text-amber-700'
                                                          : 'bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                {c.statusLabel}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-xs text-slate-500">
                                            {c.visibleFrom
                                                ? `From ${new Date(c.visibleFrom).toLocaleString()}`
                                                : 'No start'}
                                            <br />
                                            {c.visibleUntil
                                                ? `Until ${new Date(c.visibleUntil).toLocaleString()}`
                                                : 'No end'}
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleActive(c)}
                                                    className="p-2 rounded-lg hover:bg-slate-50 text-slate-600"
                                                    title={c.isActive ? 'Deactivate' : 'Activate'}
                                                >
                                                    {c.isActive ? (
                                                        <ToggleRight className="w-6 h-6 text-[#22C55E]" />
                                                    ) : (
                                                        <ToggleLeft className="w-6 h-6" />
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => removeCampaign(c.id)}
                                                    className="p-2 rounded-lg hover:bg-red-50 text-red-500"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
