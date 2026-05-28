'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FormField, FormFieldType } from '@prisma/client';
import { authClient } from '@/lib/auth-client';
import { AuthGate } from '@/components/AuthGate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Trash2, Settings, Plus, ChevronUp, ChevronDown, List, X, Check } from 'lucide-react';
import { isSummitLegacyForm } from '@/lib/form-templates';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export default function FormBuilderPage() {
    const params = useParams();
    const router = useRouter();
    const orgSlug = params.orgSlug as string;
    const formId = params.formId as string;
    const { data: session, isPending } = authClient.useSession();
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    
    // Form and Fields State
    const [fields, setFields] = useState<FormField[]>([]);
    const [name, setName] = useState('');
    const [uiMode, setUiMode] = useState<'dynamic' | 'summit_legacy'>('dynamic');
    const [isActive, setIsActive] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Modal State
    const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
    const [editingField, setEditingField] = useState<FormField | null>(null);
    const [fieldData, setFieldData] = useState({
        label: '',
        fieldKey: '',
        type: 'TEXT' as FormFieldType,
        required: false,
        options: [] as { label: string; value: string }[],
    });

    // Registration Settings
    const [basePrice, setBasePrice] = useState(1500);
    const [enableGroup, setEnableGroup] = useState(true);
    const [enableCoupons, setEnableCoupons] = useState(true);
    const [showTitleField, setShowTitleField] = useState(true);
    const [paymentMethods, setPaymentMethods] = useState<string[]>(['TELEBIRR', 'BRN']);

    const load = () => {
        fetch(`/api/forms/${formId}?orgSlug=${encodeURIComponent(orgSlug)}`, { credentials: 'include' })
            .then((r) => r.json())
            .then((d) => {
                if (d.form) {
                    setFields(d.form.fields || []);
                    setName(d.form.name);
                    setIsActive(d.form.isActive !== false);
                    setUiMode(isSummitLegacyForm(d.form) ? 'summit_legacy' : 'dynamic');
                    
                    const meta = d.form.i18nMeta as any;
                    if (meta?.registrationSettings) {
                        setBasePrice(meta.registrationSettings.basePriceEtb ?? 1500);
                        setEnableGroup(meta.registrationSettings.enableGroup !== false);
                        setEnableCoupons(meta.registrationSettings.enableCoupons !== false);
                        setShowTitleField(meta.registrationSettings.showTitleField !== false);
                        setPaymentMethods(meta.registrationSettings.paymentMethods || ['TELEBIRR', 'BRN']);
                    }
                }
            });
    };

    useEffect(() => {
        if (!session?.user || !formId) return;
        load();
    }, [sessionUserId, formId, orgSlug]);

    async function saveMetadata(e: React.FormEvent) {
        e.preventDefault();
        setSaveError(null);
        setSaving(true);
        try {
            const res = await fetch(`/api/forms/${formId}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orgSlug,
                    name: name.trim(),
                    isActive,
                    i18nMeta: {
                        uiTemplate: uiMode === 'summit_legacy' ? 'summit_legacy' : 'dynamic',
                        registrationSettings: {
                            basePriceEtb: basePrice,
                            enableGroup,
                            enableCoupons,
                            showTitleField,
                            paymentMethods,
                        }
                    },
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setSaveError((data as { error?: string }).error || 'Could not save');
                return;
            }
            if (data.form?.name) setName(data.form.name);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        if (!confirm('Delete this form? Detach it from all events first if it is linked.')) return;
        setDeleting(true);
        setSaveError(null);
        try {
            const res = await fetch(
                `/api/forms/${formId}?orgSlug=${encodeURIComponent(orgSlug)}`,
                { method: 'DELETE', credentials: 'include' }
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setSaveError((data as { error?: string }).error || 'Could not delete');
                return;
            }
            router.push(`/${orgSlug}/forms`);
        } finally {
            setDeleting(false);
        }
    }

    const openAddField = () => {
        setEditingField(null);
        setFieldData({
            label: '',
            fieldKey: '',
            type: 'TEXT',
            required: false,
            options: [],
        });
        setIsFieldModalOpen(true);
    };

    const openEditField = (field: FormField) => {
        setEditingField(field);
        setFieldData({
            label: field.label,
            fieldKey: field.fieldKey,
            type: field.type,
            required: field.required,
            options: Array.isArray(field.options) ? (field.options as any) : [],
        });
        setIsFieldModalOpen(true);
    };

    const saveField = async () => {
        if (!fieldData.label || !fieldData.fieldKey) return;
        setSaving(true);
        try {
            const isEditing = !!editingField;
            const url = isEditing 
                ? `/api/forms/${formId}/fields/${editingField.id}`
                : `/api/forms/${formId}/fields`;
            
            const res = await fetch(url, {
                method: isEditing ? 'PATCH' : 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orgSlug,
                    ...fieldData,
                }),
            });
            
            if (res.ok) {
                setIsFieldModalOpen(false);
                load();
            } else {
                const data = await res.json();
                alert(data.error || 'Could not save field');
            }
        } finally {
            setSaving(false);
        }
    };

    const deleteField = async (fieldId: string) => {
        if (!confirm('Delete this field? Any data associated with this field in existing registrations will remain but the field will no longer show up.')) return;
        try {
            const res = await fetch(`/api/forms/${formId}/fields/${fieldId}?orgSlug=${encodeURIComponent(orgSlug)}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (res.ok) load();
        } catch (err) {
            console.error(err);
        }
    };

    const moveField = async (fieldId: string, direction: 'up' | 'down') => {
        const index = fields.findIndex(f => f.id === fieldId);
        if (index === -1) return;
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === fields.length - 1) return;

        const newFields = [...fields];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];

        // Update locally for instant feedback
        setFields(newFields);

        // Update on server (simplified: just update the two affected fields' orders)
        // In a more robust system we might have an API to update all orders at once
        try {
            await Promise.all([
                fetch(`/api/forms/${formId}/fields/${newFields[index].id}`, {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orgSlug, order: index }),
                }),
                fetch(`/api/forms/${formId}/fields/${newFields[targetIndex].id}`, {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orgSlug, order: targetIndex }),
                }),
            ]);
        } catch (err) {
            console.error('Failed to update field order:', err);
            load(); // Revert to server state
        }
    };

    if (!isPending && !session) {
        return <AuthGate variant="login" />;
    }

    const hasOptions = ['SELECT', 'RADIO', 'CHECKBOX', 'MULTI_SELECT'].includes(fieldData.type);

    return (
        <div className="p-8 space-y-8 max-w-7xl">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Form builder</h1>
                    <p className="text-gray-500 mt-1">Configure your registration form and fields</p>
                </div>
                <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-red-100 rounded-xl text-sm text-red-600 hover:bg-red-50 font-semibold transition-all"
                >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete form
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <section className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <span className="w-2 h-6 bg-[#22C55E] rounded-full"></span>
                            Form Settings
                        </h2>
                        <form onSubmit={saveMetadata} className="space-y-6">
                            {saveError && (
                                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                                    {saveError}
                                </p>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="form-name" className="text-gray-400 font-black uppercase text-[10px] tracking-wider ml-1">Form name</Label>
                                <Input
                                    id="form-name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="rounded-2xl border-gray-100 bg-gray-50/50 h-12 text-base font-medium px-4 focus:ring-[#22C55E]/20"
                                    required
                                />
                            </div>
                            {/* Registration UI selector hidden — Form Builder feature not yet active */}
                            <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-4">
                                <label className="flex items-center gap-3 text-sm font-semibold text-gray-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isActive}
                                        onChange={(e) => setIsActive(e.target.checked)}
                                        className="w-5 h-5 rounded-lg border-gray-300 text-[#22C55E] focus:ring-[#22C55E]"
                                    />
                                    Registration form is active
                                </label>
                                <p className="text-[11px] text-gray-400 mt-2 ml-8 tracking-tight">Public registration allowed when linked to an active event</p>
                            </div>
                            <Button
                                type="submit"
                                disabled={saving || !name.trim()}
                                className="w-full h-12 rounded-[20px] bg-[#22C55E] hover:bg-[#1DAE50] text-white font-black text-lg transition-all shadow-lg shadow-[#22C55E]/20"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                        Saving Details...
                                    </>
                                ) : (
                                    'Save details'
                                )}
                            </Button>
                        </form>
                    </section>

                    <section className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                            Registration & Payment
                        </h2>
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-gray-400 font-black uppercase text-[10px] tracking-wider ml-1">Base Price (ETB)</Label>
                                    <Input
                                        type="number"
                                        value={basePrice}
                                        onChange={(e) => setBasePrice(parseInt(e.target.value))}
                                        className="rounded-2xl border-gray-100 bg-gray-50/50 h-12 text-base font-medium px-4"
                                    />
                                </div>
                                <div className="space-y-4 pt-6">
                                    <label className="flex items-center gap-3 text-sm font-semibold text-gray-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={enableGroup}
                                            onChange={(e) => setEnableGroup(e.target.checked)}
                                            className="w-5 h-5 rounded-lg border-gray-300 text-blue-500 focus:ring-blue-500"
                                        />
                                        Enable Group Registration
                                    </label>
                                    <label className="flex items-center gap-3 text-sm font-semibold text-gray-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={enableCoupons}
                                            onChange={(e) => setEnableCoupons(e.target.checked)}
                                            className="w-5 h-5 rounded-lg border-gray-300 text-blue-500 focus:ring-blue-500"
                                        />
                                        Enable Coupon Codes
                                    </label>
                                    <label className="flex items-center gap-3 text-sm font-semibold text-gray-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showTitleField}
                                            onChange={(e) => setShowTitleField(e.target.checked)}
                                            className="w-5 h-5 rounded-lg border-gray-300 text-blue-500 focus:ring-blue-500"
                                        />
                                        Show participant title (Pastor, Dr., Mr., …)
                                    </label>
                                    <p className="text-[11px] text-gray-400 -mt-2 ml-8 tracking-tight">
                                        When off, the title field is hidden on the registration form and is not prefixed on printed or digital badges.
                                    </p>
                                </div>
                            </div>

                            {/* Accepted Payment Methods configuration has been moved to the Event level */}
                        </div>
                    </section>
                </div>

                {/* Form Fields section hidden — Form Builder feature not yet active */}
            </div>

            {/* Field Editor Modal */}
            <Dialog open={isFieldModalOpen} onOpenChange={setIsFieldModalOpen}>
                <DialogContent className="sm:max-w-[500px] border-none shadow-2xl rounded-[32px] overflow-hidden p-0">
                    <DialogHeader className="bg-gray-900 px-8 py-6">
                        <DialogTitle className="text-white text-xl font-black tracking-tight flex items-center gap-2">
                            {editingField ? (
                                <>
                                    <Settings className="w-5 h-5 text-[#22C55E]" />
                                    Edit Form Field
                                </>
                            ) : (
                                <>
                                    <Plus className="w-5 h-5 text-[#22C55E]" />
                                    Add New Field
                                </>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-gray-400 tracking-wider ml-1">Label</Label>
                                <Input 
                                    placeholder="e.g. Phone Number"
                                    value={fieldData.label}
                                    onChange={(e) => {
                                        const label = e.target.value;
                                        setFieldData(prev => ({ 
                                            ...prev, 
                                            label, 
                                            fieldKey: prev.fieldKey || label.toLowerCase().replace(/[^a-z0-9]/g, '_') 
                                        }));
                                    }}
                                    className="h-11 rounded-2xl border-gray-100 bg-gray-50/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-gray-400 tracking-wider ml-1">Type</Label>
                                <select 
                                    value={fieldData.type}
                                    onChange={(e) => setFieldData(prev => ({ ...prev, type: e.target.value as FormFieldType }))}
                                    className="w-full h-11 rounded-2xl border border-gray-100 bg-gray-50/50 text-sm font-bold px-3 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/10 appearance-none"
                                >
                                    {Object.values(FormFieldType).map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-gray-400 tracking-wider ml-1">Field Key (Permanent ID)</Label>
                            <Input 
                                placeholder="phone_number"
                                value={fieldData.fieldKey}
                                disabled={!!editingField}
                                onChange={(e) => setFieldData(prev => ({ ...prev, fieldKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                                className="h-11 rounded-2xl border-gray-100 bg-gray-50/50 font-mono text-xs"
                            />
                            {!editingField && (
                                <p className="text-[9px] text-gray-400 ml-1 italic">Used for data mapping. Cannot be changed later.</p>
                            )}
                        </div>

                        <div className="flex items-center gap-3 bg-gray-50/50 border border-gray-100 p-4 rounded-2xl">
                            <input 
                                type="checkbox" 
                                id="field-required"
                                checked={fieldData.required}
                                onChange={(e) => setFieldData(prev => ({ ...prev, required: e.target.checked }))}
                                className="w-5 h-5 rounded-lg border-gray-300 text-[#22C55E] focus:ring-[#22C55E]"
                            />
                            <Label htmlFor="field-required" className="text-sm font-bold text-gray-700 cursor-pointer">Make this field required</Label>
                        </div>

                        {hasOptions && (
                            <div className="space-y-4 border-t border-gray-100 pt-6">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[10px] font-black uppercase text-gray-400 tracking-wider ml-1">Options</Label>
                                    <Button 
                                        type="button"
                                        variant="outline"
                                        onClick={() => setFieldData(prev => ({ 
                                            ...prev, 
                                            options: [...prev.options, { label: `Option ${prev.options.length + 1}`, value: `opt_${prev.options.length + 1}` }] 
                                        }))}
                                        className="h-7 px-2 text-[10px] rounded-lg border-gray-200"
                                    >
                                        <Plus className="w-3 h-3 mr-1" /> Add Option
                                    </Button>
                                </div>
                                
                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                                    {fieldData.options.map((opt, idx) => (
                                        <div key={idx} className="flex items-center gap-2 group">
                                            <Input 
                                                placeholder="Label"
                                                value={opt.label}
                                                onChange={(e) => {
                                                    const newOpts = [...fieldData.options];
                                                    newOpts[idx].label = e.target.value;
                                                    newOpts[idx].value = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_');
                                                    setFieldData(prev => ({ ...prev, options: newOpts }));
                                                }}
                                                className="h-10 rounded-xl text-sm"
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    setFieldData(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }));
                                                }}
                                                className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    {fieldData.options.length === 0 && (
                                        <p className="text-[11px] text-gray-400 text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-100">No options defined yet</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="bg-gray-50 px-8 py-5 flex items-center justify-between">
                        <button 
                            type="button"
                            onClick={() => setIsFieldModalOpen(false)}
                            className="text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            Cancel
                        </button>
                        <Button 
                            onClick={saveField}
                            disabled={saving || !fieldData.label || !fieldData.fieldKey}
                            className="bg-gray-900 text-white rounded-[18px] px-8 h-11 font-black shadow-xl shadow-gray-200"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingField ? 'Update Field' : (
                                <span className="flex items-center gap-2">
                                    <Check className="w-4 h-4" /> Save Field
                                </span>
                            ))}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
