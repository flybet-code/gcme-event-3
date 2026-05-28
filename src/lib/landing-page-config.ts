/**
 * Registration marketing landing (hero) — stored as JSON:
 * - `Organization.settings.landingPage` — org-wide defaults
 * - `Event.settings.landingPage` — overrides per event
 *
 * Public URLs:
 * - `/{orgSlug}/landing` — org defaults, register → `/{orgSlug}/register`
 * - `/{orgSlug}/{eventSlug}` — merged, register → `/{orgSlug}/{eventSlug}/register`
 */
import type { Language } from '@/app/translations';

export const DEFAULT_LANDING_LOGO = '/assets/cls_2025/logo_gcme.png';
/** Default hero image when none is configured (legacy triple-hero used the left asset). */
export const DEFAULT_HERO_IMAGE = '/assets/cls_2025/speaker_left_new.jpg';
export const DEFAULT_PANEL_COLORS: [string, string, string] = ['#00B0B9', '#F8D700', '#69FF12'];
export const DEFAULT_POWERED_LOGO = '/assets/cls_2025/logo_yotor.png';

export type LandingPageI18n = {
    metaLine?: Partial<Record<Language, string>>;
    /** Multi-line OK — use \\n between lines */
    headline?: Partial<Record<Language, string>>;
    description?: Partial<Record<Language, string>>;
    quoteSource?: Partial<Record<Language, string>>;
    quoteText?: Partial<Record<Language, string>>;
    organizerFooter?: Partial<Record<Language, string>>;
};

export type LandingPageSettings = {
    logoUrl?: string;
    /** Single hero/side image URL (stored as a one-element array for compatibility) */
    speakerImageUrls?: string[];
    poweredByLogoUrl?: string;
    poweredByLabel?: string;
    poweredByUrl?: string;
    /** Shown in meta line when dates are auto-formatted */
    locationLine?: string;
    locationLineI18n?: Partial<Record<Language, string>>;
    i18n?: LandingPageI18n;
    panelColors?: string[];
};

export function parseLandingPageFromSettings(settings: unknown): LandingPageSettings | undefined {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return undefined;
    const lp = (settings as Record<string, unknown>).landingPage;
    if (!lp || typeof lp !== 'object' || Array.isArray(lp)) return undefined;
    return lp as LandingPageSettings;
}

function parseSummitDatesFromSettings(settings: unknown): Partial<Record<Language, string>> {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {};
    const summit = (settings as Record<string, unknown>).summitRegistration;
    if (!summit || typeof summit !== 'object' || Array.isArray(summit)) return {};
    const datesLineI18n = (summit as Record<string, unknown>).datesLineI18n;
    if (!datesLineI18n || typeof datesLineI18n !== 'object' || Array.isArray(datesLineI18n)) return {};
    return datesLineI18n as Partial<Record<Language, string>>;
}

function parseSummitPlaceFromSettings(settings: unknown): Partial<Record<Language, string>> {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {};
    const summit = (settings as Record<string, unknown>).summitRegistration;
    if (!summit || typeof summit !== 'object' || Array.isArray(summit)) return {};
    const placeLineI18n = (summit as Record<string, unknown>).placeLineI18n;
    if (!placeLineI18n || typeof placeLineI18n !== 'object' || Array.isArray(placeLineI18n)) return {};
    return placeLineI18n as Partial<Record<Language, string>>;
}

function mergeI18n(a: LandingPageI18n | undefined, b: LandingPageI18n | undefined): LandingPageI18n | undefined {
    if (!a && !b) return undefined;
    const keys = [
        'metaLine',
        'headline',
        'description',
        'quoteSource',
        'quoteText',
        'organizerFooter',
    ] as const;
    const out: LandingPageI18n = {};
    for (const k of keys) {
        const merged = { ...a?.[k], ...b?.[k] };
        if (Object.keys(merged).length) out[k] = merged;
    }
    return Object.keys(out).length ? out : undefined;
}

/** Deep-merge org defaults with event overrides */
export function mergeLandingPageSettings(
    orgSettings: unknown,
    eventSettings: unknown
): LandingPageSettings {
    const o = parseLandingPageFromSettings(orgSettings) ?? {};
    const e = parseLandingPageFromSettings(eventSettings) ?? {};
    const speakerImageUrls =
        e.speakerImageUrls && e.speakerImageUrls.length > 0
            ? e.speakerImageUrls.slice(0, 1)
            : o.speakerImageUrls && o.speakerImageUrls.length > 0
              ? o.speakerImageUrls.slice(0, 1)
              : undefined;
    return {
        ...o,
        ...e,
        speakerImageUrls,
        i18n: mergeI18n(o.i18n, e.i18n),
    };
}

