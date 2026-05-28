'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, Variants } from 'framer-motion';
import { Manrope, Space_Grotesk } from 'next/font/google';
import { Globe } from 'lucide-react';
import { translations, type Language } from '@/app/translations';
import type { PublicLandingPayload } from '@/lib/landing-page-config';
import { formatEventMetaLine, pickLandingText } from '@/lib/landing-page-config';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

/** First word: teal accent (reference “LEAD …” style). Remaining headline: dark navy. */
const HEADLINE_FIRST_WORD_CLASS = 'text-[#3BB2B8]';
const HEADLINE_REST_CLASS = 'text-[#121926]';

function splitHeadlineFirstWord(headline: string): {
    firstWord: string;
    restFirstLine: string;
    otherLines: string[];
} {
    const trimmed = headline.trim();
    if (!trimmed) {
        return { firstWord: '', restFirstLine: '', otherLines: [] };
    }
    const rawLines = headline
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    const lines = rawLines.length ? rawLines : [trimmed];
    const firstLine = lines[0];
    const otherLines = lines.slice(1);
    const m = firstLine.match(/^(\S+)([\s\S]*)$/);
    const firstWord = m?.[1] ?? firstLine;
    const restFirstLine = (m?.[2] ?? '').trimStart();
    return { firstWord, restFirstLine, otherLines };
}

type Props = {
    orgSlug: string;
    eventSlug?: string;
};

/** Same shell as `src/app/page.tsx` — only strings/URLs come from the API */
type ReplicaContent = {
    logoUrl: string;
    metaLine: string;
    headline: string;
    description: string;
    quoteSource: string;
    quoteText: string;
    heroImage: string;
    panelColor: string;
    poweredBy: { logoUrl: string; label: string; url: string };
    registerHref: string;
};

interface InnerProps {
    language: Language;
    t: (typeof translations)['en'];
    setLanguage?: (lang: Language) => void;
    c: ReplicaContent;
}

