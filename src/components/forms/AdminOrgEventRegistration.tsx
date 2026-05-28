'use client';

import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { OrgEventRegistration } from '@/components/forms/OrgEventRegistration';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

type EventOption = { slug: string; name: string };

export function AdminOrgEventRegistration() {
    const { data: session, isPending } = authClient.useSession();
    const orgSlug = (session?.user as { activeOrganizationSlug?: string | null })?.activeOrganizationSlug ?? null;

    const [events, setEvents] = useState<EventOption[]>([]);
    const [eventSlug, setEventSlug] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        if (!orgSlug) {
            setLoading(false);
            return;
        }
        setLoadError(null);
        fetch(`/api/events?orgSlug=${encodeURIComponent(orgSlug)}`, { credentials: 'include' })
            .then((r) => {
                if (!r.ok) throw new Error('Failed to load events');
                return r.json();
            })
            .then((d) => {
                const withForm = (d.events || []).filter(
                    (e: { registrationForm: unknown }) => Boolean(e.registrationForm)
                ) as { slug: string; name: string }[];
                setEvents(withForm.map((e) => ({ slug: e.slug, name: e.name })));
                const def = process.env.NEXT_PUBLIC_DEFAULT_EVENT_SLUG;
                const pick = withForm.find((e) => e.slug === def) || withForm[0];
                if (pick) setEventSlug(pick.slug);
            })
            .catch(() => setLoadError('Could not load events for this organization.'))
            .finally(() => setLoading(false));
    }, [orgSlug]);

    if (isPending || loading) {
        return (
            <div className="flex items-center justify-center gap-2 text-gray-500 py-12">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading registration…
            </div>
        );
    }

    if (!session?.user) {
        return <p className="text-center text-gray-600">Sign in to register participants.</p>;
    }

    if (!orgSlug) {
        return (
            <p className="text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm">
                Choose an active organization in Settings or the sidebar switcher, then return here.
            </p>
        );
    }

    if (loadError) {
        return <p className="text-red-600 text-center">{loadError}</p>;
    }

    if (events.length === 0) {
        return (
            <p className="text-gray-600 text-center max-w-md mx-auto">
                No event with a registration form in this organization. Create an event under Events and attach a
                registration form.
            </p>
        );
    }

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const publicUrl = `${baseUrl}/${orgSlug}/${eventSlug}/register`;

    return (
        <div className="space-y-6">
            {events.length > 1 && (
                <div className="space-y-2 max-w-md mx-auto">
                    <Label>Event</Label>
                    <Select value={eventSlug} onValueChange={setEventSlug}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select event" />
                        </SelectTrigger>
                        <SelectContent>
                            {events.map((e) => (
                                <SelectItem key={e.slug} value={e.slug}>
                                    {e.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
            {eventSlug && (
                <>
                    <p className="text-xs text-center text-gray-500 max-w-xl mx-auto">
                        Public link for this event:{' '}
                        <a href={publicUrl} className="text-[#22C55E] font-medium break-all">
                            {publicUrl}
                        </a>
                    </p>
                    <OrgEventRegistration orgSlug={orgSlug} eventSlug={eventSlug} variant="admin" />
                </>
            )}
        </div>
    );
}
