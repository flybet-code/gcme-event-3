'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
    const { data: session, isPending } = authClient.useSession();
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    const router = useRouter();

    useEffect(() => {
        if (!isPending && session) {
            router.replace('/dashboard');
        }
    }, [isPending, sessionUserId, router]);

    return (
        <main
            className="relative min-h-screen bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('https://static.vecteezy.com/system/resources/thumbnails/041/388/388/small/ai-generated-concert-crowd-enjoying-live-music-event-photo.jpg')" }}
        >
            <div className="absolute inset-0 bg-black/20" />
            <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
                <LoginForm />
            </div>
        </main>
    );
}
