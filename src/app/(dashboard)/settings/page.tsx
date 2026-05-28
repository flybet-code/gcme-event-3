'use client';

import { useEffect, useState, useCallback } from 'react';
import { DEFAULT_REGISTRATION_FORM_ID_KEY } from '@/lib/org-settings';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { AuthGate } from '@/components/AuthGate';
import { DashboardMobileMenuButton } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Loader2, ImageIcon, KeyRound, Mail } from 'lucide-react';
import { getPasswordResetRedirectUrl } from '@/lib/app-url';
import { resolveBadgeTemplateSrcFromSettings } from '@/lib/badge-template';

type OrgRow = {
    id: string;
    name: string;
    slug: string;
    role?: string;
    permissions?: string[];
    settings?: unknown;
};

function slugify(name: string) {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .replace(/-+/g, '-');
}

export default function SettingsPage() {
    const router = useRouter();
    const { data: session, isPending } = authClient.useSession();
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    const [orgs, setOrgs] = useState<OrgRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [slugTouched, setSlugTouched] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [editingOrg, setEditingOrg] = useState<OrgRow | null>(null);
    const [editName, setEditName] = useState('');
    const [editSlug, setEditSlug] = useState('');
    const [editBadgeTemplateUrl, setEditBadgeTemplateUrl] = useState('');
    const [editDefaultRegistrationFormId, setEditDefaultRegistrationFormId] = useState('');
    const [editForms, setEditForms] = useState<{ id: string; name: string }[]>([]);
    const [badgeUploading, setBadgeUploading] = useState(false);
    const [editSubmitting, setEditSubmitting] = useState(false);
    const [editModalError, setEditModalError] = useState<string | null>(null);
    const [editModalSuccess, setEditModalSuccess] = useState<string | null>(null);
    const [passwordResetLoading, setPasswordResetLoading] = useState(false);
    const [passwordResetMessage, setPasswordResetMessage] = useState<string | null>(null);
    const [passwordResetError, setPasswordResetError] = useState<string | null>(null);

    const activeSlug = (session?.user as { activeOrganizationSlug?: string | null })?.activeOrganizationSlug;
    const accountEmail = session?.user?.email ?? '';

    const canEditOrg = (o: OrgRow) => {
        const u = session?.user as {
            isPlatformSuperAdmin?: boolean;
            orgRole?: string | null;
        };
        if (u?.isPlatformSuperAdmin) return true;
        return o.role === 'OWNER' || o.role === 'ADMIN';
    };

    const loadOrgs = useCallback(() => {
        setLoading(true);
        fetch('/api/orgs', { credentials: 'include' })
            .then((r) => r.json())
            .then((d) => {
                if (d.organizations) setOrgs(d.organizations);
            })
            .catch(() => setOrgs([]))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (session?.user) loadOrgs();
    }, [sessionUserId, loadOrgs]);

    useEffect(() => {
        if (!slugTouched && name) {
            setSlug(slugify(name));
        }
    }, [name, slugTouched]);



    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        const finalSlug = slug.trim() || slugify(name);
        if (!name.trim() || !finalSlug) {
            setError('Organization name is required.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch('/api/orgs', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), slug: finalSlug }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError((data as { error?: string }).error || 'Could not create organization');
                return;
            }
            setSuccess(`Created "${(data as { organization?: { name: string } }).organization?.name}". Switching…`);
            setName('');
            setSlug('');
            setSlugTouched(false);
            loadOrgs();
            const org = (data as { organization?: { slug: string } }).organization;
            if (org?.slug) {
                window.location.href = `/${org.slug}/events`;
            } else {
                router.refresh();
            }
        } finally {
            setSubmitting(false);
        }
    }

    async function switchOrg(organizationId: string, slug: string) {
        await fetch('/api/orgs/switch', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ organizationId }),
        });
        window.location.href = `/${slug}/events`;
    }

    function openEdit(o: OrgRow) {
        setEditingOrg(o);
        setEditModalError(null);
        setEditModalSuccess(null);
        setEditName(o.name);
        setEditSlug(o.slug);
        const s = o.settings as {
            badgeTemplateUrl?: string | null;
            [key: string]: unknown;
        } | undefined;
        setEditBadgeTemplateUrl(
            typeof s?.badgeTemplateUrl === 'string' && s.badgeTemplateUrl.trim() ? s.badgeTemplateUrl : ''
        );
        const def = s?.[DEFAULT_REGISTRATION_FORM_ID_KEY];
        setEditDefaultRegistrationFormId(typeof def === 'string' && def.trim() ? def : '');
    }

    useEffect(() => {
        if (!editingOrg) {
            setEditForms([]);
            return;
        }
        fetch(`/api/forms?orgSlug=${encodeURIComponent(editingOrg.slug)}`, { credentials: 'include' })
            .then((r) => r.json())
            .then((d) => {
                if (d.forms) {
                    setEditForms(
                        d.forms.map((f: { id: string; name: string }) => ({ id: f.id, name: f.name }))
                    );
                } else {
                    setEditForms([]);
                }
            })
            .catch(() => setEditForms([]));
    }, [editingOrg]);

    async function handleBadgeUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !editingOrg) return;
        setBadgeUploading(true);
        setEditModalError(null);
        setEditModalSuccess(null);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: fd,
                credentials: 'include',
            });
            const data = await res.json().catch(() => ({}));
            if (res.status === 401) {
                setEditModalError('You must be signed in to upload.');
                return;
            }
            if (res.ok && data.success && typeof data.filePath === 'string') {
                setEditBadgeTemplateUrl(data.filePath);
                const patchRes = await fetch(`/api/orgs/${editingOrg.id}`, {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        settings: { badgeTemplateUrl: data.filePath },
                    }),
                });
                const patchData = await patchRes.json().catch(() => ({}));
                if (!patchRes.ok) {
                    setEditModalError((patchData as { error?: string }).error || 'Could not save badge template');
                    return;
                }
                setEditModalSuccess('Badge background saved. It will be used for new badges and emails.');
                loadOrgs();
            } else {
                setEditModalError((data as { message?: string; error?: string }).message || data.error || 'Upload failed');
            }
        } finally {
            setBadgeUploading(false);
            e.target.value = '';
        }
    }

    async function handleRequestPasswordReset() {
        if (!accountEmail) return;
        setPasswordResetLoading(true);
        setPasswordResetMessage(null);
        setPasswordResetError(null);
        try {
            const { error: resetError } = await authClient.requestPasswordReset({
                email: accountEmail,
                redirectTo: getPasswordResetRedirectUrl(),
            });
            if (resetError) {
                setPasswordResetError(resetError.message || 'Could not send reset email.');
                return;
            }
            setPasswordResetMessage(
                `A password reset link was sent to ${accountEmail}. Check your inbox and follow the link to set a new password.`
            );
        } catch {
            setPasswordResetError('Something went wrong. Please try again.');
        } finally {
            setPasswordResetLoading(false);
        }
    }

    async function saveEdit(e: React.FormEvent) {
        e.preventDefault();
        if (!editingOrg) return;
        setEditSubmitting(true);
        setEditModalError(null);
        setEditModalSuccess(null);
        try {
            const res = await fetch(`/api/orgs/${editingOrg.id}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editName.trim(),
                    slug: editSlug.trim() || slugify(editName),
                    settings: {
                        badgeTemplateUrl: editBadgeTemplateUrl.trim() ? editBadgeTemplateUrl.trim() : null,
                        [DEFAULT_REGISTRATION_FORM_ID_KEY]: editDefaultRegistrationFormId.trim()
                            ? editDefaultRegistrationFormId.trim()
                            : null,
                    },
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setEditModalError((data as { error?: string }).error || 'Could not save');
                return;
            }
            setEditingOrg(null);
            loadOrgs();
            const newSlug = (data as { organization?: { slug?: string } }).organization?.slug;
            if (newSlug && newSlug !== editingOrg.slug) {
                window.location.href = `/${newSlug}/events`;
            } else {
                router.refresh();
            }
        } finally {
            setEditSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
                <DashboardMobileMenuButton />
                <h1 className="text-xl font-bold text-gray-900">Settings</h1>
            </header>

            <div className="p-6 max-w-2xl space-y-10">
                <section>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                        <KeyRound className="w-5 h-5 text-[#22C55E]" />
                        Account security
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Send yourself a password reset email. You will set a new password on a secure page from that link.
                    </p>
                    <div className="border border-gray-100 rounded-2xl p-6 bg-white space-y-4">
                        {accountEmail && (
                            <p className="text-sm text-gray-600 flex items-center gap-2">
                                <Mail className="w-4 h-4 text-gray-400" />
                                Signed in as <span className="font-mono font-medium text-gray-900">{accountEmail}</span>
                            </p>
                        )}
                        {passwordResetError && (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                                {passwordResetError}
                            </p>
                        )}
                        {passwordResetMessage && (
                            <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                                {passwordResetMessage}
                            </p>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            disabled={passwordResetLoading || !accountEmail}
                            onClick={handleRequestPasswordReset}
                            className="text-sm"
                        >
                            {passwordResetLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                                    Sending…
                                </>
                            ) : (
                                'Email me a password reset link'
                            )}
                        </Button>
                    </div>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-[#22C55E]" />
                        Your organizations
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Use the sidebar switcher to change the active organization. Data in the dashboard (vendors,
                        groups, etc.) follows the active org after you switch.
                    </p>

                    {loading ? (
                        <div className="flex items-center gap-2 text-gray-500 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                        </div>
                    ) : orgs.length === 0 ? (
                        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                            You are not a member of any organization yet. Create one below.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {orgs.map((o) => (
                                <li
                                    key={o.id}
                                    className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl px-4 py-3 bg-white"
                                >
                                    <div>
                                        <p className="font-medium text-gray-900">{o.name}</p>
                                        <p className="text-xs text-gray-500 font-mono">{o.slug}</p>
                                        {o.role && (
                                            <p className="text-xs text-gray-400 mt-0.5">Role: {o.role}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                                        {canEditOrg(o) && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="text-sm"
                                                onClick={() => openEdit(o)}
                                            >
                                                Edit
                                            </Button>
                                        )}
                                        {activeSlug === o.slug ? (
                                            <span className="text-xs font-semibold text-[#22C55E] bg-[#F0FDF4] px-2 py-1 rounded-lg">
                                                Active
                                            </span>
                                        ) : (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="text-sm"
                                                onClick={() => switchOrg(o.id, o.slug)}
                                            >
                                                Switch
                                            </Button>
                                        )}
                                        <Link
                                            href={`/${o.slug}/events`}
                                            className="text-sm text-[#22C55E] font-medium hover:underline"
                                        >
                                            Open
                                        </Link>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-gray-900 mb-1">Create organization</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        You will become the owner and can invite others later from User Management.
                    </p>

                    <form onSubmit={handleCreate} className="space-y-4 border border-gray-100 rounded-2xl p-6 bg-white">
                        {error && (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                                {error}
                            </p>
                        )}
                        {success && (
                            <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                                {success}
                            </p>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="org-name">Organization name</Label>
                            <Input
                                id="org-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Westside Church"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="org-slug">URL slug</Label>
                            <Input
                                id="org-slug"
                                value={slug}
                                onChange={(e) => {
                                    setSlugTouched(true);
                                    setSlug(e.target.value);
                                }}
                                placeholder="westside-church"
                                className="font-mono text-sm"
                            />
                            <p className="text-xs text-gray-400">
                                Used in URLs: /org/<span className="font-mono">{slug || 'your-slug'}</span>/…
                            </p>
                        </div>
                        <Button
                            type="submit"
                            disabled={submitting}
                            className="bg-[#22C55E] hover:bg-[#1DAE50] text-white"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                                    Creating…
                                </>
                            ) : (
                                'Create organization'
                            )}
                        </Button>
                    </form>
                </section>

                {editingOrg && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <button
                            type="button"
                            className="absolute inset-0 bg-black/40"
                            aria-label="Close"
                            onClick={() => setEditingOrg(null)}
                        />
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">Edit organization</h3>
                            <p className="text-sm text-gray-500 mb-4">Changing the URL slug updates all organization links and routes.</p>
                            <form onSubmit={saveEdit} className="space-y-4">
                                {editModalError && (
                                    <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                                        {editModalError}
                                    </p>
                                )}
                                {editModalSuccess && (
                                    <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                                        {editModalSuccess}
                                    </p>
                                )}
                                <div className="space-y-2">
                                    <Label htmlFor="edit-org-name">Name</Label>
                                    <Input
                                        id="edit-org-name"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-org-slug">URL slug</Label>
                                    <Input
                                        id="edit-org-slug"
                                        value={editSlug}
                                        onChange={(e) => setEditSlug(e.target.value)}
                                        className="font-mono text-sm"
                                        required
                                    />
                                </div>
                                <div className="space-y-2 border-t border-gray-100 pt-4">
                                    <Label className="flex items-center gap-2">
                                        <ImageIcon className="w-4 h-4 text-gray-500" />
                                        Badge background
                                    </Label>
                                    <p className="text-xs text-gray-500">
                                        Optional image for printed badges. If not set, the default template is used.
                                    </p>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/gif"
                                            className="text-sm text-gray-600 max-w-full"
                                            disabled={badgeUploading}
                                            onChange={handleBadgeUpload}
                                        />
                                        {badgeUploading && (
                                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                        )}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setEditBadgeTemplateUrl('')}
                                        >
                                            Clear (use default)
                                        </Button>
                                    </div>
                                    <div className="mt-2 rounded-lg border border-gray-100 overflow-hidden bg-gray-50 max-w-[200px]">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={resolveBadgeTemplateSrcFromSettings({
                                                badgeTemplateUrl: editBadgeTemplateUrl || undefined,
                                            })}
                                            alt="Badge preview"
                                            className="w-full h-auto object-cover aspect-[360/227]"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2 border-t border-gray-100 pt-4">
                                    <Label htmlFor="edit-default-reg-form">Default registration form (new events)</Label>
                                    <p className="text-xs text-gray-500">
                                        When you create an event without choosing a form, this template is attached. You
                                        can still pick another form per event or clear it on create.
                                    </p>
                                    <select
                                        id="edit-default-reg-form"
                                        value={editDefaultRegistrationFormId}
                                        onChange={(e) => setEditDefaultRegistrationFormId(e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <option value="">None</option>
                                        {editForms.map((f) => (
                                            <option key={f.id} value={f.id}>
                                                {f.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-2 justify-end pt-2">
                                    <Button type="button" variant="outline" onClick={() => setEditingOrg(null)}>
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={editSubmitting}
                                        className="bg-[#22C55E] hover:bg-[#1DAE50] text-white"
                                    >
                                        {editSubmitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                                                Saving…
                                            </>
                                        ) : (
                                            'Save'
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