function localeForLang(lang: Language): string {
    if (lang === 'am') return 'am-ET';
    if (lang === 'or') return 'om-ET';
    if (lang === 'ti') return 'ti-ET';
    return 'en-US';
}

export function formatEventMetaLine(
    startsAt: string | Date | null | undefined,
    endsAt: string | Date | null | undefined,
    locationLine: string | undefined,
    lang: Language
): string {
    const loc = locationLine?.trim() ?? '';
    if (!startsAt) return loc;
    const s = typeof startsAt === 'string' ? new Date(startsAt) : startsAt;
    if (Number.isNaN(s.getTime())) return loc;
    const e = endsAt ? (typeof endsAt === 'string' ? new Date(endsAt) : endsAt) : null;
    const locale = localeForLang(lang);
    const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
    let datePart = '';
    if (e && !Number.isNaN(e.getTime()) && e.getTime() !== s.getTime()) {
        const sameYear = s.getFullYear() === e.getFullYear();
        const sameMonth = sameYear && s.getMonth() === e.getMonth();
        if (sameMonth) {
            datePart = `${s.toLocaleDateString(locale, { month: 'long', day: 'numeric' })} – ${e.toLocaleDateString(locale, { day: 'numeric', year: 'numeric' })}`;
        } else if (sameYear) {
            datePart = `${s.toLocaleDateString(locale, { month: 'long', day: 'numeric' })} – ${e.toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' })}`;
        } else {
            datePart = `${s.toLocaleDateString(locale, opts)} – ${e.toLocaleDateString(locale, opts)}`;
        }
    } else {
        datePart = s.toLocaleDateString(locale, opts);
    }
    if (datePart && loc) return `${datePart} • ${loc}`;
    return datePart || loc;
}

function resolveLocationLine(
    settings: LandingPageSettings,
    summitPlaceI18n: Partial<Record<Language, string>>,
    lang: Language
): string | undefined {
    return (
        summitPlaceI18n[lang]?.trim() ||
        summitPlaceI18n.en?.trim() ||
        summitPlaceI18n.am?.trim() ||
        settings.locationLineI18n?.[lang]?.trim() ||
        settings.locationLineI18n?.en?.trim() ||
        settings.locationLineI18n?.am?.trim() ||
        settings.locationLine?.trim() ||
        undefined
    );
}

export type PublicLandingI18nBlock = {
    metaLine: Partial<Record<Language, string>>;
    headline: Partial<Record<Language, string>>;
    description: Partial<Record<Language, string>>;
    quoteSource: Partial<Record<Language, string>>;
    quoteText: Partial<Record<Language, string>>;
    organizerFooter: Partial<Record<Language, string>>;
};

export type PublicLandingPayload = {
    organization: { id: string; name: string; slug: string };
    event: {
        id: string;
        name: string;
        slug: string;
        description: string | null;
        startsAt: string | null;
        endsAt: string | null;
    } | null;
    landing: {
        logoUrl: string;
        heroImage: string;
        panelColor: string;
        poweredBy: { logoUrl: string; label: string; url: string };
        i18n: PublicLandingI18nBlock;
    };
    links: { register: string; landing: string };
};

