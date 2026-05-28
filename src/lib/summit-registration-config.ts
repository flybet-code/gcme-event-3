/**
 * Summit (GLS) UI reads merged JSON from:
 * - `Organization.settings.summitDefaults` (org-wide fallback)
 * - `Event.settings.summitRegistration` (overrides for that event)
 *
 * Example `Event.settings`:
 * {
 *   "summitRegistration": {
 *     "basePriceEtb": 1500,
 *     "supportEmail": "events@example.org",
 *     "registrationTitleI18n": { "en": "Registration | My Conference", "am": "..." },
 *     "datesLineI18n": { "en": "Dates: April 25–26, 2026", "am": "..." },
 *     "placeLineI18n": { "en": "Place: Beza International Church", "am": "..." },
 *     "paymentMethods": [
 *       { "id": "BRN", "label": "Berhan Bank", "shortLabel": "BR", "type": "bank",
 *         "color": "text-amber-600", "bg": "bg-orange-50", "accountNumber": "2500060056250", "accountName": "GCME" },
 *       { "id": "TELEBIRR", "label": "Telebirr", "shortLabel": "TB", "type": "telebirr",
 *         "color": "text-green-600", "bg": "bg-green-50", "merchantId": "514408" }
 *     ]
 *   }
 * }
 */
import type { Event } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { translations, type Language } from '@/app/translations';
import { DEFAULT_LANDING_LOGO, parseLandingPageFromSettings } from './landing-page-config';

/** Stored on Organization.settings.summitDefaults or Event.settings.summitRegistration */
export type SummitPaymentMethodConfig = {
    id: string;
    label: string;
    /** Two letters shown in the circle */
    shortLabel?: string;
    type: 'bank' | 'telebirr' | 'other';
    color?: string;
    bg?: string;
    accountNumber?: string;
    accountName?: string;
    /** Telebirr merchant / wallet id shown to user */
    merchantId?: string;
};

export type SummitContactInfo = {
    name?: string;
    phone?: string;
    email?: string;
};

export type SummitRegistrationSettings = {
    basePriceEtb?: number;
    /** Shown in footer / receipts */
    supportEmail?: string;
    registrationTitleI18n?: Partial<Record<Language, string>>;
    datesLineI18n?: Partial<Record<Language, string>>;
    placeLineI18n?: Partial<Record<Language, string>>;
    paymentMethods?: SummitPaymentMethodConfig[];
    contacts?: SummitContactInfo[];
    /**
     * Configured discount codes for this org/event (and optionally merged from form settings).
     * Keys are compared case-insensitively; values are discount fractions in [0, 1] (e.g. 0.5 = 50% off).
     */
    coupons?: Record<string, number>;
};

/** One row in dashboard “coupon” editors (percent 0–100). */
export type SummitCouponFormRow = { code: string; percentOff: number };

const RESERVED_COUPON_CODES = new Set(['CASH', 'BANK']);

/** Normalize stored coupon maps: uppercase keys, clamp fractions, drop reserved payment shortcuts. */
export function normalizeCouponRecord(map: Record<string, number> | undefined | null): Record<string, number> {
    if (!map || typeof map !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(map)) {
        const key = k.trim().toUpperCase();
        if (!key || RESERVED_COUPON_CODES.has(key)) continue;
        let n = typeof v === 'number' ? v : Number(v);
        if (!Number.isFinite(n)) continue;
        n = Math.max(0, Math.min(1, n));
        if (n <= 0) continue;
        out[key] = n;
    }
    return out;
}

/** Stored fractions → editable rows for event/org coupon UI. */
export function couponRowsFromRecord(rec: Record<string, number> | undefined): SummitCouponFormRow[] {
    const norm = normalizeCouponRecord(rec);
    const entries = Object.entries(norm).map(([code, frac]) => ({
        code,
        percentOff: Math.round(frac * 100),
    }));
    return entries.length ? entries : [{ code: '', percentOff: 0 }];
}

