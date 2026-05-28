'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Globe, Menu, X } from 'lucide-react';
import { Inter, Poppins } from 'next/font/google';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { translations, type Language } from '@/app/translations';
import { WobbleCard } from '../ui/wobble-card';
import { Carousel, Card } from '../ui/apple-cards-carousel';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const poppins = Poppins({ weight: ['600', '700'], subsets: ['latin'], variable: '--font-poppins' });

type T = (typeof translations)['en'];

const HERO_IMG = '/hero-conference.jpg';
const LOGO_IMG = '/assets/cls_2025/logo_gcme.png';

type Props = {
    language: Language;
    t: T;
    setLanguage?: (lang: Language) => void;
};

// --- Carousel Content Components ---
const DummyContent = ({ text }: { text: string }) => {
    return (
        <div className="bg-[#F5F5F7] p-8 md:p-14 rounded-3xl mb-4">
            <p className="text-neutral-600 text-base md:text-2xl font-[family-name:var(--font-inter),sans-serif] max-w-3xl mx-auto">
                {text}
            </p>
        </div>
    );
};

const carouselData = [
    {
        category: "Leadership",
        title: "Inspiring Local Leaders",
        src: "/assets/cls_2025/speaker_left_new.jpg",
        content: <DummyContent text="Gain deep insights from profound speakers dedicated to equipping you with biblical foundations and strategic action steps to impact your direct community." />,
    },
    {
        category: "Equipping",
        title: "Tools for Transformation",
        src: "/assets/cls_2025/speaker3.jpg",
        content: <DummyContent text="Discover comprehensive frameworks inside the event that allow organizations to effectively evaluate their current state and accelerate growth rapidly." />,
    },
    {
        category: "Networking",
        title: "Building Lasting Connections",
        src: "/assets/cls_2025/speaker_1.png",
        content: <DummyContent text="Connect with over 1,600 attendees representing 580+ churches. Form partnerships and collaborative endeavors that scale your kingdom impact." />,
    },
    {
        category: "Vision",
        title: "Renewing Your Purpose",
        src: "/assets/cls_2025/speaker_2.png",
        content: <DummyContent text="Experience spiritually rejuvenating sessions that reconnect you to your core calling. Break away from the noise and find clarity for the next season." />,
    },
    {
        category: "Growth",
        title: "Expanding Regional Impact",
        src: "/assets/cls_2025/speaker_right_new.jpg",
        content: <DummyContent text="With participants spanning across 22+ regions, the platform provides scalable models that work across diverse demographics and community challenges." />,
    },
];
// -----------------------------------

function MapSection() {
    return (
        <section className="  w-full h-[600px] grayscale contrast-125 overflow-hidden relative border-y border-gray-100 map-section opacity-0">
            <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15762.65839213164!2d38.74936496977539!3d9.002824799999999!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x164b85cef5ab402d%3A0x8467b6b037a24d4a!2sAddis%20Ababa%2C%20Ethiopia!5e0!3m2!1sen!2set!4v1625062234000!5m2!1sen!2set"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
                title="Google Maps"
            />

        </section>
    );
}



function SupportCTA() {
    return (
        <section className="bg-white py-12 px-6">
            <div className="max-w-7xl mx-auto bg-emerald-600 rounded-[32px] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl shadow-emerald-200">
                <div className="max-w-md">
                    <h2 className="text-3xl md:text-4xl font-black text-white leading-tight font-[family-name:var(--font-poppins),sans-serif]">
                        Want to get any support? We're ready for you.
                    </h2>
                </div>
                <div className="flex w-full md:w-auto items-center bg-white/10 backdrop-blur-md border border-white/20 rounded-full p-1.5 focus-within:ring-2 focus-within:ring-white/30 transition-all">
                    <input
                        type="email"
                        placeholder="Enter Your Email"
                        className="bg-transparent border-none focus:ring-0 text-white placeholder:text-white/60 px-6 py-3 w-full md:w-64 font-medium"
                    />
                    <button className="bg-white text-emerald-600 px-8 py-3 rounded-full font-black text-sm uppercase tracking-widest hover:bg-emerald-50 transition-colors shadow-lg shadow-black/5">
                        Subscribe
                    </button>
                </div>
            </div>
        </section>
    );
}

