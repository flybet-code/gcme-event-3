'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_REGISTRATION_FORM_ID_KEY } from '@/lib/org-settings';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { AuthGate } from '@/components/AuthGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Pencil, Trash2, Plus, X, Upload, ImageIcon, Calendar, Layout, List, ExternalLink, Globe } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { compressImage, isImageFile, formatFileSize } from '@/lib/image-compression';
import {
    recordFromCouponRows,
    type SummitCouponFormRow,
    type SummitPaymentMethodConfig,
    type SummitRegistrationSettings,
} from '@/lib/summit-registration-config';
import {
    buildLandingPageSettingsFromInputs,
    landingFormFieldsFromSettings,
    type LandingPageFormFields,
} from '@/lib/landing-page-config';

type EventRow = { id: string; name: string; slug: string; registrationForm: { id: string; name: string } | null };

type FormOption = { id: string; name: string };

function slugify(name: string) {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .replace(/-+/g, '-');
}

type BankEntry = { label: string; accountNumber: string; accountName?: string };
type ContactEntry = { name: string; phone: string; email: string };

const PRESET_BANKS = [
    { label: 'CBE', full: 'Commercial Bank of Ethiopia', bg: 'bg-blue-50', color: 'text-blue-700' },
    { label: 'Abyssinia', full: 'Bank of Abyssinia', bg: 'bg-yellow-50', color: 'text-yellow-700' },
    { label: 'Telebirr', full: 'Telebirr', bg: 'bg-green-50', color: 'text-green-700' },
    { label: 'Berhan Bank', full: 'Berhan Bank', bg: 'bg-orange-50', color: 'text-amber-700' },
    { label: 'Awash Bank', full: 'Awash Bank', bg: 'bg-purple-50', color: 'text-purple-700' },
    { label: 'Dashen Bank', full: 'Dashen Bank', bg: 'bg-indigo-50', color: 'text-indigo-700' },
    { label: 'Cooperative Bank', full: 'Cooperative Bank of Oromia', bg: 'bg-teal-50', color: 'text-teal-700' },
];

function shortLabelFromBankLabel(label: string): string {
    const w = label.trim().split(/\s+/).filter(Boolean);
    if (w.length >= 2) return (w[0][0] + w[1][0]).toUpperCase();
    const t = label.trim();
    if (t.length >= 2) return t.slice(0, 2).toUpperCase();
    return 'BR';
}

const BANK_COLORS: Record<string, { color: string; bg: string }> = {
    'cbe': { color: 'text-blue-700', bg: 'bg-blue-50' },
    'commercial': { color: 'text-blue-700', bg: 'bg-blue-50' },
    'abyssinia': { color: 'text-yellow-700', bg: 'bg-yellow-50' },
    'berhan': { color: 'text-amber-600', bg: 'bg-orange-50' },
    'awash': { color: 'text-purple-700', bg: 'bg-purple-50' },
    'dashen': { color: 'text-indigo-700', bg: 'bg-indigo-50' },
    'cooperative': { color: 'text-teal-700', bg: 'bg-teal-50' },
    'telebirr': { color: 'text-green-600', bg: 'bg-green-50' },
};

function bankColors(label: string): { color: string; bg: string } {
    const key = label.toLowerCase();
    for (const k of Object.keys(BANK_COLORS)) {
        if (key.includes(k)) return BANK_COLORS[k];
    }
    return { color: 'text-gray-600', bg: 'bg-gray-50' };
}