function LinkButton({ language, t, c }: InnerProps) {
    return (
        <Link href={c.registerHref}>
            <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-[#00b0b9] h-[64px] overflow-hidden relative shadow-[0px_10px_15px_-3px_rgba(0,176,185,0.2),0px_4px_6px_-4px_rgba(0,176,185,0.2)] shrink-0 w-[210px] cursor-pointer hover:bg-[#009aa3] transition-colors"
                data-name="Link → Button"
            >
                <div className="absolute flex flex-col font-manrope font-bold justify-center leading-[0] left-1/2 text-[20px] text-center text-nowrap text-white top-1/2 tracking-[1px] translate-x-[-50%] translate-y-[-50%] uppercase">
                    <p className="leading-[28px]">{t.registerNow}</p>
                </div>
            </motion.div>
        </Link>
    );
}

function Container({ language, t, setLanguage, c }: InnerProps) {
    const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="absolute z-50 content-stretch flex items-center justify-between left-0 right-0 py-[32px] px-[4%] lg:px-[80px] top-0 max-w-[1512px] mx-auto w-full"
            data-name="Container"
        >
            <div className="h-[48px] relative shrink-0 w-[193px]" data-name="Logo">
                <img
                    alt=""
                    className="absolute inset-0 max-w-none object-contain pointer-events-none size-full"
                    src={c.logoUrl}
                />
            </div>

            <div className="flex items-center gap-6">
                <div className="relative inline-block text-left z-50">
                    <button
                        type="button"
                        onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 focus:outline-none bg-white/80 px-3 py-2 rounded-lg backdrop-blur-sm"
                    >
                        <Globe className="w-5 h-5" />
                        <span className="uppercase text-sm font-medium">{language}</span>
                    </button>
                    {isLangMenuOpen && (
                        <div className="absolute right-0 mt-3 w-44 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl ring-1 ring-black/5 focus:outline-none overflow-hidden border border-white/10 z-[100] animate-in fade-in zoom-in-95 duration-200">
                            <div className="py-2">
                                {(['en', 'am'] as Language[]).map((lang) => (
                                    <button
                                        key={lang}
                                        type="button"
                                        onClick={() => {
                                            if (setLanguage) setLanguage(lang);
                                            setIsLangMenuOpen(false);
                                        }}
                                        className={`flex w-full items-center px-4 py-3 text-sm transition-colors ${
                                            language === lang 
                                                ? 'bg-blue-50/50 text-blue-600 font-bold' 
                                                : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full mr-3 ${language === lang ? 'bg-blue-600' : 'bg-transparent'}`} />
                                        {lang === 'en' ? 'English' : 'አማርኛ'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <LinkButton language={language} t={t} c={c} />
            </div>
        </motion.div>
    );
}

function Container1({ c }: { c: ReplicaContent }) {
    // Clean up "(DAY: 22)" and similar static patterns
    // Clean up "(DAY: 22)", "(ቀን: 22)" and similar static patterns from date formatters
    const cleanMeta = c.metaLine.replace(/\s*\(\s*(DAY|ቀን|ን)\s*[:፡]?\s*\d+\s*\)/gi, '');
    const lines = cleanMeta.split(' • ');

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
            className="relative z-10 content-stretch flex gap-[12px] items-start w-full max-w-[622px]"
            data-name="Container"
        >
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: 64 }}
                transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
                className="bg-[#00b0b9] h-[2px] shrink-0 w-[64px] mt-[10px]"
                data-name="Horizontal Divider"
            />
            <div className="flex flex-col font-sans justify-center not-italic relative shrink-0 text-[#64748b] text-[13px] tracking-[2.8px] uppercase max-w-[500px] gap-2">
                {lines.map((line, i) => (
                    <p key={i} className="leading-[20px] whitespace-normal">{line.trim()}</p>
                ))}
            </div>
        </motion.div>
    );
}

function LinkButton1({ language, t, c }: InnerProps) {
    return (
        <Link href={c.registerHref}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8, ease: 'easeOut' }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-[#00b0b9] h-[64px] overflow-hidden shadow-[0px_10px_15px_-3px_rgba(0,176,185,0.2),0px_4px_6px_-4px_rgba(0,176,185,0.2)] w-[297px] cursor-pointer hover:bg-[#009aa3] transition-colors"
                data-name="Link → Button"
            >
                <div className="absolute flex flex-col font-manrope font-bold h-[22px] justify-center leading-[0] left-[calc(50%+1px)] text-[20px] text-center text-white top-1/2 tracking-[1px] translate-x-[-50%] translate-y-[-50%] uppercase w-[169.001px]">
                    <p className="leading-[28px]">{t.registerNow}</p>
                </div>
            </motion.div>
        </Link>
    );
}

function Container2Dynamic({ language, headline }: { language: Language; headline: string }) {
    const containerVariants: Variants = {
        hidden: {},
        visible: {
            transition: {
                staggerChildren: 0.2,
            },
        },
    };

    const itemVariants: Variants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: 'easeOut' } },
    };

    const { firstWord, restFirstLine, otherLines } = splitHeadlineFirstWord(headline);

    const firstLineClass =
        language === 'am'
            ? 'mb-0 text-[80px] leading-[90px]'
            : 'mb-0 text-[80px] leading-[96px]';
    const otherLineClassAm = `mb-0 text-[80px] leading-[90px] ${HEADLINE_REST_CLASS}`;
    const otherLineClassDefault = `mb-0 text-[80px] leading-[96px] ${HEADLINE_REST_CLASS}`;

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col font-space-grotesk font-bold relative shrink-0 text-[80px] tracking-[-4.8px] uppercase w-full max-w-[600px]"
            style={{ lineHeight: language === 'am' ? '90px' : '96px' }}
        >
            <motion.p variants={itemVariants} className={firstLineClass}>
                {firstWord ? (
                    <>
                        <span className={HEADLINE_FIRST_WORD_CLASS}>{firstWord}</span>
                        {restFirstLine ? (
                            <span className={HEADLINE_REST_CLASS}>
                                {restFirstLine.startsWith(' ') ? restFirstLine : ` ${restFirstLine}`}
                            </span>
                        ) : null}
                    </>
                ) : (
                    <span className={HEADLINE_REST_CLASS}>{headline}</span>
                )}
            </motion.p>
            {otherLines.map((line, idx) => (
                <motion.p
                    key={idx}
                    variants={itemVariants}
                    className={language === 'am' ? otherLineClassAm : otherLineClassDefault}
                >
                    {line}
                </motion.p>
            ))}
        </motion.div>
    );
}

