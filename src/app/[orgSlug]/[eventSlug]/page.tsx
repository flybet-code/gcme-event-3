'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { DynamicRegistrationLanding } from '@/components/landing/DynamicRegistrationLanding';

function EventLandingContent() {
    const params = useParams();
    const orgSlug = params.orgSlug as string;
    const eventSlug = params.eventSlug as string;
    return <DynamicRegistrationLanding orgSlug={orgSlug} eventSlug={eventSlug} />;
}

export default function EventLandingPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-white" />}>
            <EventLandingContent />
        </Suspense>
    );
}
