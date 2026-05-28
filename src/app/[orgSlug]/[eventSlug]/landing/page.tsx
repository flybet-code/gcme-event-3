'use client';

import { redirect, useParams } from 'next/navigation';
import { useEffect } from 'react';

export default function EventLandingRedirect() {
    const params = useParams();
    const orgSlug = params.orgSlug as string;
    const eventSlug = params.eventSlug as string;

    useEffect(() => {
        redirect(`/${orgSlug}/${eventSlug}`);
    }, [orgSlug, eventSlug]);

    return null;
}
