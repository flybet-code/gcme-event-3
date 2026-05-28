'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { User, Church, Phone, Mail, CheckCircle, Globe, Plus, Trash2, Loader2, Download, CreditCard, Check, Settings2 } from 'lucide-react';
import type { FormField } from '@prisma/client';
import { FormFieldType } from '@prisma/client';
import { translations, Language } from '@/app/translations';
import { normalizePhone } from '@/lib/phone';
import { DEFAULT_SUMMIT_PAYMENT_METHODS, SummitPaymentMethodConfig } from '@/lib/summit-registration-config';
import { formatEventMetaLine } from '@/lib/landing-page-config';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QRCodeSVG } from 'qrcode.react';

type Props = {
    orgSlug: string;
    eventSlug: string;
    form: {
        id: string;
        name: string;
        fields: FormField[];
        i18nMeta: any;
    };
    event?: {
        startsAt?: string | null;
        endsAt?: string | null;
    };
    summitRegistration?: any;
    variant?: 'public' | 'admin';
};

export function PremiumRegistrationView({ orgSlug, eventSlug, form, event, variant = 'public', summitRegistration }: Props) {
    const [isGroup, setIsGroup] = useState(false);
    const [language, setLanguage] = useState<Language>('en');
    const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
    const t = translations[language];

    const resolvedSummit = summitRegistration;
    const regSettings = form.i18nMeta?.registrationSettings || {};
    
    const basePrice = resolvedSummit?.basePriceEtb ?? regSettings.basePriceEtb ?? 1500;
    const enableGroup = resolvedSummit?.enableGroup ?? (regSettings.enableGroup !== false);
    const enableCoupons = resolvedSummit?.enableCoupons ?? (regSettings.enableCoupons !== false);

    const [formData, setFormData] = useState<Record<string, any>>({});
    const [groupData, setGroupData] = useState({
        churchName: '',
        contactPersonPhone: '',
        email: '',
        attendees: [] as Record<string, any>[]
    });

    const paymentMethodsList = useMemo(() => {
        if (resolvedSummit?.paymentMethods && resolvedSummit.paymentMethods.length > 0) {
            return resolvedSummit.paymentMethods;
        }
        const supportedMethods = regSettings.paymentMethods || ['TELEBIRR', 'BRN'];
        return DEFAULT_SUMMIT_PAYMENT_METHODS.filter(m => supportedMethods.includes(m.id));
    }, [resolvedSummit?.paymentMethods, regSettings.paymentMethods]);
    const [paymentMethod, setPaymentMethod] = useState('');
    useEffect(() => {
        if (paymentMethodsList.length > 0 && !paymentMethod) {
            setPaymentMethod(paymentMethodsList[0].id);
        }
    }, [paymentMethodsList, paymentMethod]);

    const [transactionRef, setTransactionRef] = useState('');
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
    
    const [couponCode, setCouponCode] = useState('');
    const [appliedDiscount, setAppliedDiscount] = useState(0);
    const [discountMessage, setDiscountMessage] = useState('');

    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [registrationResult, setRegistrationResult] = useState<any>(null);
    const eventDateLine =
        resolvedSummit?.datesLineI18n?.[language] ||
        resolvedSummit?.datesLineI18n?.en ||
        formatEventMetaLine(event?.startsAt, event?.endsAt, undefined, language) ||
        t.landingDate;
    const eventContacts = resolvedSummit?.contacts ?? [];

    const handleLanguageChange = (lang: Language) => {
        setLanguage(lang);
    };

    const handleInputChange = (fieldKey: string, value: any) => {
        setFormData(prev => ({ ...prev, [fieldKey]: value }));
    };

    const addAttendee = () => {
        setGroupData(prev => ({
            ...prev,
            attendees: [...prev.attendees, {}]
        }));
    };

    const removeAttendee = (index: number) => {
        setGroupData(prev => ({
            ...prev,
            attendees: prev.attendees.filter((_, i) => i !== index)
        }));
    };

    const updateAttendee = (index: number, fieldKey: string, value: any) => {
        setGroupData(prev => {
            const newAttendees = [...prev.attendees];
            newAttendees[index] = { ...newAttendees[index], [fieldKey]: value };
            return { ...prev, attendees: newAttendees };
        });
    };

    const calculateTotal = () => {
        let total = isGroup ? groupData.attendees.length * basePrice : basePrice;
        if (appliedDiscount > 0) total = total * (1 - appliedDiscount);
        return Math.max(0, total);
    };

    const handleSubmit = async () => {
        if (isGroup) {
            if (groupData.attendees.length === 0) {
                toast.error(t.alertGroupDetails);
                return;
            }
            if (groupData.attendees.some(a => !a.fullName || !a.phoneNumber)) {
                toast.error('All attendees must have a name and a phone number.');
                return;
            }
        } else {
            if (!formData.fullName || !formData.phoneNumber) {
                toast.error('Please provide both your name and phone number.');
                return;
            }
        }

        setLoading(true);
        
        let receiptPath = null;
        if (receiptFile) {
            const uploadFormData = new FormData();
            uploadFormData.append('file', receiptFile);
            const uploadRes = await fetch('/api/upload', { method: 'POST', body: uploadFormData });
            if (uploadRes.ok) {
                const data = await uploadRes.json();
                receiptPath = data.filePath;
            }
        }

        try {
            const payload = {
                orgSlug,
                eventSlug,
                isGroup,
                paymentType: paymentMethod,
                amount: calculateTotal(),
                receiptPath,
                couponCode: couponCode || undefined,
                responses: isGroup ? {
                    churchName: groupData.churchName,
                    contactPhone: groupData.contactPersonPhone,
                    contactEmail: groupData.email,
                    attendees: groupData.attendees
                } : formData
            };

            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const text = await res.text();
                let errMsg = 'Registration failed';
                try {
                    const json = JSON.parse(text);
                    if (json.error) errMsg = json.error;
                } catch(e) {}
                throw new Error(errMsg);
            }
            
            const result = await res.json();
            
            // If Telebirr, redirect to payment
            if (paymentMethod === 'TELEBIRR' && payload.amount > 0) {
                const payRes = await fetch('/api/payment/church_summit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: form.name,
                        amount: payload.amount,
                        callback_info: `dyn_${result.id}`,
                        redirect_url: window.location.href,
                        notify_url: `${window.location.origin}/api/update_payment/${result.id}`
                    })
                });
                const payUrl = await payRes.text();
                if (payUrl.startsWith('http')) {
                    window.location.href = payUrl;
                    return;
                }
            }

            setRegistrationResult(result);
            setSuccess(true);
            toast.success(t.registrationSuccessful);
        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : t.alertErrorOccurred);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-8 bg-white rounded-[40px] shadow-xl border border-gray-100">
                <div className="flex justify-center">
                    <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-100">
                        <CheckCircle className="w-12 h-12 text-white" />
                    </div>
                </div>
                <div className="space-y-2">
                    <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tight">{t.registrationSuccessful}</h2>
                    <p className="text-gray-500 text-lg">{t.thankYouMessage}</p>
                </div>
                
                <div className="bg-gray-50 p-8 rounded-[32px] border border-gray-100 inline-block">
                    <QRCodeSVG value={registrationResult?.qrPayload || ''} size={200} level="H" />
                    <p className="mt-4 font-mono text-xs text-gray-400 uppercase tracking-widest">Ref: {registrationResult?.id}</p>
                </div>

                <div className="pt-4">
                    <Button 
                        onClick={() => window.location.reload()}
                        className="h-14 px-8 rounded-2xl bg-gray-900 hover:bg-black text-white font-bold"
                    >
                        {t.registerAnotherPerson}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto bg-white rounded-[40px] shadow-2xl overflow-hidden border border-gray-50">
            {/* Header */}
            <div className="bg-white px-8 py-8 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-white to-gray-50/50">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-[#22C55E] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#22C55E]/20">
                        <Settings2 className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">{form.name}</h1>
                        <p className="text-gray-500 text-sm font-medium">{eventDateLine}</p>
                        {eventContacts.length > 0 && (
                            <div className="mt-2 space-y-1 text-xs text-gray-600">
                                <p className="font-semibold text-gray-700">Contact</p>
                                {eventContacts.map((contact: { name?: string; phone?: string; email?: string }, idx: number) => (
                                    <p key={`${contact.name || 'contact'}-${idx}`}>
                                        {contact.name || 'Contact'}
                                        {contact.phone ? ` - ${contact.phone}` : ''}
                                        {contact.email ? ` (${contact.email})` : ''}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="relative">
                    <button 
                        onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-xl transition-all"
                    >
                        <Globe className="w-5 h-5 text-gray-400" />
                        <span className="font-bold uppercase text-sm text-gray-600">{language}</span>
                    </button>
                    {isLangMenuOpen && (
                        <div className="absolute right-0 mt-2 w-40 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-50">
                            {(['en', 'am'] as Language[]).map(lang => (
                                <button
                                    key={lang}
                                    onClick={() => { setLanguage(lang); setIsLangMenuOpen(false); }}
                                    className={`w-full text-left px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 ${language === lang ? 'text-[#22C55E] bg-[#F0FDF4]' : 'text-gray-600'}`}
                                >
                                    {lang === 'en' ? 'English' : 'አማርኛ'}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-8 space-y-10">
                {/* Mode Selector */}
                {enableGroup && (
                    <div className="flex p-2 bg-gray-100/50 rounded-3xl max-w-sm mx-auto">
                        <button 
                            onClick={() => setIsGroup(false)}
                            className={`flex-1 py-3 px-6 rounded-2xl text-sm font-black transition-all ${!isGroup ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            {t.individualBtn}
                        </button>
                        <button 
                            onClick={() => setIsGroup(true)}
                            className={`flex-1 py-3 px-6 rounded-2xl text-sm font-black transition-all ${isGroup ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            {t.groupBtn}
                        </button>
                    </div>
                )}

                <div className="space-y-8">
                    {!isGroup ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {form.fields.map(field => (
                                <DynamicInputField 
                                    key={field.id} 
                                    field={field} 
                                    value={formData[field.fieldKey]} 
                                    onChange={(v) => handleInputChange(field.fieldKey, v)} 
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-10">
                            <div className="bg-gray-50/50 p-8 rounded-[32px] border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-gray-400 font-black uppercase text-[10px] tracking-wider ml-1">{t.churchNameLabel}</Label>
                                    <Input 
                                        placeholder={t.churchNamePlaceholder}
                                        value={groupData.churchName}
                                        onChange={(e) => setGroupData(prev => ({ ...prev, churchName: e.target.value }))}
                                        className="h-12 rounded-2xl border-gray-100"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-gray-400 font-black uppercase text-[10px] tracking-wider ml-1">{t.contactPersonPhoneLabel}</Label>
                                    <Input 
                                        placeholder="0911..."
                                        value={groupData.contactPersonPhone}
                                        onChange={(e) => setGroupData(prev => ({ ...prev, contactPersonPhone: e.target.value }))}
                                        className="h-12 rounded-2xl border-gray-100"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-gray-400 font-black uppercase text-[10px] tracking-wider ml-1">{t.contactEmailLabel}</Label>
                                    <Input 
                                        placeholder="email@example.com"
                                        value={groupData.email}
                                        onChange={(e) => setGroupData(prev => ({ ...prev, email: e.target.value }))}
                                        className="h-12 rounded-2xl border-gray-100"
                                    />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xl font-black text-gray-900">{t.attendees}</h3>
                                    <Button 
                                        onClick={addAttendee}
                                        className="rounded-xl bg-[#22C55E] hover:bg-[#1DAE50] text-white font-bold h-10 px-6"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        {t.addAttendee}
                                    </Button>
                                </div>

                                {groupData.attendees.map((attendee, index) => (
                                    <div key={index} className="p-6 bg-white border border-gray-100 rounded-[32px] space-y-6 shadow-sm relative group">
                                        <button 
                                            onClick={() => removeAttendee(index)}
                                            className="absolute -top-2 -right-2 w-8 h-8 bg-white border border-red-50 rounded-full flex items-center justify-center text-red-500 shadow-md opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {form.fields.map(field => (
                                                <DynamicInputField 
                                                    key={field.id} 
                                                    field={field} 
                                                    value={attendee[field.fieldKey]} 
                                                    onChange={(v) => updateAttendee(index, field.fieldKey, v)} 
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}

                                {groupData.attendees.length === 0 && (
                                    <div className="text-center py-20 bg-gray-50/50 border-2 border-dashed border-gray-100 rounded-[40px]">
                                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                                            <Plus className="w-8 h-8 text-gray-200" />
                                        </div>
                                        <p className="text-gray-400 font-bold">{t.noAttendees}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Section: Payment & Summary */}
                <div className="pt-10 border-t border-gray-100 space-y-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        {/* Payment Selection */}
                        <div className="space-y-6">
                            <h3 className="text-xl font-black text-gray-900">{t.selectPaymentMethod}</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {paymentMethodsList.map((method: SummitPaymentMethodConfig) => (
                                    <button
                                        key={method.id}
                                        onClick={() => setPaymentMethod(method.id)}
                                        className={`p-4 rounded-[24px] border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === method.id ? 'border-[#22C55E] bg-[#F0FDF4]' : 'border-gray-50 bg-gray-50/50 hover:border-gray-100'}`}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${method.color} ${method.bg}`}>
                                            {method.shortLabel}
                                        </div>
                                        <span className="text-sm font-bold text-gray-700">{method.label}</span>
                                    </button>
                                ))}
                            </div>

                            {paymentMethod !== 'TELEBIRR' && (
                                <div className="space-y-4 bg-amber-50/50 p-6 rounded-[32px] border border-amber-100">
                                    <div className="flex items-center gap-3 text-amber-800">
                                        <CreditCard className="w-5 h-5" />
                                        <span className="font-bold text-sm">{t.bankTransferInstructions}</span>
                                    </div>
                                    <p className="text-xs text-amber-700 leading-relaxed font-medium">
                                        {t.bankTransferDetails}
                                        <br />
                                        <span className="block mt-2 font-black text-base">
                                            {paymentMethodsList.find((m: SummitPaymentMethodConfig) => m.id === paymentMethod)?.accountNumber}
                                        </span>
                                    </p>
                                    <div className="pt-2">
                                        <label className="block text-[10px] font-black uppercase text-amber-600 mb-2">{t.uploadReceipt}</label>
                                        <input 
                                            type="file" 
                                            onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                                            className="text-xs font-bold text-amber-900"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Order Summary */}
                        <div className="space-y-6">
                            <h3 className="text-xl font-black text-gray-900">{t.totalAmount}</h3>
                            <div className="bg-gray-900 text-white p-8 rounded-[32px] shadow-2xl space-y-6">
                                <div className="space-y-3">
                                    <div className="flex justify-between text-gray-400 text-sm font-bold">
                                        <span>Unit Price</span>
                                        <span>{basePrice} ETB</span>
                                    </div>
                                    <div className="flex justify-between text-gray-400 text-sm font-bold">
                                        <span>Quantity</span>
                                        <span>× {isGroup ? groupData.attendees.length : 1}</span>
                                    </div>
                                    {appliedDiscount > 0 && (
                                        <div className="flex justify-between text-[#22C55E] text-sm font-bold">
                                            <span>Discount</span>
                                            <span>- {appliedDiscount * 100}%</span>
                                        </div>
                                    )}
                                </div>
                                <div className="pt-4 border-t border-gray-800 flex justify-between items-baseline">
                                    <span className="text-gray-400 text-sm font-bold">Total</span>
                                    <span className="text-4xl font-black tracking-tighter">{calculateTotal()} ETB</span>
                                </div>

                                {enableCoupons && (
                                    <div className="flex gap-2 bg-gray-800 p-2 rounded-2xl">
                                        <input 
                                            placeholder={t.couponCode}
                                            value={couponCode}
                                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                            className="bg-transparent border-none focus:ring-0 text-sm font-bold flex-1 px-4 placeholder:text-gray-600"
                                        />
                                        <button 
                                            onClick={() => {
                                                const code = couponCode.toUpperCase().trim();
                                                const coupons = resolvedSummit?.coupons || {};
                                                const discount = coupons[code];
                                                
                                                if (discount !== undefined) {
                                                    setAppliedDiscount(discount);
                                                    setDiscountMessage(discount === 1 ? translations[language].registrationSuccessful : 'Discount applied');
                                                    toast.success(discount === 1 ? translations[language].registrationSuccessful : 'Discount applied');
                                                } else {
                                                    toast.error(t.invalidCoupon);
                                                }
                                            }}
                                            className="bg-white text-gray-900 px-6 py-2 rounded-xl text-xs font-black hover:bg-gray-100 transition-all"
                                        >
                                            {t.apply}
                                        </button>
                                    </div>
                                )}

                                <Button 
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="w-full h-16 rounded-2xl bg-[#22C55E] hover:bg-[#1DAE50] text-white text-xl font-black transition-all shadow-lg shadow-[#22C55E]/20"
                                >
                                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : t.payRegister}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function DynamicInputField({ field, value, onChange }: { field: FormField; value: any; onChange: (v: any) => void }) {
    const label = field.label;
    
    switch (field.type) {
        case FormFieldType.TEXT:
        case FormFieldType.EMAIL:
        case FormFieldType.PHONE:
            return (
                <div className="space-y-2">
                    <Label className="text-gray-400 font-black uppercase text-[10px] tracking-wider ml-1">{label}</Label>
                    <Input 
                        value={value || ''} 
                        onChange={(e) => onChange(e.target.value)} 
                        className="h-12 rounded-2xl border-gray-100 bg-gray-50/30 focus:bg-white transition-all shadow-sm"
                        placeholder={`Enter ${label.toLowerCase()}`}
                    />
                </div>
            );
        case FormFieldType.NUMBER:
            return (
                <div className="space-y-2">
                    <Label className="text-gray-400 font-black uppercase text-[10px] tracking-wider ml-1">{label}</Label>
                    <Input 
                        type="number"
                        value={value || ''} 
                        onChange={(e) => onChange(e.target.value)} 
                        className="h-12 rounded-2xl border-gray-100 bg-gray-50/30 focus:bg-white transition-all shadow-sm"
                    />
                </div>
            );
        case FormFieldType.SELECT: {
            const opts = (field.options as any[]) || [];
            return (
                <div className="space-y-2">
                    <Label className="text-gray-400 font-black uppercase text-[10px] tracking-wider ml-1">{label}</Label>
                    <select 
                        value={value || ''} 
                        onChange={(e) => onChange(e.target.value)}
                        className="w-full h-12 rounded-2xl border border-gray-100 bg-gray-50/30 px-4 text-sm font-bold focus:bg-white"
                    >
                        <option value="">Select {label}</option>
                        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
            );
        }
        default:
            return null;
    }
}
