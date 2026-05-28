'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { AuthGate } from '@/components/AuthGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, X, Upload, ImageIcon } from 'lucide-react';
import {
    buildLandingPageSettingsFromInputs,
    landingFormFieldsFromSettings,
    type LandingPageFormFields,
} from '@/lib/landing-page-config';
import {
    couponRowsFromRecord,
    recordFromCouponRows,
    type SummitCouponFormRow,
    type SummitPaymentMethodConfig,
    type SummitRegistrationSettings,
} from '@/lib/summit-registration-config';
import { toast } from 'sonner';
import { compressImage, isImageFile, formatFileSize } from '@/lib/image-compression';

type FormOption = { id: string; name: string };
type BankEntry = { label: string; accountNumber: string; accountName?: string };
type ContactEntry = { name: string; phone: string; email: string };

const PRESET_BANKS = [
    { label: 'CBE', full: 'Commercial Bank of Ethiopia' },
    { label: 'Abyssinia', full: 'Bank of Abyssinia' },
    { label: 'Telebirr', full: 'Telebirr' },
    { label: 'Berhan Bank', full: 'Berhan Bank' },
    { label: 'Awash Bank', full: 'Awash Bank' },
    { label: 'Dashen Bank', full: 'Dashen Bank' },
    { label: 'Cooperative Bank', full: 'Cooperative Bank of Oromia' },
];

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

function shortLabelFromBankLabel(label: string): string {
    const w = label.trim().split(/\s+/).filter(Boolean);
    if (w.length >= 2) return (w[0][0] + w[1][0]).toUpperCase();
    const t = label.trim();
    if (t.length >= 2) return t.slice(0, 2).toUpperCase();
    return 'BK';
}

/** Convert stored SummitPaymentMethodConfig[] → BankEntry[] for the form UI */
function paymentMethodsToBankEntries(methods: SummitPaymentMethodConfig[] | undefined): BankEntry[] {
    if (!methods || methods.length === 0) return [{ label: '', accountNumber: '', accountName: '' }];
    return methods.map((m) => ({
        label: m.label,
        accountNumber: m.accountNumber ?? m.merchantId ?? '',
        accountName: m.accountName ?? '',
    }));
}

/** Convert BankEntry[] → SummitPaymentMethodConfig[] for saving */
function bankEntriesToPaymentMethods(entries: BankEntry[]): SummitPaymentMethodConfig[] {
    return entries
        .filter((b) => b.label.trim() || b.accountNumber.trim())
        .map((bank, idx) => {
            const label = bank.label.trim();
            const acc = bank.accountNumber.trim();
            const { color, bg } = bankColors(label);
            const isTelebirr = label.toLowerCase().includes('telebirr');
            return {
                id: isTelebirr ? 'TELEBIRR' : `BANK_${idx}`,
                label: label || `Bank ${idx + 1}`,
                shortLabel: shortLabelFromBankLabel(label || `Bank ${idx + 1}`),
                type: (isTelebirr ? 'telebirr' : 'bank') as 'bank' | 'telebirr' | 'other',
                color,
                bg,
                ...(acc ? (isTelebirr ? { merchantId: acc } : { accountNumber: acc }) : {}),
                ...(bank.accountName?.trim() ? { accountName: bank.accountName.trim() } : {}),
            };
        });
}

