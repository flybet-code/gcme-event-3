'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { AuthGate } from '@/components/AuthGate';

export default function OrgRegistrationsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const orgSlug = params.orgSlug as string;
    const formId = searchParams.get('formId');
    const { data: session, isPending } = authClient.useSession();
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    const [rows, setRows] = useState<{ id: string; responses: object; createdAt: string }[]>([]);

    useEffect(() => {
        if (!session?.user || !formId) return;
        fetch(`/api/forms/${formId}/responses?orgSlug=${encodeURIComponent(orgSlug)}`)
            .then((r) => r.json())
            .then((d) => {
                if (d.responses) setRows(d.responses);
            });
    }, [sessionUserId, orgSlug, formId]);

    if (!isPending && !session) {
        return <AuthGate variant="login" />;
    }

    if (!formId) {
        return (
            <div className="p-8">
                <p className="text-gray-600">Pass <code className="bg-gray-100 px-1 rounded">?formId=...</code> from Forms.</p>
            </div>
        );
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Form responses</h1>
            <ul className="space-y-2">
                {rows.map((r) => (
                    <li key={r.id} className="border rounded-xl p-4 bg-white text-sm overflow-x-auto">
                        <pre className="text-xs">{JSON.stringify(r.responses, null, 2)}</pre>
                    </li>
                ))}
            </ul>
        </div>
    );
}
