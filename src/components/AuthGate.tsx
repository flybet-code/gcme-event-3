'use client';

import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

type AuthGateVariant = 'login' | 'forbidden';

interface AuthGateProps {
    variant?: AuthGateVariant;
    title?: string;
    message?: string;
    actionLabel?: string;
    actionHref?: string;
}

export function AuthGate({
    variant = 'login',
    title = variant === 'login' ? 'Login required' : 'Access denied',
    message = variant === 'login'
        ? 'Please log in to access this page.'
        : 'You do not have permission to access this page.',
    actionLabel = variant === 'login' ? 'Go to Login' : 'Back to Dashboard',
    actionHref = variant === 'login' ? '/login' : '/dashboard',
}: AuthGateProps) {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-gray-100">
                <AlertCircle className={`w-16 h-16 mx-auto mb-4 ${variant === 'login' ? 'text-amber-500' : 'text-red-500'}`} />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
                <p className="text-gray-500 mb-6">{message}</p>
                <Link
                    href={actionHref}
                    className="inline-block bg-[#22C55E] hover:bg-[#1DAE50] text-white px-8 py-3 rounded-xl font-bold transition"
                >
                    {actionLabel}
                </Link>
            </div>
        </div>
    );
}