function buildSummitRegistrationFromInputs(p: {
    regTitleEn: string;
    regTitleAm: string;
    datesLineEn: string;
    datesLineAm: string;
    placeLineEn: string;
    placeLineAm: string;
    supportEmail: string;
    bankAccounts: BankEntry[];
    telebirrMerchant: string;
    contacts: ContactEntry[];
    couponRows: SummitCouponFormRow[];
}): SummitRegistrationSettings | null {
    const summit: SummitRegistrationSettings = {};

    const titleEn = p.regTitleEn.trim();
    const titleAm = p.regTitleAm.trim();
    if (titleEn || titleAm) {
        summit.registrationTitleI18n = {};
        if (titleEn) summit.registrationTitleI18n.en = titleEn;
        if (titleAm) summit.registrationTitleI18n.am = titleAm;
    }

    const datesEn = p.datesLineEn.trim();
    const datesAm = p.datesLineAm.trim();
    if (datesEn || datesAm) {
        summit.datesLineI18n = {};
        if (datesEn) summit.datesLineI18n.en = datesEn;
        if (datesAm) summit.datesLineI18n.am = datesAm;
    }

    const placeEn = p.placeLineEn.trim();
    const placeAm = p.placeLineAm.trim();
    if (placeEn || placeAm) {
        summit.placeLineI18n = {};
        if (placeEn) summit.placeLineI18n.en = placeEn;
        if (placeAm) summit.placeLineI18n.am = placeAm;
    }

    const support = p.supportEmail.trim();
    if (support) summit.supportEmail = support;

    const paymentMethods: SummitPaymentMethodConfig[] = [];

    // Multiple bank accounts
    p.bankAccounts.forEach((bank, idx) => {
        const label = bank.label.trim();
        const acc = bank.accountNumber.trim();
        if (!label && !acc) return;
        const { color, bg } = bankColors(label);
        const isTelebirr = label.toLowerCase().includes('telebirr');
        paymentMethods.push({
            id: isTelebirr ? 'TELEBIRR' : `BANK_${idx}`,
            label: label || `Bank ${idx + 1}`,
            shortLabel: shortLabelFromBankLabel(label || `Bank ${idx + 1}`),
            type: isTelebirr ? 'telebirr' : 'bank',
            color,
            bg,
            ...(acc ? (isTelebirr ? { merchantId: acc } : { accountNumber: acc }) : {}),
            ...(bank.accountName?.trim() ? { accountName: bank.accountName.trim() } : {}),
        });
    });

    const tb = p.telebirrMerchant.trim();
    if (tb && !paymentMethods.some((m) => m.type === 'telebirr')) {
        paymentMethods.push({
            id: 'TELEBIRR',
            label: 'Telebirr',
            shortLabel: 'TB',
            type: 'telebirr',
            color: 'text-green-600',
            bg: 'bg-green-50',
            merchantId: tb,
        });
    }
    if (paymentMethods.length) summit.paymentMethods = paymentMethods;

    const contacts = p.contacts
        .map((c) => ({
            name: c.name.trim(),
            phone: c.phone.trim(),
            email: c.email.trim(),
        }))
        .filter((c) => c.name || c.phone || c.email);
    if (contacts.length) summit.contacts = contacts;

    const couponRec = recordFromCouponRows(p.couponRows);
    if (Object.keys(couponRec).length) summit.coupons = couponRec;

    const hasAny =
        summit.registrationTitleI18n ||
        summit.datesLineI18n ||
        summit.placeLineI18n ||
        summit.supportEmail ||
        summit.paymentMethods ||
        summit.contacts ||
        summit.coupons;
    return hasAny ? summit : null;
}