function toDatetimeLocal(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(local: string): string | null {
    if (!local.trim()) return null;
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function EditOrgEventPage() {
    const params = useParams();
    const router = useRouter();
    const orgSlug = params.orgSlug as string;
    const eventId = params.eventId as string;
    const { data: session, isPending } = authClient.useSession();
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;

    const [loading, setLoading] = useState(true);
    const [forms, setForms] = useState<FormOption[]>([]);
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [description, setDescription] = useState('');
    const [startsAt, setStartsAt] = useState('');
    const [endsAt, setEndsAt] = useState('');
    const [registrationFormId, setRegistrationFormId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [landingForm, setLandingForm] = useState<LandingPageFormFields>(() =>
        landingFormFieldsFromSettings(undefined)
    );
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingHero, setUploadingHero] = useState(false);

    const logoRef = useRef<HTMLInputElement>(null);
    const heroRef = useRef<HTMLInputElement>(null);

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

    // Registration / payment settings
    const [regTitleEn, setRegTitleEn] = useState('');
    const [regTitleAm, setRegTitleAm] = useState('');
    const [datesLineEn, setDatesLineEn] = useState('');
    const [datesLineAm, setDatesLineAm] = useState('');
    const [placeLineEn, setPlaceLineEn] = useState('');
    const [placeLineAm, setPlaceLineAm] = useState('');
    const [supportEmail, setSupportEmail] = useState('');
    const [bankAccounts, setBankAccounts] = useState<BankEntry[]>([{ label: '', accountNumber: '', accountName: '' }]);
    const [contacts, setContacts] = useState<ContactEntry[]>([{ name: '', phone: '', email: '' }]);
    const [couponRows, setCouponRows] = useState<SummitCouponFormRow[]>([{ code: '', percentOff: 0 }]);

    const loadForms = useCallback(() => {
        fetch(`/api/forms?orgSlug=${encodeURIComponent(orgSlug)}`, { credentials: 'include' })
            .then((r) => r.json())
            .then((d) => {
                if (d.forms) setForms(d.forms.map((f: { id: string; name: string }) => ({ id: f.id, name: f.name })));
            })
            .catch(() => setForms([]));
    }, [orgSlug]);

    const loadEvent = useCallback(() => {
        setLoading(true);
        fetch(`/api/events/${eventId}?orgSlug=${encodeURIComponent(orgSlug)}`, { credentials: 'include' })
            .then((r) => r.json())
            .then((d) => {
                if (d.event) {
                    const e = d.event;
                    setName(e.name || '');
                    setSlug(e.slug || '');
                    setDescription(typeof e.description === 'string' ? e.description : '');
                    setStartsAt(toDatetimeLocal(e.startsAt));
                    setEndsAt(toDatetimeLocal(e.endsAt));
                    setRegistrationFormId(e.registrationForm?.id || '');
                    setLandingForm(landingFormFieldsFromSettings(e.settings));

                    // Load summitRegistration settings
                    const sr = (e.settings as any)?.summitRegistration as SummitRegistrationSettings | undefined;
                    if (sr) {
                        setRegTitleEn(sr.registrationTitleI18n?.en ?? '');
                        setRegTitleAm(sr.registrationTitleI18n?.am ?? '');
                        setDatesLineEn(sr.datesLineI18n?.en ?? '');
                        setDatesLineAm(sr.datesLineI18n?.am ?? '');
                        setPlaceLineEn(sr.placeLineI18n?.en ?? '');
                        setPlaceLineAm(sr.placeLineI18n?.am ?? '');
                        setSupportEmail(sr.supportEmail ?? '');
                        setBankAccounts(paymentMethodsToBankEntries(sr.paymentMethods));
                        setContacts(
                            sr.contacts && sr.contacts.length > 0
                                ? sr.contacts.map((c) => ({
                                      name: c.name ?? '',
                                      phone: c.phone ?? '',
                                      email: c.email ?? '',
                                  }))
                                : [{ name: '', phone: '', email: '' }]
                        );
                        setCouponRows(couponRowsFromRecord(sr.coupons));
                    }
                }
            })
            .catch(() => setError('Failed to load event'))
            .finally(() => setLoading(false));
    }, [eventId, orgSlug]);

    useEffect(() => {
        if (!sessionUserId || !eventId) return;
        loadForms();
        loadEvent();
    }, [sessionUserId, eventId, orgSlug, loadEvent, loadForms]);

    async function handleSubmit(ev: React.FormEvent) {
        ev.preventDefault();
        setError(null);
        setSuccess(null);
        const n = name.trim();
        const s = slug.trim().replace(/^-|-$/g, '');
        if (!n || !s) {
            setError('Name and slug are required.');
            return;
        }
        setSubmitting(true);
        try {
            const body: Record<string, unknown> = {
                orgSlug,
                name: n,
                slug: s,
                description: description.trim() || null,
                startsAt: fromDatetimeLocal(startsAt),
                endsAt: fromDatetimeLocal(endsAt),
            };
            if (registrationFormId) {
                body.registrationFormId = registrationFormId;
            } else {
                body.registrationFormId = null;
            }

            // Build summitRegistration
            const summit: SummitRegistrationSettings = {};
            if (regTitleEn.trim() || regTitleAm.trim()) {
                summit.registrationTitleI18n = {};
                if (regTitleEn.trim()) summit.registrationTitleI18n.en = regTitleEn.trim();
                if (regTitleAm.trim()) summit.registrationTitleI18n.am = regTitleAm.trim();
            }
            if (datesLineEn.trim() || datesLineAm.trim()) {
                summit.datesLineI18n = {};
                if (datesLineEn.trim()) summit.datesLineI18n.en = datesLineEn.trim();
                if (datesLineAm.trim()) summit.datesLineI18n.am = datesLineAm.trim();
            }
            if (placeLineEn.trim() || placeLineAm.trim()) {
                summit.placeLineI18n = {};
                if (placeLineEn.trim()) summit.placeLineI18n.en = placeLineEn.trim();
                if (placeLineAm.trim()) summit.placeLineI18n.am = placeLineAm.trim();
            }
            if (supportEmail.trim()) summit.supportEmail = supportEmail.trim();
            const pm = bankEntriesToPaymentMethods(bankAccounts);
            if (pm.length) summit.paymentMethods = pm;
            const nextContacts = contacts
                .map((c) => ({
                    name: c.name.trim(),
                    phone: c.phone.trim(),
                    email: c.email.trim(),
                }))
                .filter((c) => c.name || c.phone || c.email);
            if (nextContacts.length) summit.contacts = nextContacts;

            summit.coupons = recordFromCouponRows(couponRows);

            const lp = buildLandingPageSettingsFromInputs({
                ...landingForm,
                locationLineEn: placeLineEn.trim() || landingForm.locationLineEn,
                locationLineAm: placeLineAm.trim() || landingForm.locationLineAm,
            });
            const settings: Record<string, unknown> = {};
            if (Object.keys(summit).length) settings.summitRegistration = summit;
            if (lp) settings.landingPage = lp;
            body.settings = settings;

            const res = await fetch(`/api/events/${eventId}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError((data as { error?: string }).error || 'Could not save');
                toast.error((data as { error?: string }).error || 'Could not save');
                return;
            }
            setSuccess('Event updated.');
            toast.success('Event updated.');
            if (data.event?.slug) setSlug(data.event.slug);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDelete() {
        if (!confirm('Delete this event? This cannot be undone if registrations or related data block deletion.')) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/events/${eventId}?orgSlug=${encodeURIComponent(orgSlug)}`,
                { method: 'DELETE', credentials: 'include' }
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError((data as { error?: string }).error || 'Could not delete');
                toast.error((data as { error?: string }).error || 'Could not delete');
                return;
            }
            toast.success('Event deleted.');
            router.push(`/${orgSlug}/events`);
        } finally {
            setSubmitting(false);
        }
    }

    if (!isPending && !session) {
        return <AuthGate variant="login" />;
    }

    if (loading) {
        return (
            <div className="p-8 flex items-center gap-2 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading event…
            </div>
        );
    }

    return (
        <div className="p-8 max-w-2xl">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Edit event</h1>
                <div className="flex gap-3">
                    <Link href={`/${orgSlug}/events`} className="text-sm text-gray-600 hover:text-gray-900">
                        Back to events
                    </Link>
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={submitting}
                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                        Delete event
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 border border-gray-100 rounded-2xl p-6 bg-white">
                {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
                )}
                {success && (
                    <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                        {success}
                    </p>
                )}

                {/* Core fields */}
                <div className="space-y-2">
                    <Label htmlFor="edit-name" className="text-gray-700 font-semibold">Event name</Label>
                    <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="edit-slug" className="text-gray-700 font-semibold">URL slug</Label>
                    <Input id="edit-slug" value={slug} onChange={(e) => setSlug(e.target.value)} className="font-mono text-sm" required />
                    <p className="text-xs text-gray-400">
                        Public: /{orgSlug}/<span className="font-mono">{slug || 'slug'}</span> ·{' '}
                        <a
                            className="text-[#22C55E] hover:underline"
                            href={`/${orgSlug}/${slug || ''}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Landing
                        </a>
                    </p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="edit-desc" className="text-gray-700 font-semibold">Description</Label>
                    <Input id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-start" className="text-gray-700 font-semibold">Starts</Label>
                        <Input id="edit-start" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-end" className="text-gray-700 font-semibold">Ends</Label>
                        <Input id="edit-end" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="edit-form" className="text-gray-700 font-semibold">Registration form</Label>
                    <select
                        id="edit-form"
                        value={registrationFormId}
                        onChange={(e) => setRegistrationFormId(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                    >
                        <option value="">None</option>
                        {forms.map((f) => (
                            <option key={f.id} value={f.id}>
                                {f.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Registration & payment settings */}
                <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 space-y-4">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900">Registration page &amp; payment</h3>
                        <p className="text-xs text-gray-500 mt-1">
                            Shown on the public registration page and confirmation emails.
                        </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="e-reg-title-en" className="text-gray-700 font-semibold">Registration title (English)</Label>
                            <Input id="e-reg-title-en" value={regTitleEn} onChange={(e) => setRegTitleEn(e.target.value)} placeholder="e.g. Registration | Church Leadership Summit" />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="e-reg-title-am" className="text-gray-700 font-semibold">Registration title (አማርኛ, optional)</Label>
                            <Input id="e-reg-title-am" value={regTitleAm} onChange={(e) => setRegTitleAm(e.target.value)} placeholder="Optional Amharic title" />
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="e-dates-en" className="text-gray-700 font-semibold">Dates line (English)</Label>
                            <Textarea id="e-dates-en" value={datesLineEn} onChange={(e) => setDatesLineEn(e.target.value)} placeholder="e.g. April 25–26, 2026" rows={2} className="resize-y min-h-[2.5rem]" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="e-dates-am" className="text-gray-700 font-semibold">Dates line (አማርኛ)</Label>
                            <Textarea id="e-dates-am" value={datesLineAm} onChange={(e) => setDatesLineAm(e.target.value)} rows={2} className="resize-y min-h-[2.5rem]" />
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="e-place-en" className="text-gray-700 font-semibold">Place / location (English)</Label>
                            <Input id="e-place-en" value={placeLineEn} onChange={(e) => setPlaceLineEn(e.target.value)} placeholder="e.g. Beza International Church, Addis Ababa" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="e-place-am" className="text-gray-700 font-semibold">Place (አማርኛ, optional)</Label>
                            <Input id="e-place-am" value={placeLineAm} onChange={(e) => setPlaceLineAm(e.target.value)} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="e-support" className="text-gray-700 font-semibold">Support email</Label>
                        <Input id="e-support" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="events@yourorg.org" />
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
                            Only codes you add here (or on the organization defaults / form settings) work for this
                            event. Codes are not shared across organizations. Reserved words CASH and BANK cannot be
                            used as coupon codes.
                        </p>
                        <div className="space-y-2">
                            {couponRows.map((row, idx) => (
                                <div
                                    key={idx}
                                    className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2 items-end p-3 bg-white border border-gray-100 rounded-xl"
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
                                <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start p-3 bg-white border border-gray-100 rounded-xl">
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

                        {/* Quick-add chips */}
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
                                <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start p-3 bg-white border border-gray-100 rounded-xl">
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
                        <p className="text-[10px] text-gray-400">
                            Add Telebirr as a bank entry (label: &quot;Telebirr&quot;) and put the merchant/wallet ID in the account number field.
                        </p>
                    </div>
                </div>

                {/* Marketing landing page */}
                <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 space-y-4">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900">Marketing landing page</h3>
                        <p className="text-xs text-gray-500 mt-1">
                            Merged with organization defaults. Register buttons point to this event&apos;s registration URL.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="elp-logo" className="text-gray-700 font-semibold flex items-center gap-2">
                            <Plus className="w-3.5 h-3.5 text-[#22C55E]" /> Logo URL
                        </Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input id="elp-logo" value={landingForm.logoUrl} onChange={(e) => setLandingForm((p) => ({ ...p, logoUrl: e.target.value }))} />
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
                                onClick={() => logoRef.current?.click()}
                                disabled={uploadingLogo}
                            >
                                {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-1 text-[#22C55E]" />}
                                Upload
                            </Button>
                            <input
                                type="file"
                                ref={logoRef}
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
                        <Label htmlFor="elp-hero" className="text-gray-700 font-semibold flex items-center gap-2">
                            <ImageIcon className="w-3.5 h-3.5 text-[#22C55E]" /> Hero image (Side Panel)
                        </Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input id="elp-hero" value={landingForm.heroImage} onChange={(e) => setLandingForm((p) => ({ ...p, heroImage: e.target.value }))} placeholder="Shown on the side on the public landing page" />
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
                                onClick={() => heroRef.current?.click()}
                                disabled={uploadingHero}
                            >
                                {uploadingHero ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-1 text-[#22C55E]" />}
                                Upload
                            </Button>
                            <input
                                type="file"
                                ref={heroRef}
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(file, 'hero');
                                }}
                            />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500">
                        Location for landing date line is synced from Registration page &amp; payment section (Place / location EN + AM).
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="elp-h-en" className="text-gray-700 font-semibold">Headline (English)</Label>
                            <Textarea id="elp-h-en" value={landingForm.headlineEn} onChange={(e) => setLandingForm((p) => ({ ...p, headlineEn: e.target.value }))} rows={2} className="resize-y" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="elp-h-am" className="text-gray-700 font-semibold">Headline (አማርኛ)</Label>
                            <Textarea id="elp-h-am" value={landingForm.headlineAm} onChange={(e) => setLandingForm((p) => ({ ...p, headlineAm: e.target.value }))} rows={2} className="resize-y" />
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="elp-d-en" className="text-gray-700 font-semibold">Description (English)</Label>
                            <Textarea id="elp-d-en" value={landingForm.descriptionEn} onChange={(e) => setLandingForm((p) => ({ ...p, descriptionEn: e.target.value }))} rows={2} className="resize-y" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="elp-d-am" className="text-gray-700 font-semibold">Description (አማርኛ)</Label>
                            <Textarea id="elp-d-am" value={landingForm.descriptionAm} onChange={(e) => setLandingForm((p) => ({ ...p, descriptionAm: e.target.value }))} rows={2} className="resize-y" />
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="elp-qs-en" className="text-gray-700 font-semibold">Quote source (English)</Label>
                            <Input id="elp-qs-en" value={landingForm.quoteSourceEn} onChange={(e) => setLandingForm((p) => ({ ...p, quoteSourceEn: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="elp-qs-am" className="text-gray-700 font-semibold">Quote source (አማርኛ)</Label>
                            <Input id="elp-qs-am" value={landingForm.quoteSourceAm} onChange={(e) => setLandingForm((p) => ({ ...p, quoteSourceAm: e.target.value }))} />
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="elp-qt-en" className="text-gray-700 font-semibold">Quote text (English)</Label>
                            <Input id="elp-qt-en" value={landingForm.quoteTextEn} onChange={(e) => setLandingForm((p) => ({ ...p, quoteTextEn: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="elp-qt-am" className="text-gray-700 font-semibold">Quote text (አማርኛ)</Label>
                            <Input id="elp-qt-am" value={landingForm.quoteTextAm} onChange={(e) => setLandingForm((p) => ({ ...p, quoteTextAm: e.target.value }))} />
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="elp-of-en" className="text-gray-700 font-semibold">Organizer / footer (English)</Label>
                            <Input id="elp-of-en" value={landingForm.organizerFooterEn} onChange={(e) => setLandingForm((p) => ({ ...p, organizerFooterEn: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="elp-of-am" className="text-gray-700 font-semibold">Organizer / footer (አማርኛ)</Label>
                            <Input id="elp-of-am" value={landingForm.organizerFooterAm} onChange={(e) => setLandingForm((p) => ({ ...p, organizerFooterAm: e.target.value }))} />
                        </div>
                    </div>
                </div>

                <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-[#22C55E] hover:bg-[#1DAE50] text-white"
                >
                    {submitting ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                            Saving…
                        </>
                    ) : (
                        'Save changes'
                    )}
                </Button>
            </form>
        </div>
    );
}