function fillI18nBlock(
    merged: LandingPageSettings,
    orgName: string,
    summitDatesI18n: Partial<Record<Language, string>>,
    summitPlaceI18n: Partial<Record<Language, string>>,
    event: {
        name: string;
        description: string | null;
        startsAt: Date | null;
        endsAt: Date | null;
    } | null
): PublicLandingI18nBlock {
    const src = merged.i18n ?? {};
    const langs: Language[] = ['en', 'am', 'or', 'ti'];
    const metaLine: Partial<Record<Language, string>> = { ...src.metaLine };
    const headline: Partial<Record<Language, string>> = { ...src.headline };
    const description: Partial<Record<Language, string>> = { ...src.description };
    const quoteSource: Partial<Record<Language, string>> = { ...src.quoteSource };
    const quoteText: Partial<Record<Language, string>> = { ...src.quoteText };
    const organizerFooter: Partial<Record<Language, string>> = { ...src.organizerFooter };

    for (const lang of langs) {
        if (!metaLine[lang]?.trim()) {
            const locationLine = resolveLocationLine(merged, summitPlaceI18n, lang);
            const summitDateLine =
                summitDatesI18n[lang]?.trim() ||
                summitDatesI18n.en?.trim() ||
                summitDatesI18n.am?.trim();
            if (summitDateLine) {
                metaLine[lang] =
                    locationLine && !summitDateLine.includes('•')
                        ? `${summitDateLine} • ${locationLine}`
                        : summitDateLine;
            } else if (event) {
                const auto = formatEventMetaLine(
                    event.startsAt,
                    event.endsAt,
                    locationLine,
                    lang
                );
                if (auto) metaLine[lang] = auto;
            } else {
                if (locationLine) metaLine[lang] = locationLine;
            }
        }
        if (!headline[lang]?.trim()) {
            headline[lang] = event?.name?.trim() || orgName;
        }
        if (!description[lang]?.trim() && event?.description?.trim()) {
            description[lang] = event.description.trim();
        }
    }

    return {
        metaLine,
        headline,
        description,
        quoteSource,
        quoteText,
        organizerFooter,
    };
}

function resolveHeroImage(urls: string[] | undefined): string {
    const first = urls?.[0]?.trim();
    if (first) return first;
    return DEFAULT_HERO_IMAGE;
}

function resolvePanelColor(colors: string[] | undefined): string {
    const d = DEFAULT_PANEL_COLORS;
    if (!colors?.length) return d[0];
    return colors[0]?.trim() || d[0];
}

/** Build stored `landingPage` from dashboard form fields (omit when empty). */
export function buildLandingPageSettingsFromInputs(p: {
    logoUrl: string;
    heroImage: string;
    locationLineEn: string;
    locationLineAm: string;
    headlineEn: string;
    headlineAm: string;
    descriptionEn: string;
    descriptionAm: string;
    quoteSourceEn: string;
    quoteSourceAm: string;
    quoteTextEn: string;
    quoteTextAm: string;
    organizerFooterEn: string;
    organizerFooterAm: string;
}): LandingPageSettings | null {
    const logoUrl = p.logoUrl.trim();
    const hero = p.heroImage.trim();
    const locationLineEn = p.locationLineEn.trim();
    const locationLineAm = p.locationLineAm.trim();
    const i18n: LandingPageI18n = {};
    const hlEn = p.headlineEn.trim();
    const hlAm = p.headlineAm.trim();
    if (hlEn || hlAm) {
        i18n.headline = {};
        if (hlEn) i18n.headline.en = hlEn;
        if (hlAm) i18n.headline.am = hlAm;
    }
    const dEn = p.descriptionEn.trim();
    const dAm = p.descriptionAm.trim();
    if (dEn || dAm) {
        i18n.description = {};
        if (dEn) i18n.description.en = dEn;
        if (dAm) i18n.description.am = dAm;
    }
    const qsEn = p.quoteSourceEn.trim();
    const qsAm = p.quoteSourceAm.trim();
    if (qsEn || qsAm) {
        i18n.quoteSource = {};
        if (qsEn) i18n.quoteSource.en = qsEn;
        if (qsAm) i18n.quoteSource.am = qsAm;
    }
    const qtEn = p.quoteTextEn.trim();
    const qtAm = p.quoteTextAm.trim();
    if (qtEn || qtAm) {
        i18n.quoteText = {};
        if (qtEn) i18n.quoteText.en = qtEn;
        if (qtAm) i18n.quoteText.am = qtAm;
    }
    const ofEn = p.organizerFooterEn.trim();
    const ofAm = p.organizerFooterAm.trim();
    if (ofEn || ofAm) {
        i18n.organizerFooter = {};
        if (ofEn) i18n.organizerFooter.en = ofEn;
        if (ofAm) i18n.organizerFooter.am = ofAm;
    }

    const hasI18n = Object.keys(i18n).length > 0;
    if (!logoUrl && !hero && !locationLineEn && !locationLineAm && !hasI18n) return null;

    const out: LandingPageSettings = {};
    if (logoUrl) out.logoUrl = logoUrl;
    if (hero) out.speakerImageUrls = [hero];
    if (locationLineEn) out.locationLine = locationLineEn;
    if (locationLineEn || locationLineAm) {
        out.locationLineI18n = {};
        if (locationLineEn) out.locationLineI18n.en = locationLineEn;
        if (locationLineAm) out.locationLineI18n.am = locationLineAm;
    }
    if (hasI18n) out.i18n = i18n;
    return out;
}