export default function OrgEventsPage() {
    const params = useParams();
    const orgSlug = params.orgSlug as string;
    const { data: session, isPending } = authClient.useSession();
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    const [events, setEvents] = useState<EventRow[]>([]);
    const [forms, setForms] = useState<FormOption[]>([]);

    const [createName, setCreateName] = useState('');
    const [createSlug, setCreateSlug] = useState('');
    const [slugTouched, setSlugTouched] = useState(false);
    const [registrationFormId, setRegistrationFormId] = useState('');
    /** User chose "None" in the dropdown (send null); omit key when false and empty so the server can apply org default. */
    const [explicitNoForm, setExplicitNoForm] = useState(false);
    const [orgDefaultFormId, setOrgDefaultFormId] = useState<string | null>(null);
    const defaultFormAppliedRef = useRef(false);
    const [createSubmitting, setCreateSubmitting] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [createSuccess, setCreateSuccess] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const [regTitleEn, setRegTitleEn] = useState('');
    const [regTitleAm, setRegTitleAm] = useState('');
    const [datesLineEn, setDatesLineEn] = useState('');
    const [datesLineAm, setDatesLineAm] = useState('');
    const [placeLineEn, setPlaceLineEn] = useState('');
    const [placeLineAm, setPlaceLineAm] = useState('');
    const [startsAtLocal, setStartsAtLocal] = useState('');
    const [endsAtLocal, setEndsAtLocal] = useState('');
    const [supportEmail, setSupportEmail] = useState('');
    const [bankAccounts, setBankAccounts] = useState<BankEntry[]>([{ label: '', accountNumber: '', accountName: '' }]);
    const [telebirrMerchant, setTelebirrMerchant] = useState('');
    const [contacts, setContacts] = useState<ContactEntry[]>([{ name: '', phone: '', email: '' }]);
    const [couponRows, setCouponRows] = useState<SummitCouponFormRow[]>([{ code: '', percentOff: 0 }]);

    const [landingForm, setLandingForm] = useState<LandingPageFormFields>(() =>
        landingFormFieldsFromSettings(undefined)
    );
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingHero, setUploadingHero] = useState(false);

    const logoInputRef = useRef<HTMLInputElement>(null);
    const heroInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (file: File, type: 'logo' | 'hero') => {
        const isLogo = type === 'logo';
        if (isLogo) setUploadingLogo(true);
        else setUploadingHero(true);

        try {
            // Compress image if it's an image file
            let fileToUpload = file;
            if (isImageFile(file)) {
                const originalSize = formatFileSize(file.size);
                toast.info(`Compressing image (${originalSize})...`);
                
                fileToUpload = await compressImage(file, {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 2000,
                    quality: 0.85,
                });
                
                const compressedSize = formatFileSize(fileToUpload.size);
                toast.success(`Image compressed: ${originalSize} → ${compressedSize}`);
            }

            const formData = new FormData();
            formData.append('file', fileToUpload);

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();
            if (data.success && data.filePath) {
                setLandingForm((prev) => ({
                    ...prev,
                    [isLogo ? 'logoUrl' : 'heroImage']: data.filePath,
                }));
                toast.success('Image uploaded successfully!');
            } else {
                toast.error(data.message || 'Upload failed');
            }
        } catch (err) {
            console.error('Upload error:', err);
            toast.error(err instanceof Error ? err.message : 'An error occurred during upload.');
        } finally {
            if (isLogo) setUploadingLogo(false);
            else setUploadingHero(false);
        }
    };

    const loadEvents = useCallback(() => {
        if (!orgSlug) return;
        fetch(`/api/events?orgSlug=${encodeURIComponent(orgSlug)}`, { credentials: 'include' })
            .then((r) => r.json())
            .then((d) => {
                if (d.events) setEvents(d.events);
            })
            .catch(() => setEvents([]));
    }, [orgSlug]);

    useEffect(() => {
        if (!sessionUserId || !orgSlug) return;
        loadEvents();
    }, [sessionUserId, orgSlug, loadEvents]);

    useEffect(() => {
        if (!sessionUserId || !orgSlug) return;
        fetch(`/api/forms?orgSlug=${encodeURIComponent(orgSlug)}`, { credentials: 'include' })
            .then((r) => r.json())
            .then((d) => {
                if (d.forms) setForms(d.forms.map((f: { id: string; name: string }) => ({ id: f.id, name: f.name })));
            })
            .catch(() => setForms([]));
    }, [sessionUserId, orgSlug]);

    useEffect(() => {
        defaultFormAppliedRef.current = false;
        setOrgDefaultFormId(null);
        if (!sessionUserId || !orgSlug) return;
        fetch('/api/orgs', { credentials: 'include' })
            .then((r) => r.json())
            .then((d) => {
                const org = d.organizations?.find((o: { slug: string }) => o.slug === orgSlug);
                const settings = org?.settings as Record<string, unknown> | undefined;
                const id = settings?.[DEFAULT_REGISTRATION_FORM_ID_KEY];
                setOrgDefaultFormId(typeof id === 'string' && id.trim() ? id.trim() : null);
            })
            .catch(() => setOrgDefaultFormId(null));
    }, [sessionUserId, orgSlug]);

    useEffect(() => {
        if (defaultFormAppliedRef.current || !orgDefaultFormId || forms.length === 0) return;
        if (!forms.some((f) => f.id === orgDefaultFormId)) return;
        setRegistrationFormId(orgDefaultFormId);
        setExplicitNoForm(false);
        defaultFormAppliedRef.current = true;
    }, [orgDefaultFormId, forms]);

    useEffect(() => {
        if (!slugTouched && createName) {
            setCreateSlug(slugify(createName));
        }
    }, [createName, slugTouched]);

    async function handleCreateEvent(e: React.FormEvent) {
        e.preventDefault();
        setCreateError(null);
        setCreateSuccess(null);
        const name = createName.trim();
        const slug = (createSlug.trim() || slugify(createName)).replace(/^-|-$/g, '');
        if (!name || !slug) {
            setCreateError('Name and URL slug are required.');
            return;
        }
        setCreateSubmitting(true);
        try {
            const body: Record<string, unknown> = { orgSlug, name, slug };
            if (explicitNoForm) {
                body.registrationFormId = null;
            } else if (registrationFormId) {
                body.registrationFormId = registrationFormId;
            }

            if (startsAtLocal.trim()) {
                const d = new Date(startsAtLocal);
                if (!Number.isNaN(d.getTime())) body.startsAt = d.toISOString();
            }
            if (endsAtLocal.trim()) {
                const d = new Date(endsAtLocal);
                if (!Number.isNaN(d.getTime())) body.endsAt = d.toISOString();
            }

            const summitRegistration = buildSummitRegistrationFromInputs({
                regTitleEn,
                regTitleAm,
                datesLineEn,
                datesLineAm,
                placeLineEn,
                placeLineAm,
                supportEmail,
                bankAccounts,
                telebirrMerchant,
                contacts,
                couponRows,
            });
            const landingPage = buildLandingPageSettingsFromInputs({
                ...landingForm,
                locationLineEn: placeLineEn.trim() || landingForm.locationLineEn,
                locationLineAm: placeLineAm.trim() || landingForm.locationLineAm,
            });
            const settings: Record<string, unknown> = {};
            if (summitRegistration) settings.summitRegistration = summitRegistration;
            if (landingPage) settings.landingPage = landingPage;
            if (Object.keys(settings).length) body.settings = settings;

            const res = await fetch('/api/events', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setCreateError((data as { error?: string }).error || 'Could not create event');
                toast.error((data as { error?: string }).error || 'Could not create event');
                return;
            }
            setCreateSuccess(`Created "${name}".`);
            toast.success(`Created "${name}".`);
            setCreateName('');
            setCreateSlug('');
            setSlugTouched(false);
            setExplicitNoForm(false);
            setRegTitleEn('');
            setRegTitleAm('');
            setDatesLineEn('');
            setDatesLineAm('');
            setPlaceLineEn('');
            setPlaceLineAm('');
            setStartsAtLocal('');
            setEndsAtLocal('');
            setSupportEmail('');
            setBankAccounts([{ label: '', accountNumber: '', accountName: '' }]);
            setTelebirrMerchant('');
            setContacts([{ name: '', phone: '', email: '' }]);
            setCouponRows([{ code: '', percentOff: 0 }]);
            setLandingForm(landingFormFieldsFromSettings(undefined));
            if (orgDefaultFormId && forms.some((f) => f.id === orgDefaultFormId)) {
                setRegistrationFormId(orgDefaultFormId);
                defaultFormAppliedRef.current = true;
            } else {
                setRegistrationFormId('');
                defaultFormAppliedRef.current = false;
            }
            loadEvents();
        } finally {
            setCreateSubmitting(false);
        }
    }

    async function handleDeleteEvent(id: string, displayName: string) {
        if (!confirm(`Delete event "${displayName}"? This cannot be undone.`)) return;
        setDeletingId(id);
        try {
            const res = await fetch(
                `/api/events/${id}?orgSlug=${encodeURIComponent(orgSlug)}`,
                { method: 'DELETE', credentials: 'include' }
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error((data as { error?: string }).error || 'Could not delete event');
                return;
            }
            toast.success(`Deleted "${displayName}".`);
            loadEvents();
        } finally {
            setDeletingId(null);
        }
    }

    if (!isPending && !session) {
        return <AuthGate variant="login" />;
    }

    return (
        <div className="p-8 max-w-7xl">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Events</h1>
                <p className="text-gray-500 mt-1">Manage registration forms and landing pages for {orgSlug}</p>
            </header>

            <Tabs defaultValue="list" className="space-y-6">
                <TabsList className="bg-gray-100/80 p-1">
                    <TabsTrigger value="list" className="gap-2">
                        <List className="w-4 h-4" />
                        All Events
                    </TabsTrigger>
                    <TabsTrigger value="create" className="gap-2">
                        <Plus className="w-4 h-4" />
                        Create New
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="list" className="space-y-4 outline-none">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-lg font-semibold text-gray-900">Your events</h2>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{events.length} total</span>
                    </div>
                    {events.length === 0 ? (
                        <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-3xl bg-white">
                            <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                            <p className="text-gray-500 font-medium">No events yet.</p>
                            <p className="text-sm text-gray-400 mt-1">Create your first event to get started.</p>
                        </div>
                    ) : (
                        <ul className="grid gap-4">
                            {events.map((ev) => (
                                <li
                                    key={ev.id}
                                    className="group relative border border-gray-100 rounded-2xl p-5 bg-white hover:border-[#22C55E]/30 hover:shadow-xl hover:shadow-[#22C55E]/5 transition-all duration-300"
                                >
                                    <div className="flex flex-wrap justify-between items-start gap-4">
                                        <div className="space-y-1 flex-1 min-w-[240px]">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-xl font-bold text-gray-900 leading-tight group-hover:text-[#22C55E] transition-colors">
                                                    {ev.name}
                                                </h3>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm">
                                                <span className="text-gray-400 font-mono bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                                    /{ev.slug}
                                                </span>
                                                {!ev.registrationForm && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded uppercase tracking-wider">
                                                        No form attached
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={`/${orgSlug}/events/${ev.id}`}
                                                className="p-2 text-gray-400 hover:text-[#22C55E] hover:bg-[#F0FDF4] rounded-xl transition-all"
                                                title="Edit Event"
                                            >
                                                <Pencil className="w-5 h-5" />
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteEvent(ev.id, ev.name)}
                                                disabled={deletingId === ev.id}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                aria-label={`Delete ${ev.name}`}
                                            >
                                                {deletingId === ev.id ? (
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-5 h-5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 pt-4 border-t border-gray-50">
                                        {ev.registrationForm ? (
                                            <>
                                                <a
                                                    href={`/${orgSlug}/${ev.slug}/register`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#22C55E] hover:underline hover:opacity-80 transition-all"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                    Registration Page
                                                </a>
                                                <a
                                                    href={`/${orgSlug}/${ev.slug}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-[#22C55E] transition-all"
                                                >
                                                    <Globe className="w-4 h-4" />
                                                    Landing Page
                                                </a>
                                                <Link
                                                    href={`/${orgSlug}/forms/${ev.registrationForm.id}`}
                                                    className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-gray-600 transition-all"
                                                >
                                                    <Layout className="w-4 h-4" />
                                                    Edit Form
                                                </Link>
                                            </>
                                        ) : (
                                                <a
                                                    href={`/${orgSlug}/${ev.slug}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-[#22C55E] transition-all"
                                                >
                                                    <Globe className="w-4 h-4" />
                                                    Landing Page
                                                </a>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </TabsContent>

                <TabsContent value="create" className="outline-none">
                    <section className="border border-gray-100 rounded-3xl p-8 bg-white shadow-sm">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-1">Create new event</h2>
                            <p className="text-sm text-gray-500">
                                Setup a registration form and marketing landing page for your next conference or summit. The registration form field pre-selects your organization default.
                            </p>
                        </div>
                        <form onSubmit={handleCreateEvent} className="space-y-4">
                    {createError && (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                            {createError}
                        </p>
                    )}
                    {createSuccess && (
                        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                            {createSuccess}
                        </p>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="event-name" className="text-gray-700 font-semibold">Event name</Label>
                        <Input
                            id="event-name"
                            value={createName}
                            onChange={(ev) => setCreateName(ev.target.value)}
                            placeholder="e.g. Annual conference"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="event-slug" className="text-gray-700 font-semibold">URL slug</Label>
                        <Input
                            id="event-slug"
                            value={createSlug}
                            onChange={(ev) => {
                                setSlugTouched(true);
                                setCreateSlug(ev.target.value);
                            }}
                            placeholder="annual-conference"
                            className="font-mono text-sm"
                            required
                        />
                        <p className="text-xs text-gray-400">
                            Public registration: /{orgSlug}/<span className="font-mono">{createSlug || 'your-slug'}</span>
                            /register
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="event-form" className="text-gray-700 font-semibold">Registration form</Label>
                        <select
                            id="event-form"
                            value={registrationFormId}
                            onChange={(ev) => {
                                const v = ev.target.value;
                                setRegistrationFormId(v);
                                setExplicitNoForm(v === '');
                            }}
                            className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <option value="">None — attach later</option>
                            {forms.map((f) => (
                                <option key={f.id} value={f.id}>
                                    {f.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500">
                            <Link href={`/${orgSlug}/forms`} className="text-[#22C55E] font-medium hover:underline">
                                Manage forms
                            </Link>{' '}
                            to create or edit forms.
                        </p>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 space-y-4">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900">Registration page &amp; emails</h3>
                            <p className="text-xs text-gray-500 mt-1">
                                Optional. These values appear on the public registration page (including the default
                                summit-style form) and in confirmation emails. Leave blank to use organization defaults
                                or event name where applicable.
                            </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="reg-title-en" className="text-gray-700 font-semibold">Registration title (English)</Label>
                                <Input
                                    id="reg-title-en"
                                    value={regTitleEn}
                                    onChange={(ev) => setRegTitleEn(ev.target.value)}
                                    placeholder="e.g. Registration | Church Leadership Summit"
                                />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="reg-title-am" className="text-gray-700 font-semibold">Registration title (አማርኛ, optional)</Label>
                                <Input
                                    id="reg-title-am"
                                    value={regTitleAm}
                                    onChange={(ev) => setRegTitleAm(ev.target.value)}
                                    placeholder="Optional Amharic title"
                                />
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="event-starts" className="text-gray-700 font-semibold">Start (date &amp; time)</Label>
                                <Input
                                    id="event-starts"
                                    type="datetime-local"
                                    value={startsAtLocal}
                                    onChange={(ev) => setStartsAtLocal(ev.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="event-ends" className="text-gray-700 font-semibold">End (date &amp; time)</Label>
                                <Input
                                    id="event-ends"
                                    type="datetime-local"
                                    value={endsAtLocal}
                                    onChange={(ev) => setEndsAtLocal(ev.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="dates-line-en" className="text-gray-700 font-semibold">Dates line (English, optional)</Label>
                                <Textarea
                                    id="dates-line-en"
                                    value={datesLineEn}
                                    onChange={(ev) => setDatesLineEn(ev.target.value)}
                                    placeholder="e.g. April 25–26, 2026 — if empty, dates may be derived from start/end above."
                                    rows={2}
                                    className="resize-y min-h-[2.5rem]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="dates-line-am" className="text-gray-700 font-semibold">Dates line (አማርኛ, optional)</Label>
                                <Textarea
                                    id="dates-line-am"
                                    value={datesLineAm}
                                    onChange={(ev) => setDatesLineAm(ev.target.value)}
                                    rows={2}
                                    className="resize-y min-h-[2.5rem]"
                                />
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="place-en" className="text-gray-700 font-semibold">Place / location (English)</Label>
                                <Input
                                    id="place-en"
                                    value={placeLineEn}
                                    onChange={(ev) => setPlaceLineEn(ev.target.value)}
                                    placeholder="e.g. Beza International Church, Addis Ababa"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="place-am" className="text-gray-700 font-semibold">Place (አማርኛ, optional)</Label>
                                <Input
                                    id="place-am"
                                    value={placeLineAm}
                                    onChange={(ev) => setPlaceLineAm(ev.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="support-email" className="text-gray-700 font-semibold">Support email</Label>
                            <Input
                                id="support-email"
                                type="email"
                                value={supportEmail}
                                onChange={(ev) => setSupportEmail(ev.target.value)}
                                placeholder="events@yourorg.org"
                            />
                            <p className="text-xs text-gray-500">
                                Price is managed in the selected registration form settings.
                            </p>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold text-gray-700">Discount coupon codes</Label>
                                <button
                                    type="button"
                                    onClick={() => setCouponRows((prev) => [...prev, { code: '', percentOff: 0 }])}
                                    className="inline-flex items-center gap-1 text-xs text-[#22C55E] font-bold hover:underline"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add code
                                </button>
                            </div>
                            <p className="text-xs text-gray-500">
                                Only codes you configure for this organization and event apply. Reserved words CASH and
                                BANK cannot be used as coupon codes.
                            </p>
                            <div className="space-y-2">
                                {couponRows.map((row, idx) => (
                                    <div
                                        key={idx}
                                        className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2 items-end p-3 bg-gray-50/70 border border-gray-100 rounded-xl"
                                    >
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide">
                                                Code
                                            </label>
                                            <Input
                                                value={row.code}
                                                onChange={(ev) =>
                                                    setCouponRows((prev) =>
                                                        prev.map((r, i) => (i === idx ? { ...r, code: ev.target.value } : r))
                                                    )
                                                }
                                                placeholder="e.g. EARLYBIRD"
                                                className="h-9 text-sm font-mono uppercase"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide">
                                                % off
                                            </label>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={100}
                                                value={row.percentOff === 0 ? '' : row.percentOff}
                                                onChange={(ev) => {
                                                    const raw = ev.target.value;
                                                    const n = raw === '' ? 0 : Number(raw);
                                                    setCouponRows((prev) =>
                                                        prev.map((r, i) =>
                                                            i === idx ? { ...r, percentOff: Number.isFinite(n) ? n : 0 } : r
                                                        )
                                                    );
                                                }}
                                                placeholder="0–100"
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setCouponRows((prev) => prev.filter((_, i) => i !== idx))}
                                            disabled={couponRows.length === 1}
                                            className="mb-0.5 p-1.5 text-gray-300 hover:text-red-500 disabled:opacity-30 rounded-lg transition-colors"
                                            aria-label="Remove coupon row"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold text-gray-700">Contact list (shown on registration page)</Label>
                                <button
                                    type="button"
                                    onClick={() => setContacts((prev) => [...prev, { name: '', phone: '', email: '' }])}
                                    className="inline-flex items-center gap-1 text-xs text-[#22C55E] font-bold hover:underline"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add contact
                                </button>
                            </div>
                            <div className="space-y-2">
                                {contacts.map((contact, idx) => (
                                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start p-3 bg-gray-50/70 border border-gray-100 rounded-xl">
                                        <Input
                                            value={contact.name}
                                            onChange={(ev) =>
                                                setContacts((prev) => prev.map((c, i) => (i === idx ? { ...c, name: ev.target.value } : c)))
                                            }
                                            placeholder="Contact name"
                                            className="h-9 text-sm"
                                        />
                                        <Input
                                            value={contact.phone}
                                            onChange={(ev) =>
                                                setContacts((prev) => prev.map((c, i) => (i === idx ? { ...c, phone: ev.target.value } : c)))
                                            }
                                            placeholder="Phone number"
                                            className="h-9 text-sm"
                                        />
                                        <Input
                                            value={contact.email}
                                            onChange={(ev) =>
                                                setContacts((prev) => prev.map((c, i) => (i === idx ? { ...c, email: ev.target.value } : c)))
                                            }
                                            placeholder="Email (optional)"
                                            className="h-9 text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setContacts((prev) => prev.filter((_, i) => i !== idx))}
                                            disabled={contacts.length === 1}
                                            className="mt-1 p-1.5 text-gray-300 hover:text-red-500 disabled:opacity-30 rounded-lg transition-colors"
                                            aria-label="Remove contact"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* ── Multi-bank accounts ── */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold text-gray-700">Bank Accounts (shown to registrants)</Label>
                                <button
                                    type="button"
                                    onClick={() => setBankAccounts((prev) => [...prev, { label: '', accountNumber: '', accountName: '' }])}
                                    className="inline-flex items-center gap-1 text-xs text-[#22C55E] font-bold hover:underline"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add bank
                                </button>
                            </div>

                            {/* Preset quick-add chips */}
                            <div className="flex flex-wrap gap-1.5">
                                {PRESET_BANKS.map((b) => (
                                    <button
                                        key={b.label}
                                        type="button"
                                        onClick={() => setBankAccounts((prev) => [...prev, { label: b.full, accountNumber: '', accountName: '' }])}
                                        className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 hover:bg-[#F0FDF4] hover:border-[#22C55E]/40 text-gray-600 transition-all"
                                    >
                                        + {b.label}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-2">
                                {bankAccounts.map((bank, idx) => (
                                    <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start p-3 bg-gray-50/70 border border-gray-100 rounded-xl">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide">Bank name</label>
                                            <Input
                                                value={bank.label}
                                                onChange={(ev) => setBankAccounts((prev) => prev.map((b, i) => i === idx ? { ...b, label: ev.target.value } : b))}
                                                placeholder="e.g. CBE, Abyssinia"
                                                className="h-9 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide">Account number</label>
                                            <Input
                                                value={bank.accountNumber}
                                                onChange={(ev) => setBankAccounts((prev) => prev.map((b, i) => i === idx ? { ...b, accountNumber: ev.target.value } : b))}
                                                placeholder="Account / wallet ID"
                                                className="h-9 text-sm font-mono"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setBankAccounts((prev) => prev.filter((_, i) => i !== idx))}
                                            disabled={bankAccounts.length === 1}
                                            className="mt-6 p-1.5 text-gray-300 hover:text-red-500 disabled:opacity-30 rounded-lg transition-colors"
                                            aria-label="Remove bank"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Telebirr merchant ID (separate, optional) */}
                        <div className="space-y-2">
                            <Label htmlFor="telebirr">Telebirr merchant / wallet ID</Label>
                            <Input
                                id="telebirr"
                                value={telebirrMerchant}
                                onChange={(ev) => setTelebirrMerchant(ev.target.value)}
                                placeholder="e.g. merchant id for Telebirr checkout"
                            />
                            <p className="text-[10px] text-gray-400">Leave blank if you added Telebirr above as a bank account entry.</p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 space-y-4">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900">Marketing landing page</h3>
                            <p className="text-xs text-gray-500 mt-1">
                                Optional hero for{' '}
                                <span className="font-mono">
                                    /{orgSlug}/{createSlug || 'event-slug'}/landing
                                </span>
                                . Merged with organization defaults from Settings. Use full URLs or paths under /public
                                (e.g. /assets/…).
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lp-logo" className="text-gray-700 font-semibold flex items-center gap-2">
                                <Plus className="w-3.5 h-3.5 text-[#22C55E]" /> Logo URL
                            </Label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Input
                                        id="lp-logo"
                                        value={landingForm.logoUrl}
                                        onChange={(ev) =>
                                            setLandingForm((p) => ({ ...p, logoUrl: ev.target.value }))
                                        }
                                        placeholder="/assets/cls_2025/logo_gcme.png"
                                    />
                                    {landingForm.logoUrl && (
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img draggable={false} src={landingForm.logoUrl} alt="Logo preview" className="h-6 w-auto rounded border border-gray-100 bg-white" />
                                        </div>
                                    )}
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-9 px-3 border-dashed border-gray-300 hover:border-[#22C55E] hover:bg-[#F0FDF4] transition-all"
                                    onClick={() => logoInputRef.current?.click()}
                                    disabled={uploadingLogo}
                                >
                                    {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-1 text-[#22C55E]" />}
                                    Upload
                                </Button>
                                <input
                                    type="file"
                                    ref={logoInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileUpload(file, 'logo');
                                    }}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lp-hero" className="text-gray-700 font-semibold flex items-center gap-2">
                                <ImageIcon className="w-3.5 h-3.5 text-[#22C55E]" /> Hero image (Side Panel)
                            </Label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Input
                                        id="lp-hero"
                                        value={landingForm.heroImage}
                                        onChange={(ev) =>
                                            setLandingForm((p) => ({ ...p, heroImage: ev.target.value }))
                                        }
                                        placeholder="Image URL or path..."
                                    />
                                    {landingForm.heroImage && (
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img draggable={false} src={landingForm.heroImage} alt="Hero preview" className="h-6 w-auto rounded border border-gray-100 bg-white" />
                                        </div>
                                    )}
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-9 px-3 border-dashed border-gray-300 hover:border-[#22C55E] hover:bg-[#F0FDF4] transition-all"
                                    onClick={() => heroInputRef.current?.click()}
                                    disabled={uploadingHero}
                                >
                                    {uploadingHero ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-1 text-[#22C55E]" />}
                                    Upload
                                </Button>
                                <input
                                    type="file"
                                    ref={heroInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFileUpload(file, 'hero');
                                    }}
                                />
                            </div>
                            <p className="text-[10px] text-gray-400">Shown on the left/side panel of the public landing page.</p>
                        </div>
                        <p className="text-xs text-gray-500">
                            Location for landing date line is synced from Registration page &amp; emails section (Place / location EN + AM).
                        </p>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="lp-h-en" className="text-gray-700 font-semibold">Headline (English)</Label>
                                <Textarea
                                    id="lp-h-en"
                                    value={landingForm.headlineEn}
                                    onChange={(ev) =>
                                        setLandingForm((p) => ({ ...p, headlineEn: ev.target.value }))
                                    }
                                    placeholder="One line or multiple lines"
                                    rows={2}
                                    className="resize-y"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lp-h-am" className="text-gray-700 font-semibold">Headline (አማርኛ)</Label>
                                <Textarea
                                    id="lp-h-am"
                                    value={landingForm.headlineAm}
                                    onChange={(ev) =>
                                        setLandingForm((p) => ({ ...p, headlineAm: ev.target.value }))
                                    }
                                    rows={2}
                                    className="resize-y"
                                />
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="lp-d-en" className="text-gray-700 font-semibold">Description (English)</Label>
                                <Textarea
                                    id="lp-d-en"
                                    value={landingForm.descriptionEn}
                                    onChange={(ev) =>
                                        setLandingForm((p) => ({ ...p, descriptionEn: ev.target.value }))
                                    }
                                    rows={2}
                                    className="resize-y"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lp-d-am" className="text-gray-700 font-semibold">Description (አማርኛ)</Label>
                                <Textarea
                                    id="lp-d-am"
                                    value={landingForm.descriptionAm}
                                    onChange={(ev) =>
                                        setLandingForm((p) => ({ ...p, descriptionAm: ev.target.value }))
                                    }
                                    rows={2}
                                    className="resize-y"
                                />
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="lp-qs-en" className="text-gray-700 font-semibold">Quote source (English)</Label>
                                <Input
                                    id="lp-qs-en"
                                    value={landingForm.quoteSourceEn}
                                    onChange={(ev) =>
                                        setLandingForm((p) => ({ ...p, quoteSourceEn: ev.target.value }))
                                    }
                                    placeholder="Romans 12:2"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lp-qs-am" className="text-gray-700 font-semibold">Quote source (አማርኛ)</Label>
                                <Input
                                    id="lp-qs-am"
                                    value={landingForm.quoteSourceAm}
                                    onChange={(ev) =>
                                        setLandingForm((p) => ({ ...p, quoteSourceAm: ev.target.value }))
                                    }
                                />
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="lp-qt-en" className="text-gray-700 font-semibold">Quote text (English)</Label>
                                <Input
                                    id="lp-qt-en"
                                    value={landingForm.quoteTextEn}
                                    onChange={(ev) =>
                                        setLandingForm((p) => ({ ...p, quoteTextEn: ev.target.value }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lp-qt-am" className="text-gray-700 font-semibold">Quote text (አማርኛ)</Label>
                                <Input
                                    id="lp-qt-am"
                                    value={landingForm.quoteTextAm}
                                    onChange={(ev) =>
                                        setLandingForm((p) => ({ ...p, quoteTextAm: ev.target.value }))
                                    }
                                />
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="lp-of-en" className="text-gray-700 font-semibold">Organizer / footer (English)</Label>
                                <Input
                                    id="lp-of-en"
                                    value={landingForm.organizerFooterEn}
                                    onChange={(ev) =>
                                        setLandingForm((p) => ({ ...p, organizerFooterEn: ev.target.value }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lp-of-am" className="text-gray-700 font-semibold">Organizer / footer (አማርኛ)</Label>
                                <Input
                                    id="lp-of-am"
                                    value={landingForm.organizerFooterAm}
                                    onChange={(ev) =>
                                        setLandingForm((p) => ({ ...p, organizerFooterAm: ev.target.value }))
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={createSubmitting}
                        className="bg-[#22C55E] hover:bg-[#1DAE50] text-white"
                    >
                        {createSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                                Creating...
                            </>
                        ) : (
                            'Create event'
                        )}
                    </Button>
                </form>
            </section>
        </TabsContent>
    </Tabs>
</div>
    );
}

