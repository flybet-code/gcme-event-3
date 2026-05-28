'use client';

import React from 'react';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardAuthGuard({ children }: { children: React.ReactNode }) {
    const { data: session, isPending } = authClient.useSession();
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    const router = useRouter();

    useEffect(() => {
        if (!isPending && !session) {
            router.replace('/login');
        }
    }, [isPending, sessionUserId, router]);

    if (isPending) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#22C55E]"></div>
            </div>
        );
    }

    if (!session) return null;

    // Role-based access can be added here if needed in the future
    // For now, any authenticated user can access the dashboard base

    return (
        <div key={session?.user?.id}>
            {children}
        </div>
    );
}
