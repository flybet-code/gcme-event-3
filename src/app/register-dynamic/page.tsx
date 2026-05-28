'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function RedirectInner() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const org =
            searchParams.get('org') ||
            (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG) ||
            'gcme';
        const event =
            searchParams.get('event') ||
            (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEFAULT_EVENT_SLUG) ||
            'church-leadership-summit';
        router.replace(`/${encodeURIComponent(org)}/${encodeURIComponent(event)}/register`);
    }, [router, searchParams]);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
            Redirecting to organization registration…
        </div>
    );
}

export default function RegisterDynamicRedirectPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">
                    Loading…
                </div>
            }
        >
            <RedirectInner />
        </Suspense>
    );
}
