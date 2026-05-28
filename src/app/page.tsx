'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { translations, type Language } from '@/app/translations';
import { PlatformMarketingHome } from '@/components/marketing/PlatformMarketingHome';

function HomeContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [language, setLanguage] = useState<Language>('en');

    useEffect(() => {
        const langParam = searchParams.get('lang');
        if (langParam && ['en', 'am', 'or', 'ti'].includes(langParam)) {
            setLanguage(langParam as Language);
        }
    }, [searchParams]);

    const t = translations[language];

    const handleSetLanguage = (lang: Language) => {
        setLanguage(lang);
        const params = new URLSearchParams(searchParams.toString());
        params.set('lang', lang);
        router.replace(`?${params.toString()}`, { scroll: false });
    };

    return <PlatformMarketingHome language={language} t={t} setLanguage={handleSetLanguage} />;
}

export default function HomePage() {
    return (
        <Suspense
            fallback={<div className="min-h-screen bg-[#06030f]" aria-hidden />}
        >
            <HomeContent />
        </Suspense>
    );
}