function MainFooter({ t }: { t: T }) {
    return (
        <footer className="bg-black border-t border-gray-100 pt-24 pb-12 font-[family-name:var(--font-inter),sans-serif] footer-section">
            <div className="max-w-7xl mx-auto px-6">

                <div className="pt-12 flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        © 2026 CLS Event. All Rights Reserved.
                    </p>
                    <div className="flex gap-8 text-xs font-bold text-gray-400 uppercase tracking-widest">
                        <Link href="/terms" className="hover:text-emerald-600 transition-colors">Terms of Service</Link>
                        <Link href="/privacy" className="hover:text-emerald-600 transition-colors">Privacy Policy</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}



function TopNav({ language, t, setLanguage }: Props) {
    const [langOpen, setLangOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-black/20 font-[family-name:var(--font-inter),sans-serif] backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
                <Link href="/" className="flex shrink-0 items-center gap-2.5">
                    <img src={LOGO_IMG} alt="" className="h-9 w-auto object-contain brightness-0 invert opacity-100" />

                </Link>



                <div className="flex items-center gap-4">
                    <Link
                        href="/login"
                        className="hidden text-sm font-bold text-white/90 transition hover:text-white sm:inline drop-shadow"
                    >
                        {t.platformNavLogin}
                    </Link>
                    <Link
                        href="/login"
                        className="hidden rounded-full bg-blue-600 hover:bg-blue-500 px-6 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all sm:inline-block"
                    >
                        {t.platformNavSignUp}
                    </Link>

                    <button
                        type="button"
                        className="rounded-full bg-black/40 backdrop-blur-md p-2.5 text-white transition hover:bg-black/60 lg:hidden"
                        onClick={() => setMobileOpen((v) => !v)}
                        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                    >
                        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>
            </div>

            {mobileOpen && (
                <div className="absolute left-0 right-0 top-full border-t border-white/10 bg-black/95 px-6 py-6 backdrop-blur-3xl shadow-2xl lg:hidden">
                    <div className="mt-2 flex flex-col gap-3">
                        <Link
                            href="/login"
                            className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 text-center text-sm font-bold text-white transition-colors hover:bg-white/10"
                            onClick={() => setMobileOpen(false)}
                        >
                            {t.platformNavLogin}
                        </Link>
                        <Link
                            href="/login"
                            className="w-full rounded-2xl bg-blue-600 py-4 text-center text-sm font-black text-white shadow-lg transition-colors hover:bg-blue-500"
                            onClick={() => setMobileOpen(false)}
                        >
                            {t.platformNavSignUp}
                        </Link>
                    </div>
                </div>
            )}
        </header>
    );
}

export function PlatformMarketingHome({ language, t, setLanguage }: Props) {
    useEffect(() => {
        document.title = t.platformMetaTitle;

        gsap.registerPlugin(ScrollTrigger);

        // Hero Entrance
        const heroTl = gsap.timeline();
        heroTl.from(".hero-badge", { opacity: 0, scale: 0.9, duration: 1, ease: "back.out(1.7)" })
            .from(".hero-title", { opacity: 0, y: 60, duration: 1.2, ease: "power4.out" }, "-=0.6")
            .from(".hero-sub", { opacity: 0, y: 30, duration: 1, ease: "power3.out" }, "-=0.8")
            .from(".hero-btns", { opacity: 0, y: 20, duration: 1, ease: "power3.out" }, "-=0.8");

        // Wobble Cards Section
        gsap.from(".wobble-card-item", {
            scrollTrigger: {
                trigger: ".wobble-section",
                start: "top 85%",
            },
            opacity: 0,
            y: 80,
            stagger: 0.2,
            duration: 1.2,
            ease: "power3.out"
        });

        // Carousel Section
        gsap.from(".carousel-header", {
            scrollTrigger: {
                trigger: ".carousel-section",
                start: "top 85%",
            },
            opacity: 0,
            x: -40,
            duration: 1,
            ease: "power3.out"
        });

        // Map Section
        gsap.to(".map-section", {
            scrollTrigger: {
                trigger: ".map-section",
                start: "top 85%",
            },
            opacity: 1,
            scale: 1,
            duration: 1.5,
            ease: "power2.out"
        });

        // Footer Section
        gsap.from(".footer-col", {
            scrollTrigger: {
                trigger: ".footer-section",
                start: "top 90%",
            },
            opacity: 0,
            y: 40,
            stagger: 0.15,
            duration: 1,
            ease: "power2.out"
        });

    }, [t.platformMetaTitle]);

    return (
        <div
            id="top"
            className={`min-h-screen bg-black text-white ${inter.variable} ${poppins.variable} selection:bg-blue-500/30 font-[family-name:var(--font-inter),sans-serif] flex flex-col`}
        >
            <TopNav language={language} t={t} setLanguage={setLanguage} />

            {/* Rebuilt Cinematic Hero Section */}
            <section className="relative flex-1 flex items-center justify-center min-h-[100svh] overflow-hidden pt-20">
                {/* Full Screen Background Image */}
                <div className="absolute inset-0 z-0">
                    <div
                        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-[20s] ease-out scale-105"
                        style={{ backgroundImage: `url('${HERO_IMG}')` }}
                    />
                    {/* Gradient Overlay for Text Legibility */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/90 backdrop-blur-[2px]" />
                </div>

                <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
                    <span className="inline-block rounded-full bg-blue-500/20 backdrop-blur-md px-5 py-2 text-xs font-black uppercase tracking-[0.25em] text-blue-300 ring-1 ring-blue-400/30 mb-8 hero-badge">
                        {t.platformS1Badge}
                    </span>

                    <h1 className="font-[family-name:var(--font-poppins),sans-serif] text-5xl font-black leading-[1.1] tracking-tight text-white sm:text-7xl lg:text-[6rem] drop-shadow-2xl hero-title">
                        {t.platformHeroLine1} <br />
                        <span className="text-blue-400 bg-clip-text drop-shadow-[0_0_30px_rgba(59,130,246,0.8)]">
                            {t.platformHeroLine2?.split(' ').slice(-1)}
                        </span>
                    </h1>

                    <p className="mx-auto mt-8 max-w-2xl text-lg sm:text-xl font-medium leading-relaxed text-gray-300 drop-shadow-lg hero-sub">
                        {t.platformHeroSub}
                    </p>

                    <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-6 hero-btns">
                        <Link
                            href="/login"
                            className="flex h-16 w-full sm:w-auto items-center justify-center rounded-full bg-blue-600 px-12 text-base font-black text-white shadow-[0_0_40px_rgba(37,99,235,0.5)] transition-all hover:bg-blue-500 hover:scale-105 hover:shadow-[0_0_60px_rgba(37,99,235,0.7)]"
                        >
                            {t.platformNavSignUp}
                        </Link>
                        <Link
                            href="/login"
                            className="flex h-16 w-full sm:w-auto items-center justify-center rounded-full bg-white/10 backdrop-blur-lg px-12 text-base font-black text-white ring-2 ring-white/20 transition-all hover:bg-white/20 hover:scale-105"
                        >
                            {t.platformNavLogin}
                        </Link>
                    </div>
                </div>

                {/* Scroll Indicator */}
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-60">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white">Scroll</span>
                    <div className="w-0.5 h-12 bg-gradient-to-b from-white/50 to-transparent"></div>
                </div>
            </section>
            {/* Wobble Card Features Section */}
            <section className="bg-gray-50 py-24 sm:py-32 wobble-section">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto w-full px-6">
                    {/* Primary Feature Card */}
                    <div className="col-span-1 lg:col-span-2 wobble-card-item">
                        <WobbleCard
                            containerClassName="h-full bg-emerald-600 min-h-[500px] lg:min-h-[300px]"
                            className=""
                        >
                            <div className="max-w-xs relative z-10">
                                <h2 className="text-left text-balance text-base md:text-xl lg:text-3xl font-semibold tracking-[-0.015em] text-white">
                                    Empowering Leaders Every Year
                                </h2>
                                <p className="mt-4 text-left text-base/6 text-green-100">
                                    Transforming the leadership landscape through spiritual renewal and strategic equipping. We help organizations scale their influence.
                                </p>
                            </div>
                            <img
                                src="/assets/cls_2025/speaker_middle_new.jpg"
                                alt="Leadership Event"
                                className="absolute -right-4 lg:-right-[10%] grayscale-[0.2] filter top-10 lg:-bottom-10 object-cover w-[60%] lg:w-[50%] h-[120%] rounded-2xl shadow-2xl mix-blend-luminosity opacity-80"
                            />
                        </WobbleCard>
                    </div>

                    {/* Secondary Stat Card */}
                    <div className="col-span-1 wobble-card-item">
                        <WobbleCard containerClassName="min-h-[300px] bg-white border border-gray-100 shadow-xl overflow-hidden">
                            <div className="relative z-10">
                                <h2 className="max-w-80 text-left text-balance text-base md:text-xl lg:text-3xl font-semibold tracking-[-0.015em] text-emerald-900">
                                    Over 580+ Churches
                                </h2>
                                <p className="mt-4 max-w-[26rem] text-left text-base/6 text-emerald-700/80">
                                    Impacting 22+ regions with over 1,600 attendees coming together for greater, strategic vision and transformation.
                                </p>
                            </div>

                            {/* Decorative Background Blob for the white card */}
                            <div className="absolute right-0 bottom-0 w-48 h-48 bg-emerald-100 rounded-full blur-[80px] -mr-20 -mb-20"></div>
                        </WobbleCard>
                    </div>

                    {/* Full span CTA Card */}
                    <div className="col-span-1 lg:col-span-3 wobble-card-item">
                        <WobbleCard containerClassName="bg-blue-600 min-h-[500px] lg:min-h-[600px] xl:min-h-[300px]">
                            <div className="max-w-sm relative z-10">
                                <h2 className="max-w-sm md:max-w-lg text-left text-balance text-base md:text-xl lg:text-3xl font-semibold tracking-[-0.015em] text-white">
                                    Join our 12+ Years of Incredible Impact Today!
                                </h2>
                                <p className="mt-4 max-w-[26rem] text-left text-base/6 text-blue-100">
                                    Register yourself and your group to be a part of the most critical foundational leadership summit in the region.
                                </p>
                            </div>
                            <img
                                src="/assets/cls_2025/speaker_wide.png"
                                alt="Audience"
                                className="absolute -right-10 md:right-10 -bottom-10 object-contain rounded-2xl w-[60%] md:w-[40%] opacity-80 sm:opacity-100 mix-blend-screen"
                            />
                        </WobbleCard>
                    </div>
                </div>
            </section>

            {/* Apple Cards Carousel Section */}
            <section className="bg-white sm:py-32 carousel-section">
                <div className="w-full h-full">
                    <h2 className="max-w-7xl pl-4 md:pl-8 mx-auto text-3xl md:text-5xl font-black text-emerald-900 font-[family-name:var(--font-poppins),sans-serif] carousel-header">
                        Explore the Platform.
                    </h2>

                    <Carousel items={carouselData.map((card, index) => (
                        <Card key={card.src} card={card} index={index} />
                    ))} />


                </div>
            </section>

            <MapSection />

            <MainFooter t={t} />

        </div>
    );
}
