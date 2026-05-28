'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { AuthGate } from '@/components/AuthGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Trash2, Plus, FileText, ChevronRight, Settings2 } from 'lucide-react';
import { isSummitLegacyForm } from '@/lib/form-templates';

type FormRow = { id: string; name: string; isActive: boolean; i18nMeta?: unknown };

export default function OrgFormsPage() {
    const params = useParams();
    const orgSlug = params.orgSlug as string;
    const { data: session, isPending } = authClient.useSession();
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    const [forms, setForms] = useState<FormRow[]>([]);
    const [newName, setNewName] = useState('');
    const [uiTemplate, setUiTemplate] = useState<'dynamic' | 'summit_legacy'>('summit_legacy');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const loadForms = useCallback(() => {
        if (!orgSlug) return;
        fetch(`/api/forms?orgSlug=${encodeURIComponent(orgSlug)}`, { credentials: 'include' })
            .then((r) => r.json())
            .then((d) => {
                if (d.forms) setForms(d.forms);
            })
            .catch(() => setForms([]));
    }, [orgSlug]);

    useEffect(() => {
        if (!session?.user || !orgSlug) return;
        loadForms();
    }, [sessionUserId, orgSlug, loadForms]);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        const name = newName.trim();
        if (!name) return;
        setError(null);
        setCreating(true);
        try {
            const res = await fetch('/api/forms', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orgSlug,
                    name,
                    ...(uiTemplate === 'summit_legacy'
                        ? { i18nMeta: { uiTemplate: 'summit_legacy' } }
                        : {}),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError((data as { error?: string }).error || 'Could not create form');
                return;
            }
            setNewName('');
            setUiTemplate('dynamic');
            loadForms();
        } finally {
            setCreating(false);
        }
    }

    async function handleDelete(formId: string, formName: string) {
        if (!confirm(`Delete form “${formName}”? This cannot be undone.`)) return;
        setDeletingId(formId);
        setError(null);
        try {
            const res = await fetch(
                `/api/forms/${formId}?orgSlug=${encodeURIComponent(orgSlug)}`,
                { method: 'DELETE', credentials: 'include' }
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError((data as { error?: string }).error || 'Could not delete form');
                return;
            }
            loadForms();
        } finally {
            setDeletingId(null);
        }
    }

    if (!isPending && !session) {
        return <AuthGate variant="login" />;
    }

    return (
        <div className="p-8 max-w-7xl space-y-10">
            <div className="flex flex-wrap justify-between items-end gap-4">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">Forms</h1>
                    <p className="text-gray-500 mt-2 font-medium">Manage and create registration forms for your events</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-1">
                    <section className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm sticky top-8">
                        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                             <div className="w-8 h-8 bg-[#F0FDF4] rounded-xl flex items-center justify-center">
                                <Plus className="w-5 h-5 text-[#22C55E]" />
                             </div>
                             New form
                        </h2>
                        {error && (
                            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-6 font-medium">
                                {error}
                            </p>
                        )}
                        <form onSubmit={handleCreate} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="new-form-name" className="text-gray-400 font-black uppercase text-[10px] tracking-wider ml-1">Form Name</Label>
                                <Input
                                    id="new-form-name"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="e.g. Summit 2025"
                                    className="rounded-2xl border-gray-100 bg-gray-50/50 h-12 text-base font-medium px-4 focus:ring-[#22C55E]/20"
                                />
                            </div>
                            {/* UI Template selector hidden — Form Builder feature is not yet active */}
                            <Button
                                type="submit"
                                disabled={creating || !newName.trim()}
                                className="w-full h-12 rounded-[20px] bg-[#22C55E] hover:bg-[#1DAE50] text-white font-black text-lg transition-all shadow-lg shadow-[#22C55E]/20 flex items-center justify-center"
                            >
                                {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create form'}
                            </Button>
                        </form>
                    </section>
                </div>

                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2 ml-4">
                        <FileText className="w-6 h-6 text-gray-400" />
                        Existing Forms
                        <span className="ml-2 text-sm font-black text-gray-300 bg-gray-50 px-3 py-1 rounded-full uppercase tracking-tighter">{forms.length}</span>
                    </h2>
                    
                    {forms.length === 0 ? (
                        <div className="text-center py-20 bg-gray-50/30 border-2 border-dashed border-gray-100 rounded-[40px]">
                            <p className="text-gray-400 font-bold text-lg">No forms created yet.</p>
                            <p className="text-gray-300 text-sm">Use the panel on the left to get started.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {forms.map((f) => (
                                <div
                                    key={f.id}
                                    className="group bg-white border border-gray-100 rounded-[32px] p-6 flex flex-wrap justify-between items-center gap-4 hover:border-[#22C55E]/40 hover:shadow-xl hover:shadow-[#22C55E]/5 transition-all duration-300"
                                >
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 bg-gray-50 group-hover:bg-[#F0FDF4] rounded-2xl flex items-center justify-center transition-colors">
                                            <FileText className="w-7 h-7 text-gray-300 group-hover:text-[#22C55E] transition-colors" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-xl font-black text-gray-900 leading-tight">{f.name}</h3>
                                            <div className="flex items-center gap-2">
                                                {isSummitLegacyForm(f) ? (
                                                    <span className="text-[10px] font-black text-[#15803d] bg-[#F0FDF4] px-2 py-0.5 rounded-lg border border-[#bbf7d0] uppercase tracking-wider">
                                                        Legacy UI
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-black text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100 uppercase tracking-wider">
                                                        Dynamic
                                                    </span>
                                                )}
                                                {!f.isActive && (
                                                    <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100 uppercase tracking-wider">
                                                        Inactive
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3">
                                        <Link
                                            href={`/${orgSlug}/forms/${f.id}`}
                                            className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-2xl font-black text-sm hover:bg-[#22C55E] transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-black/10 group-hover:shadow-[#22C55E]/20"
                                        >
                                            <Settings2 className="w-4 h-4" />
                                            Configure
                                            <ChevronRight className="w-4 h-4" />
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(f.id, f.name)}
                                            disabled={deletingId === f.id}
                                            className="w-12 h-12 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all border border-transparent hover:border-red-100"
                                            aria-label={`Delete ${f.name}`}
                                        >
                                            {deletingId === f.id ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-5 h-5" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