export type LandingPageFormFields = {
    logoUrl: string;
    heroImage: string;
    locationLineEn: string;
    locationLineAm: string;
    headlineEn: string;
    headlineAm: string;
    descriptionEn: string;
    descriptionAm: string;
    quoteSourceEn: string;
    quoteSourceAm: string;
    quoteTextEn: string;
    quoteTextAm: string;
    organizerFooterEn: string;
    organizerFooterAm: string;
};

export function landingFormFieldsFromSettings(settings: unknown): LandingPageFormFields {
    const lp = parseLandingPageFromSettings(settings);
    const i = lp?.i18n;
    return {
        logoUrl: lp?.logoUrl?.trim() ?? '',
        heroImage: lp?.speakerImageUrls?.find((u) => u?.trim())?.trim() ?? '',
        locationLineEn: lp?.locationLineI18n?.en?.trim() ?? lp?.locationLine?.trim() ?? '',
        locationLineAm: lp?.locationLineI18n?.am?.trim() ?? '',
        headlineEn: i?.headline?.en?.trim() ?? '',
        headlineAm: i?.headline?.am?.trim() ?? '',
        descriptionEn: i?.description?.en?.trim() ?? '',
        descriptionAm: i?.description?.am?.trim() ?? '',
        quoteSourceEn: i?.quoteSource?.en?.trim() ?? '',
        quoteSourceAm: i?.quoteSource?.am?.trim() ?? '',
        quoteTextEn: i?.quoteText?.en?.trim() ?? '',
        quoteTextAm: i?.quoteText?.am?.trim() ?? '',
        organizerFooterEn: i?.organizerFooter?.en?.trim() ?? '',
        organizerFooterAm: i?.organizerFooter?.am?.trim() ?? '',
    };
}

export function pickLandingText(
    lang: Language,
    map: Partial<Record<Language, string>> | undefined,
    fallback: string
): string {
    if (!map) return fallback;
    const v =
        map[lang]?.trim() ||
        map.en?.trim() ||
        map.am?.trim() ||
        map.or?.trim() ||
        map.ti?.trim();
    return v || fallback;
}

export function buildPublicLandingPayload(
    org: { id: string; name: string; slug: string; settings: unknown },
    event: {
        id: string;
        name: string;
        slug: string;
        description: string | null;
        startsAt: Date | null;
        endsAt: Date | null;
        settings: unknown;
    } | null
): PublicLandingPayload {
    const merged = mergeLandingPageSettings(org.settings, event?.settings ?? null);
    const summitDatesI18n = {
        ...parseSummitDatesFromSettings(org.settings),
        ...parseSummitDatesFromSettings(event?.settings),
    };
    const summitPlaceI18n = {
        ...parseSummitPlaceFromSettings(org.settings),
        ...parseSummitPlaceFromSettings(event?.settings),
    };
    const logoUrl = merged.logoUrl?.trim() || DEFAULT_LANDING_LOGO;
    const heroImage = resolveHeroImage(merged.speakerImageUrls);
    const panelColor = resolvePanelColor(merged.panelColors);
    const poweredBy = {
        logoUrl: merged.poweredByLogoUrl?.trim() || DEFAULT_POWERED_LOGO,
        label: merged.poweredByLabel?.trim() || 'Powered by ',
        url: merged.poweredByUrl?.trim() || 'https://yotor.church',
    };

    const eventForFill = event
        ? {
              name: event.name,
              description: event.description,
              startsAt: event.startsAt,
              endsAt: event.endsAt,
          }
        : null;

    const i18n = fillI18nBlock(merged, org.name, summitDatesI18n, summitPlaceI18n, eventForFill);

    const register = event
        ? `/${org.slug}/${event.slug}/register`
        : `/${org.slug}/register`;
    const landing = event
        ? `/${org.slug}/${event.slug}`
        : `/${org.slug}/landing`;

    return {
        organization: { id: org.id, name: org.name, slug: org.slug },
        event: event
            ? {
                  id: event.id,
                  name: event.name,
                  slug: event.slug,
                  description: event.description,
                  startsAt: event.startsAt ? event.startsAt.toISOString() : null,
                  endsAt: event.endsAt ? event.endsAt.toISOString() : null,
              }
            : null,
        landing: {
            logoUrl,
            heroImage,
            panelColor,
            poweredBy,
            i18n,
        },
        links: { register, landing },
    };
}