function Container4({ language, t, c }: InnerProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.5, ease: 'easeOut' }}
            className="relative z-10 flex flex-col gap-[9px] items-start mt-[40px]"
            data-name="Container"
        >
            <div className="flex gap-[9px] items-center">
                <div className="flex flex-col font-manrope font-bold justify-center leading-[0] relative shrink-0 text-[18px] text-black text-center text-nowrap tracking-[0.45px] uppercase">
                    <p className="leading-[28px]">{c.poweredBy.label || t.poweredByLabel}</p>
                </div>
                <div className="h-[32px] relative shrink-0 w-[85px]" data-name="Powered logo">
                    <img
                        alt=""
                        className="absolute inset-0 max-w-none object-contain pointer-events-none size-full"
                        src={c.poweredBy.logoUrl}
                    />
                </div>
            </div>

            <div>
                <a
                    href={c.poweredBy.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="leading-[140%] text-[#00b0b9] font-bold text-[10px]"
                >
                    {translations[language].poweredBy}
                </a>
            </div>
        </motion.div>
    );
}



function DesktopReplica({ language, t, setLanguage, c }: InnerProps) {
    return (
        <div
            className="bg-white relative min-h-screen w-full mx-auto overflow-hidden hidden xl:flex flex-col"
            data-name="English"
        >
            <Container language={language} t={t} setLanguage={setLanguage} c={c} />
            
            <div className="flex-1 flex max-w-[1512px] mx-auto w-full px-[4%] lg:px-[80px] pt-[164px] pb-[80px] gap-12">
                {/* Left Side Content */}
                <div className="flex-1 flex flex-col gap-[40px] pt-4">
                    <Container1 c={c} />
                    <Container2Dynamic language={language} headline={c.headline} />
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 1, ease: 'easeOut' }}
                        className={`flex flex-col font-space-grotesk font-normal justify-center relative shrink-0 uppercase w-full max-w-[499px] ${language === 'am' ? 'text-[18px]' : 'text-[24px]'} text-black`}
                    >
                        <p className={language === 'am' ? 'leading-[28px]' : 'leading-[35px]'}>{c.description}</p>
                    </motion.div>
                    <Link href={c.registerHref}>
                        <motion.button
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 1.2, ease: 'easeOut' }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="bg-[#00b0b9] h-[64px] px-12 overflow-hidden shadow-[0px_10px_15px_-3px_rgba(0,176,185,0.2),0px_4px_6px_-4px_rgba(0,176,185,0.2)] w-fit cursor-pointer hover:bg-[#009aa3] transition-colors relative"
                        >
                             <span className="font-manrope font-bold text-[20px] text-white uppercase tracking-[1px]">
                                {t.registerNow}
                             </span>
                        </motion.button>
                    </Link>
                    <Container4 language={language} t={t} c={c} />
                </div>

                {/* Right Side Hero */}
                <div className="flex-1 relative w-full h-[calc(100vh-160px)] min-h-[600px] rounded-t-[40px] overflow-hidden group mt-4 lg:mt-0">
                    <motion.div
                        initial={{ opacity: 0, x: 48 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.9, delay: 0.25, ease: 'easeOut' }}
                        className="absolute inset-0"
                    >
                        <img
                            alt=""
                            src={c.heroImage}
                            className="absolute inset-0 h-full w-full object-cover object-[center_10%] transition-transform duration-[3s] group-hover:scale-105"
                        />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[220px] bg-gradient-to-t from-black/70 to-transparent" />
                        
                        {/* Quote Overlay */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 1.2, ease: 'easeOut' }}
                            className="absolute bottom-12 left-12 right-12 text-white"
                        >
                            <p className="font-mono text-xs uppercase tracking-widest mb-2 opacity-80">{c.quoteSource}</p>
                            <h3 className="font-space-grotesk font-bold text-3xl leading-tight">{c.quoteText}</h3>
                        </motion.div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

