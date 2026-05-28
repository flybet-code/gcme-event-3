'use client';

import { useParams } from 'next/navigation';
import { OrgEventRegistration } from '@/components/forms/OrgEventRegistration';

export default function OrgEventPublicRegisterPage() {
    const params = useParams();
    const orgSlug = params.orgSlug as string;
    const eventSlug = params.eventSlug as string;

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4">
            <OrgEventRegistration orgSlug={orgSlug} eventSlug={eventSlug} variant="public" />
        </div>
    );
}
