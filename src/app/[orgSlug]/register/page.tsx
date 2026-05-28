'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Calendar, ChevronRight } from 'lucide-react';

type EventRow = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    startsAt: string | null;
    endsAt: string | null;
};

export default function OrgRegisterHubPage() {
    const params = useParams();
    const orgSlug = params.orgSlug as string;
    const [orgName, setOrgName] = useState<string>('');
    const [events, setEvents] = useState<EventRow[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/public/orgs/${encodeURIComponent(orgSlug)}/events`)
            .then((r) => {
                if (!r.ok) throw new Error('Not found');
                return r.json();
            })
            .then((d) => {
                setOrgName(d.organization?.name || orgSlug);
                setEvents(d.events || []);
            })
            .catch(() => setError('Organization not found or has no public events.'))
            .finally(() => setLoading(false));
    }, [orgSlug]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
                Loading…
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <p className="text-red-600 text-center max-w-md">{error}</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4">
            <div className="max-w-lg mx-auto">
                <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">{orgName}</h1>
                <p className="text-center text-gray-500 text-sm mb-2">Choose an event to register</p>
                <p className="text-center text-sm mb-8">
                    <a
                        href={`/${orgSlug}/landing`}
                        className="text-[#22C55E] font-medium hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        View organization landing page
                    </a>
                </p>
                {events.length === 0 ? (
                    <p className="text-center text-gray-600">No open registrations right now.</p>
                ) : (
                    <ul className="space-y-3">
                        {events.map((e) => (
                            <li key={e.id}>
                                <Link
                                    href={`/${orgSlug}/${e.slug}/register`}
                                    className="flex items-center justify-between gap-3 border border-gray-100 rounded-2xl p-4 bg-white shadow-sm hover:border-[#22C55E] hover:shadow transition"
                                >
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className="mt-0.5 text-[#22C55E]">
                                            <Calendar className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-gray-900 truncate">{e.name}</p>
                                            {e.description && (
                                                <p className="text-sm text-gray-500 line-clamp-2">{e.description}</p>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