function MobileReplica({ language, t, setLanguage, c }: InnerProps) {
    const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

    const { firstWord, restFirstLine, otherLines } = splitHeadlineFirstWord(c.headline);

        const cleanMeta = c.metaLine.replace(/\s*\(\s*(DAY|ቀን|ን)\s*[:፡]?\s*\d+\s*\)/gi, '');
        return (
            <div className="w-full bg-white xl:hidden flex flex-col">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="flex items-center justify-between p-4 border-b"
                >
                    <div className="w-[100px]">
                        <img alt="" className="w-full object-contain" src={c.logoUrl} />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative inline-block text-left">
                            <button
                                type="button"
                                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                                className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 focus:outline-none p-2"
                            >
                                <Globe className="w-4 h-4" />
                                <span className="uppercase text-xs font-medium">{language}</span>
                            </button>
                             {isLangMenuOpen && (
                                <div className="absolute right-0 mt-3 w-44 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl ring-1 ring-black/5 focus:outline-none overflow-hidden border border-white/10 z-[100] animate-in fade-in zoom-in-95 duration-200">
                                    <div className="py-2">
                                        {(['en', 'am'] as Language[]).map((lang) => (
                                            <button
                                                key={lang}
                                                type="button"
                                                onClick={() => {
                                                    if (setLanguage) setLanguage(lang);
                                                    setIsLangMenuOpen(false);
                                                }}
                                                className={`flex w-full items-center px-4 py-3 text-sm transition-colors ${
                                                    language === lang 
                                                        ? 'bg-blue-50/50 text-blue-600 font-bold' 
                                                        : 'text-gray-700 hover:bg-gray-50'
                                                }`}
                                            >
                                                <div className={`w-1.5 h-1.5 rounded-full mr-3 ${language === lang ? 'bg-blue-600' : 'bg-transparent'}`} />
                                                {lang === 'en' ? 'English' : 'አማርኛ'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <Link href={c.registerHref}>
                            <motion.button
                                type="button"
                                whileTap={{ scale: 0.95 }}
                                className="bg-[#00b0b9] text-white px-3 py-2 font-bold font-manrope uppercase text-xs"
                            >
                                {t.registerNow}
                            </motion.button>
                        </Link>
                    </div>
                </motion.div>
    
                <div className="flex flex-col p-6 gap-6">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2, duration: 0.8 }}
                        className="flex items-center gap-2"
                    >
                        <div className="w-8 h-1 bg-[#00b0b9]" />
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-sans">{cleanMeta}</p>
                    </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.8 }}
                    className={`font-space-grotesk font-bold leading-tight uppercase ${language === 'am' ? 'text-5xl sm:text-6xl' : 'text-6xl'}`}
                >
                    {firstWord ? (
                        <>
                            <span className={HEADLINE_FIRST_WORD_CLASS}>{firstWord}</span>
                            {restFirstLine ? (
                                <span className={HEADLINE_REST_CLASS}>
                                    {restFirstLine.startsWith(' ') ? restFirstLine : ` ${restFirstLine}`}
                                </span>
                            ) : null}
                            {otherLines.map((line, i) => (
                                <React.Fragment key={i}>
                                    <br />
                                    <span className={HEADLINE_REST_CLASS}>{line}</span>
                                </React.Fragment>
                            ))}
                        </>
                    ) : (
                        <span className={HEADLINE_REST_CLASS}>{c.headline}</span>
                    )}
                </motion.div>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.8 }}
                    className="font-space-grotesk text-xl text-black uppercase"
                >
                    {c.description}
                </motion.p>

                <Link href={c.registerHref}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.8, duration: 0.5 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-full bg-[#00b0b9] text-white py-4 flex items-center justify-center font-bold font-manrope uppercase tracking-wider cursor-pointer shadow-lg"
                    >
                        {t.registerNow}
                    </motion.div>
                </Link>
            </div>

            <div className="flex flex-col w-full relative">
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="relative w-full min-h-[320px] h-[min(420px,70vh)] overflow-hidden"
                >
                    <img
                        src={c.heroImage}
                        className="w-full h-full object-cover"
                        style={{ objectPosition: 'center 20%' }}
                        alt=""
                    />
                    <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent z-20 text-white">
                        <motion.p
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2, duration: 0.8 }}
                            className="font-mono text-xs uppercase tracking-widest mb-2"
                        >
                            {c.quoteSource}
                        </motion.p>
                        <motion.p
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.35, duration: 0.8 }}
                            className="font-space-grotesk font-bold text-2xl"
                        >
                            {c.quoteText}
                        </motion.p>
                    </div>
                </motion.div>
            </div>

            <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 1 }}
                className="flex items-center justify-center gap-3 py-8 bg-gray-50"
            >
                <span className="text-black font-bold uppercase text-sm font-manrope">
                    {c.poweredBy.label || t.poweredByLabel}
                </span>
                <a href={c.poweredBy.url} target="_blank" rel="noopener noreferrer">
                    <img src={c.poweredBy.logoUrl} alt="" className="h-8 w-auto opacity-80" />
                </a>
            </motion.div>
        </div>
    );
}