/** Editable rows → stored `coupons` object (empty object when none). */
export function recordFromCouponRows(rows: SummitCouponFormRow[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const row of rows) {
        const c = row.code.trim().toUpperCase();
        if (!c || RESERVED_COUPON_CODES.has(c)) continue;
        let p = Number(row.percentOff);
        if (!Number.isFinite(p)) p = 0;
        p = Math.max(0, Math.min(100, p));
        const frac = p / 100;
        if (frac <= 0) continue;
        out[c] = frac;
    }
    return out;
}

/** Last-resort ETB when org/event/form do not define `basePriceEtb`. */
export const SUMMIT_FALLBACK_BASE_PRICE_ETB = 1500;

/** Form `registrationSettings` fields used for list + per-role line pricing (server + UI). */
export type SummitFormRegistrationSettings = {
    basePriceEtb?: number;
    roles?: { label: string; translationKey?: string; price?: string }[];
    internalRoles?: { label: string; translationKey?: string; price?: string }[];
};

/**
 * Resolve one attendee/individual line price: role-specific `price` from form settings when present,
 * otherwise the merged list base (form `basePriceEtb` > event/org summit `basePriceEtb`).
 */
export function resolveLinePriceEtb(
    listBasePriceEtb: number,
    registrationSettings: SummitFormRegistrationSettings | null | undefined,
    roleLabel: string | null | undefined
): number {
    const rawList = Number(listBasePriceEtb);
    const list = Number.isFinite(rawList) && rawList >= 0 ? rawList : SUMMIT_FALLBACK_BASE_PRICE_ETB;
    const label = (roleLabel || '').trim();
    if (!label || !registrationSettings) return Math.round(list);
    const rows = [...(registrationSettings.roles || []), ...(registrationSettings.internalRoles || [])];
    const hit = rows.find((r) => r.label === label);
    if (!hit?.price) return Math.round(list);
    const n = Number(String(hit.price).replace(/,/g, '').trim());
    if (!Number.isFinite(n) || n < 0) return Math.round(list);
    return Math.round(n);
}

export const DEFAULT_SUMMIT_PAYMENT_METHODS: SummitPaymentMethodConfig[] = [
    {
        id: 'BRN',
        label: 'Berhan Bank',
        shortLabel: 'BR',
        type: 'bank',
        color: 'text-amber-600',
        bg: 'bg-orange-50',
        accountNumber: '2500060056250',
    },
    {
        id: 'TELEBIRR',
        label: 'Telebirr',
        shortLabel: 'TB',
        type: 'telebirr',
        color: 'text-green-600',
        bg: 'bg-green-50',
        merchantId: '514408',
    },
];

function parseSummitSettings(raw: unknown): SummitRegistrationSettings | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const o = raw as Record<string, unknown>;
    const sr = o.summitRegistration ?? o.summitDefaults;
    if (!sr || typeof sr !== 'object' || Array.isArray(sr)) return null;
    return sr as SummitRegistrationSettings;
}

function mergeSummitSettings(
    orgSettings: SummitRegistrationSettings | null,
    eventSettings: SummitRegistrationSettings | null
): SummitRegistrationSettings {
    const o = orgSettings || {};
    const e = eventSettings || {};
    return {
        basePriceEtb: e.basePriceEtb ?? o.basePriceEtb,
        supportEmail: e.supportEmail ?? o.supportEmail,
        registrationTitleI18n: { ...o.registrationTitleI18n, ...e.registrationTitleI18n },
        datesLineI18n: { ...o.datesLineI18n, ...e.datesLineI18n },
        placeLineI18n: { ...o.placeLineI18n, ...e.placeLineI18n },
        paymentMethods:
            e.paymentMethods && e.paymentMethods.length > 0 ? e.paymentMethods : o.paymentMethods,
        contacts: e.contacts && e.contacts.length > 0 ? e.contacts : o.contacts,
        coupons: {
            ...normalizeCouponRecord(o.coupons),
            ...normalizeCouponRecord(e.coupons),
        },
    };
}

