'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { DynamicRegistrationLanding } from '@/components/landing/DynamicRegistrationLanding';

function LandingContent() {
    const params = useParams();
    const orgSlug = params.orgSlug as string;
    return <DynamicRegistrationLanding orgSlug={orgSlug} />;
}

export default function OrgLandingPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-white" />}>
            <LandingContent />
        </Suspense>
    );
}