export function DynamicRegistrationLanding({ orgSlug, eventSlug }: Props) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [language, setLanguage] = useState<Language>('am');
    const [payload, setPayload] = useState<PublicLandingPayload | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const langParam = searchParams.get('lang');
        if (langParam && ['en', 'am'].includes(langParam)) {
            setLanguage(langParam as Language);
        }
    }, [searchParams]);

    useEffect(() => {
        setPayload(null);
        setError(null);
        const path = eventSlug
            ? `/api/public/landing/${encodeURIComponent(orgSlug)}/${encodeURIComponent(eventSlug)}`
            : `/api/public/landing/${encodeURIComponent(orgSlug)}`;
        fetch(path)
            .then((r) => {
                if (!r.ok) throw new Error('Not found');
                return r.json();
            })
            .then((d: PublicLandingPayload) => setPayload(d))
            .catch(() => setError('Could not load this landing page.'));
    }, [orgSlug, eventSlug]);

    const handleSetLanguage = (lang: Language) => {
        setLanguage(lang);
        const params = new URLSearchParams(searchParams.toString());
        params.set('lang', lang);
        router.replace(`?${params.toString()}`, { scroll: false });
    };

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 text-red-600 bg-gray-50">
                {error}
            </div>
        );
    }

    if (!payload) {
        return (
            <div
                className={`min-h-screen flex items-center justify-center text-gray-500 ${manrope.variable} ${spaceGrotesk.variable}`}
            >
                Loading…
            </div>
        );
    }

    const t = translations[language];
    const { landing, links } = payload;
    const { i18n } = landing;

    const fallbackMetaLine =
        formatEventMetaLine(payload.event?.startsAt, payload.event?.endsAt, undefined, language) ||
        `${t.landingDate} • ${t.landingPlace}`;

    const metaLine = pickLandingText(
        language,
        i18n.metaLine,
        fallbackMetaLine
    );
    const headline = pickLandingText(
        language,
        i18n.headline,
        payload.event?.name || payload.organization.name
    );
    const description = pickLandingText(
        language,
        i18n.description,
        payload.event?.description?.trim() || t.conferenceDescription
    );
    const quoteSource = pickLandingText(language, i18n.quoteSource, t.romans);
    const quoteText = pickLandingText(language, i18n.quoteText, t.renewing);

    const registerHref = `${links.register}?lang=${language}`;

    const c: ReplicaContent = {
        logoUrl: landing.logoUrl,
        metaLine,
        headline,
        description,
        quoteSource,
        quoteText,
        heroImage: landing.heroImage,
        panelColor: landing.panelColor,
        poweredBy: landing.poweredBy,
        registerHref,
    };

    return (
        <div className={`min-h-screen bg-white ${manrope.variable} ${spaceGrotesk.variable}`}>
            <DesktopReplica language={language} t={t} setLanguage={handleSetLanguage} c={c} />
            <MobileReplica language={language} t={t} setLanguage={handleSetLanguage} c={c} />
        </div>
    );
}