function formatDatesFromEvent(event: Pick<Event, 'startsAt' | 'endsAt'> | null): string | null {
    if (!event?.startsAt) return null;
    const start = new Date(event.startsAt);
    const end = event.endsAt ? new Date(event.endsAt) : null;
    const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
    if (end && end.getTime() !== start.getTime()) {
        return `Dates: ${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
    }
    return `Date: ${start.toLocaleDateString('en-US', opts)}`;
}

export type SummitRegistrationClientPayload = {
    basePriceEtb: number;
    supportEmail: string | null;
    contacts: SummitContactInfo[];
    titleI18n: Record<Language, string>;
    datesLineI18n: Record<Language, string>;
    placeLineI18n: Record<Language, string>;
    paymentMethods: SummitPaymentMethodConfig[];
    /** When false, omit honorific/title (Pastor, Dr., …) on forms, lists, and badges. Default true if unset. */
    showTitleField?: boolean;
    enableGroup?: boolean;
    enableCoupons?: boolean;
    roles?: { label: string; translationKey?: string; price?: string }[];
    internalRoles?: { label: string; translationKey?: string; price?: string }[];
    coupons?: Record<string, number>;
    fields?: any[];
    logoUrl: string | null;
};

/** Display name with optional honorific, respecting form `showTitleField`. */
export function formatSummitPersonName(
    fullName: string,
    title: string | null | undefined,
    showTitleField: boolean
): string {
    if (!showTitleField) return (fullName || '').trim();
    const t = (title || '').trim();
    const n = (fullName || '').trim();
    if (!t) return n;
    return `${t} ${n}`.trim();
}

export function buildSummitClientPayload(
    org: { settings?: unknown; name: string },
    event: { name: string; startsAt: Date | null; endsAt: Date | null; settings: unknown } | null,
    /** When true, prefer formatting dates from event fields if lines missing */
    preferEventDates: boolean,
    formI18nMeta?: unknown,
    fields?: any[]
): SummitRegistrationClientPayload {
    const orgS = parseSummitSettings(org.settings);
    const evS = event ? parseSummitSettings(event.settings) : null;
    const merged = mergeSummitSettings(orgS, evS);

    const formMeta = formI18nMeta as any;
    const regSettings = formMeta?.registrationSettings;

    const landingSettings = parseLandingPageFromSettings(org.settings);
    const eventLandingSettings = event ? parseLandingPageFromSettings(event.settings) : null;
    const logoUrl = eventLandingSettings?.logoUrl || landingSettings?.logoUrl || DEFAULT_LANDING_LOGO;

    const basePriceEtb = regSettings?.basePriceEtb ?? merged.basePriceEtb ?? SUMMIT_FALLBACK_BASE_PRICE_ETB;
    const enableGroup = regSettings?.enableGroup !== false;
    const enableCoupons = regSettings?.enableCoupons !== false;
    const showTitleField = regSettings?.showTitleField !== false;
    const t = translations;

    const titleI18n = {} as Record<Language, string>;
    const datesLineI18n = {} as Record<Language, string>;
    const placeLineI18n = {} as Record<Language, string>;
    const langs: Language[] = ['en', 'am', 'or', 'ti'];

    for (const lang of langs) {
        titleI18n[lang] =
            merged.registrationTitleI18n?.[lang] ||
            (event
                ? `Registration | ${event.name}`
                : t[lang].title);

        const autoDates = preferEventDates && event ? formatDatesFromEvent(event) : null;
        datesLineI18n[lang] = merged.datesLineI18n?.[lang] || autoDates || t[lang].dates;

        placeLineI18n[lang] = merged.placeLineI18n?.[lang] || t[lang].place;
    }

    let paymentMethods =
        merged.paymentMethods && merged.paymentMethods.length > 0
            ? merged.paymentMethods
            : DEFAULT_SUMMIT_PAYMENT_METHODS;

    // Only apply form-level filtering to defaults if the event didn't explicitly provide custom bank accounts.
    if ((!merged.paymentMethods || merged.paymentMethods.length === 0) && regSettings?.paymentMethods && regSettings.paymentMethods.length > 0) {
        paymentMethods = DEFAULT_SUMMIT_PAYMENT_METHODS.filter(m => regSettings.paymentMethods.includes(m.id));
    }

    const mergedCoupons = normalizeCouponRecord(merged.coupons);
    const formCoupons = normalizeCouponRecord(regSettings?.coupons as Record<string, number> | undefined);
    const coupons = { ...mergedCoupons, ...formCoupons };

    return {
        basePriceEtb,
        supportEmail: merged.supportEmail ?? null,
        contacts: merged.contacts ?? [],
        titleI18n,
        datesLineI18n,
        placeLineI18n,
        paymentMethods,
        showTitleField,
        enableGroup,
        enableCoupons,
        roles: regSettings?.roles,
        internalRoles: regSettings?.internalRoles,
        coupons: Object.keys(coupons).length ? coupons : undefined,
        fields,
        logoUrl,
    };
}

/** List base price + form registration settings (for role-based line totals). */
export async function getSummitPricingForRegistrationApi(
    organizationId: string,
    eventId: string | null
): Promise<{
    listBasePriceEtb: number;
    registrationSettings: SummitFormRegistrationSettings | null;
}> {
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { settings: true },
    });
    const orgS = parseSummitSettings(org?.settings);

    if (!eventId) {
        return {
            listBasePriceEtb: orgS?.basePriceEtb ?? SUMMIT_FALLBACK_BASE_PRICE_ETB,
            registrationSettings: null,
        };
    }

    const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: {
            settings: true,
            registrationForm: {
                select: { i18nMeta: true },
            },
        },
    });

    const evS = parseSummitSettings(event?.settings);
    const merged = mergeSummitSettings(orgS, evS);

    const formMeta = event?.registrationForm?.i18nMeta as {
        registrationSettings?: SummitFormRegistrationSettings;
    } | null;
    const registrationSettings = formMeta?.registrationSettings ?? null;
    const formPrice = registrationSettings?.basePriceEtb;
    const listBasePriceEtb = formPrice ?? merged.basePriceEtb ?? SUMMIT_FALLBACK_BASE_PRICE_ETB;

    return { listBasePriceEtb, registrationSettings };
}

export async function getBasePriceEtbForSummitApi(
    organizationId: string,
    eventId: string | null
): Promise<number> {
    const { listBasePriceEtb } = await getSummitPricingForRegistrationApi(organizationId, eventId);
    return listBasePriceEtb;
}

export type SummitEmailBranding = {
    eventTitle: string;
    datesLine: string;
    placeLine: string;
    supportEmail: string | null;
    yearLabel: string;
};

export async function getSummitEmailBranding(
    organizationId: string | null,
    eventId: string | null
): Promise<SummitEmailBranding> {
    const yearLabel = process.env.EVENT_YEAR || String(new Date().getFullYear());

    if (!organizationId) {
        return {
            eventTitle: process.env.EVENT_NAME || 'Church Leadership Summit',
            datesLine: process.env.EVENT_DATE || 'TBD',
            placeLine: process.env.EVENT_LOCATION || '',
            supportEmail: process.env.SUPPORT_EMAIL || null,
            yearLabel,
        };
    }

    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { settings: true, name: true },
    });

    let event: { name: string; startsAt: Date | null; endsAt: Date | null; settings: unknown } | null =
        null;
    if (eventId) {
        event = await prisma.event.findUnique({
            where: { id: eventId },
            select: { name: true, startsAt: true, endsAt: true, settings: true },
        });
    }

    const payload = buildSummitClientPayload(
        { settings: org?.settings, name: org?.name || '' },
        event,
        true
    );

    return {
        eventTitle: payload.titleI18n.en,
        datesLine: payload.datesLineI18n.en,
        placeLine: payload.placeLineI18n.en,
        supportEmail: payload.supportEmail,
        yearLabel,
    };
}
