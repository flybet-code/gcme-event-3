'use client'
import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { User, Church, Briefcase, Phone, Mail, CheckCircle, CreditCard, Check, Users, Plus, Trash2, Globe, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { translations, Language } from '@/app/translations';
import { normalizePhone } from '@/lib/phone';
import {
    DEFAULT_SUMMIT_PAYMENT_METHODS,
    formatSummitPersonName,
    SUMMIT_FALLBACK_BASE_PRICE_ETB,
    type SummitRegistrationClientPayload,
} from '@/lib/summit-registration-config';

interface PaymentDetails {
    callbackInfo: string | null;
    amount: string | null;
    time: string | null;
}

interface Attendee {
    title: string;
    fullName: string;
    role: string; // 'Student' | 'Church Leader' | 'Professional'
    amount: string;
    phoneNumber: string;
}

const ROLES = [
    { label: 'Student', translationKey: 'student' },
    { label: 'Church Leader/Minister', translationKey: 'churchLeader' },
    { label: 'Professional', translationKey: 'professional' }
];

const INTERNAL_ROLES = [
    { label: 'Ministry Partners' },
    { label: 'Staff' },
    { label: 'Associates' },
    { label: 'Women leaders' },
    { label: 'Youths leaders' },
    { label: 'Event Coordinators' },
    { label: 'Media' },
    { label: 'Speakers' },
];

export type ChurchLeadershipSummitRegistrationProps = {
    isAdmin?: boolean;
    /** When set with eventSlug, POST scopes registration to this org/event (multi-tenant). */
    orgSlug?: string;
    eventSlug?: string;
    /** From GET /api/public/events/... ; if omitted, fetched client-side */
    summitRegistration?: SummitRegistrationClientPayload | null;
};

export default function ChurchLeadershipSummitRegistration({
    isAdmin = false,
    orgSlug,
    eventSlug,
    summitRegistration: summitRegistrationProp,
}: ChurchLeadershipSummitRegistrationProps) {
    const [isGroup, setIsGroup] = useState(false);
    const [language, setLanguage] = useState<Language>('en');
    const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
    const t = translations[language];
    // Individual Form Data
    const [formData, setFormData] = useState({
        title: '',
        fullName: '',
        churchName: '',
        serviceRole: '', // This is the "Role" for pricing in individual mode
        phoneNumber: '',
        email: '',
        paymentStatus: 'pending',
        amount: String(SUMMIT_FALLBACK_BASE_PRICE_ETB),
    });

    // Group Form Data
    const [groupData, setGroupData] = useState({
        churchName: '',
        contactPersonPhone: '',
        email: '',
        attendees: [] as Attendee[]
    });

    // Admin Payment State
    const [paymentMethod, setPaymentMethod] = useState('');
    const [transactionRef, setTransactionRef] = useState('');

    const [submitted, setSubmitted] = useState(false);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
    const [registrationData, setRegistrationData] = useState<any>(null);
    const [badgeTemplateSrc, setBadgeTemplateSrc] = useState('/badge_template.jpg');

    // Coupon State
    const [couponCode, setCouponCode] = useState('');
    const [appliedDiscount, setAppliedDiscount] = useState(0); // 0, 0.5, 1
    const [discountMessage, setDiscountMessage] = useState('');

    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
    const [honeyPot, setHoneyPot] = useState('');

    const [filterTicket, setFilterTicket] = useState<string | null>(null);

    const [localSummit, setLocalSummit] = useState<SummitRegistrationClientPayload | null>(null);
    const [summitLoading, setSummitLoading] = useState(false);

    const resolvedSummit = summitRegistrationProp ?? localSummit;
    const basePriceStr = useMemo(
        () => String(resolvedSummit?.basePriceEtb ?? SUMMIT_FALLBACK_BASE_PRICE_ETB),
        [resolvedSummit?.basePriceEtb]
    );

    const enableGroup = resolvedSummit?.enableGroup !== false;
    const enableCoupons = resolvedSummit?.enableCoupons !== false;
    const showTitleField = resolvedSummit?.showTitleField !== false;
    const availableCoupons = useMemo(() => {
        if (!enableCoupons) return {};
        return resolvedSummit?.coupons ?? {};
    }, [enableCoupons, resolvedSummit?.coupons]);

    const pricedRoles = useMemo(() => {
        const roles = (resolvedSummit?.roles ?? ROLES) as { label: string; translationKey?: string; price?: string }[];
        return roles.map((r) => ({ ...r, price: r.price || basePriceStr }));
    }, [resolvedSummit?.roles, basePriceStr]);

    const pricedInternalRoles = useMemo(() => {
        const iRoles = (resolvedSummit?.internalRoles ?? INTERNAL_ROLES) as {
            label: string;
            translationKey?: string;
            price?: string;
        }[];
        return iRoles.map((r) => ({ ...r, price: r.price || basePriceStr }));
    }, [resolvedSummit?.internalRoles, basePriceStr]);

    useEffect(() => {
        if (summitRegistrationProp) return;
        let cancelled = false;
        setSummitLoading(true);
        const url =
            orgSlug && eventSlug
                ? `/api/public/events/${encodeURIComponent(orgSlug)}/${encodeURIComponent(eventSlug)}`
                : '/api/public/summit-config';
        fetch(url)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error('config'))))
            .then((d) => {
                if (cancelled) return;
                const sr = orgSlug && eventSlug ? d.summitRegistration : d.summitRegistration;
                if (sr) setLocalSummit(sr);
            })
            .catch(() => {
                if (!cancelled) setLocalSummit(null);
            })
            .finally(() => {
                if (!cancelled) setSummitLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [summitRegistrationProp, orgSlug, eventSlug]);

    useEffect(() => {
        if (!resolvedSummit) return;
        setFormData((prev) => ({ ...prev, amount: basePriceStr }));
        const firstBank = resolvedSummit.paymentMethods.find((m) => m.type === 'bank');
        const first = firstBank || resolvedSummit.paymentMethods[0];
        if (first) setPaymentMethod(first.id);
    }, [resolvedSummit, basePriceStr]);

    const displayTitle = resolvedSummit?.titleI18n[language] ?? t.title;
    const displayDates = resolvedSummit?.datesLineI18n[language] ?? t.dates;
    const displayPlace = resolvedSummit?.placeLineI18n[language] ?? t.place;
    const displayContacts = resolvedSummit?.contacts ?? [];

    const paymentMethodsList =
        resolvedSummit?.paymentMethods?.length && resolvedSummit.paymentMethods.length > 0
            ? resolvedSummit.paymentMethods
            : DEFAULT_SUMMIT_PAYMENT_METHODS;

    const isTelebirrSelected =
        paymentMethodsList.find((m) => m.id === paymentMethod)?.type === 'telebirr';

    /** After success, “Register another” returns here — not the home / landing page. */
    const registerAgainHref = useMemo(() => {
        const qs = `?lang=${encodeURIComponent(language)}`;
        if (orgSlug && eventSlug) {
            return `/${encodeURIComponent(orgSlug)}/${encodeURIComponent(eventSlug)}/register${qs}`;
        }
        if (orgSlug) {
            return `/${encodeURIComponent(orgSlug)}/register${qs}`;
        }
        return `/register${qs}`;
    }, [orgSlug, eventSlug, language]);

    const downloadBadge = async (elementId: string, fileName: string) => {
        const element = document.getElementById(elementId);
        if (!element) return;

        try {
            const canvas = await html2canvas(element, {
                backgroundColor: '#ffffff',
                scale: 4, // Higher resolution
                useCORS: true,
                logging: false,
                windowWidth: 360,
            });

            const imgData = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `${fileName}.png`;
            link.href = imgData;
            link.click();
        } catch (err) {
            console.error("Error downloading badge:", err);
            alert("Could not download badge. Please try screenshotting instead.");
        }
    };

    // Check for payment success and language in URL parameters
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const tradeStatus = urlParams.get('trade_status');
            const callbackInfo = urlParams.get('callback_info');
            const totalAmount = urlParams.get('total_amount');
            const transEndTime = urlParams.get('trans_end_time');
            const langParam = urlParams.get('lang');
            const ticketParam = urlParams.get('ticket');

            if (langParam && ['en', 'am', 'or', 'ti'].includes(langParam)) {
                setLanguage(langParam as Language);
            }

            if (ticketParam) {
                setFilterTicket(ticketParam);
            }

            if (tradeStatus === 'PAY_SUCCESS' || tradeStatus === 'Completed') {
                setPaymentSuccess(true);
                setPaymentDetails({
                    callbackInfo: callbackInfo || '',
                    amount: totalAmount,
                    time: transEndTime
                });

                // Extract ID and fetch registration details for badges
                let id = null;
                if (callbackInfo) {
                    // callbackInfo format: "individual_123" or "group_123"
                    const parts = callbackInfo.split('_');
                    id = parts.length > 1 ? parts[1] : null;
                } else {
                    id = localStorage.getItem('registrationId');
                }

                if (id) {
                    fetch(`/api/register_church_summit/${id}`)
                        .then(res => res.json())
                        .then(data => {
                            if (data.data) {
                                setRegistrationData(data.data);
                                setBadgeTemplateSrc(
                                    typeof data.badgeTemplateSrc === 'string' && data.badgeTemplateSrc
                                        ? data.badgeTemplateSrc
                                        : '/badge_template.jpg'
                                );
                                localStorage.removeItem('registrationId');
                            }
                        })
                        .catch(err => console.error("Error fetching registration:", err));
                }
            }
        }
    }, []);

    const handleLanguageChange = (lang: Language) => {
        setLanguage(lang);
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('lang', lang);
            window.history.pushState({}, '', url.toString());
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        if (name === 'serviceRole') {
            const selectedRole = pricedRoles.find(r => r.label === value);
            setFormData(prev => ({
                ...prev,
                [name]: value,
                amount: selectedRole ? selectedRole.price : basePriceStr
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleGroupInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setGroupData(prev => ({ ...prev, [name]: value }));
    };

    const addAttendee = () => {
        setGroupData(prev => ({
            ...prev,
            attendees: [...prev.attendees, { title: '', fullName: '', role: '', amount: basePriceStr, phoneNumber: '' }]
        }));
    };

    const removeAttendee = (index: number) => {
        setGroupData(prev => ({
            ...prev,
            attendees: prev.attendees.filter((_, i) => i !== index)
        }));
    };

    const updateAttendee = (index: number, field: keyof Attendee, value: string) => {
        setGroupData(prev => {
            const newAttendees = [...prev.attendees];
            newAttendees[index] = { ...newAttendees[index], [field]: value };

            if (field === 'role') {
                const selectedRole = [...pricedRoles, ...pricedInternalRoles].find(r => r.label === value);
                if (selectedRole) {
                    newAttendees[index].amount = selectedRole.price;
                }
            }

            return { ...prev, attendees: newAttendees };
        });
    };

    const applyCoupon = () => {
        const code = couponCode.toUpperCase().trim();

        // Handle special manual payment codes
        if (code === 'CASH' || code === 'BANK') {
            setAppliedDiscount(0); // No discount, just change payment method
            setDiscountMessage(code === 'CASH' ? 'Cash payment method selected' : 'Bank transfer method selected');
            setTimeout(() => setDiscountMessage(''), 3000);
            return;
        }

        const discount = availableCoupons[code];
        if (discount) {
            setAppliedDiscount(discount);
            setDiscountMessage(`${Math.round(discount * 100)}% discount applied!`);
            setTimeout(() => setDiscountMessage(''), 3000);
        } else {
            setAppliedDiscount(0);
            setDiscountMessage('Invalid coupon code');
            setTimeout(() => setDiscountMessage(''), 3000);
        }
    };

    const calculateTotalAmount = () => {
        let total = 0;
        if (isGroup) {
            total = groupData.attendees.reduce((sum, attendee) => {
                const n = Number(String(attendee.amount || '0').replace(/,/g, ''));
                return sum + (Number.isFinite(n) ? n : 0);
            }, 0);
        } else {
            const n = Number(String(formData.amount || '0').replace(/,/g, ''));
            total = Number.isFinite(n) ? n : 0;
        }

        if (appliedDiscount > 0) {
            total = total * (1 - appliedDiscount);
        }

        return Math.max(0, Math.round(total)).toString();
    };

    const handlePayment = async () => {
        const totalAmount = calculateTotalAmount();
        const currentMethod = paymentMethodsList.find((m) => m.id === paymentMethod);
        const isManualPaymentSelected = currentMethod?.type !== 'telebirr';

        if (isManualPaymentSelected && !receiptFile && !isAdmin) {
            alert("Please upload the payment receipt.");
            return;
        }

        if (isGroup) {
            if (!groupData.churchName || !groupData.contactPersonPhone || groupData.attendees.length === 0) {
                alert(t.alertGroupDetails);
                return;
            }
            // Check if all attendees have names
            if (groupData.attendees.some(a => !a.fullName)) {
                alert(t.alertAttendeeNames);
                return;
            }

            // Check if all attendees have phone numbers
            if (groupData.attendees.some(a => !a.phoneNumber || a.phoneNumber.trim() === '')) {
                alert('Please enter phone numbers for all attendees.');
                return;
            }

            // Check for duplicate phone numbers within the group list (normalized so 09... and 9... match)
            const attendeeCores = groupData.attendees
                .map(a => a.phoneNumber && normalizePhone(a.phoneNumber))
                .filter((p): p is string => !!p);

            const uniqueCores = new Set(attendeeCores);
            if (uniqueCores.size !== attendeeCores.length) {
                alert('One or more attendees have the same phone number. Each attendee must have a unique phone number. You cannot use one phone for all attendees.');
                return;
            }
        } else {
            // Individual validation with detailed logging
            console.log('Individual form validation:', {
                fullName: formData.fullName,
                phoneNumber: formData.phoneNumber,
                email: formData.email,
                churchName: formData.churchName,
                serviceRole: formData.serviceRole
            });

            if (!formData.fullName) {
                alert('Please enter your full name');
                return;
            }
            if (!formData.phoneNumber) {
                alert('Please enter your phone number');
                return;
            }
            if (!formData.churchName) {
                alert('Please enter your church name');
                return;
            }
            if (!formData.serviceRole) {
                alert('Please select your role');
                return;
            }
        }

        setPaymentLoading(true);

        let uploadedReceiptPath = null;
        if (receiptFile) {
            const formData = new FormData();
            formData.append('file', receiptFile);

            try {
                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    uploadedReceiptPath = uploadData.filePath;
                } else {
                    const errorData = await uploadRes.json().catch(() => ({}));
                    console.error('Upload failed:', errorData);
                    alert(`Upload failed: ${errorData.message || errorData.error || "Please try again."}`);
                    setPaymentLoading(false);
                    return;
                }
            } catch (err) {
                console.error('Upload error', err);
                alert("Error uploading receipt image.");
                setPaymentLoading(false);
                return;
            }
        }

        try {
            const tenant =
                orgSlug && eventSlug
                    ? { orgSlug, eventSlug }
                    : {};

            const attendeesPayload = showTitleField
                ? groupData.attendees
                : groupData.attendees.map((a) => ({ ...a, title: '' }));

            const payload = isGroup ? {
                fullName: `${groupData.churchName} Group`,
                churchName: groupData.churchName,
                serviceRole: 'Group Registration',
                phoneNumber: groupData.contactPersonPhone,
                email: groupData.email,
                paymentStatus: 'pending',
                amount: totalAmount,
                isGroup: true,
                attendees: attendeesPayload,
                couponCode: couponCode || undefined,
                discountApplied: appliedDiscount > 0 ? `${(appliedDiscount * 100)}%` : undefined,
                paymentType: paymentMethod,
                transactionReference: isManualPaymentSelected ? transactionRef : undefined,
                receiptPath: uploadedReceiptPath || undefined,
                website: honeyPot,
                ...tenant,
            } : {
                ...formData,
                title: showTitleField ? formData.title : '',
                amount: totalAmount,
                couponCode: couponCode || undefined,
                discountApplied: appliedDiscount > 0 ? `${(appliedDiscount * 100)}%` : undefined,
                paymentType: paymentMethod,
                transactionReference: isManualPaymentSelected ? transactionRef : undefined,
                receiptPath: uploadedReceiptPath || undefined,
                website: honeyPot,
                ...tenant,
            };

            console.log('Registration payload:', payload);

            const saveResponse = await fetch('/api/register_church_summit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            console.log('Save response status:', saveResponse.status);

            if (!saveResponse.ok) {
                let errorMessage = 'Failed to save registration data';
                try {
                    const errorData = await saveResponse.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    const errorText = await saveResponse.text();
                    errorMessage = errorText || errorMessage;
                }

                console.error('Registration failed:', errorMessage);
                alert(errorMessage);
                setPaymentLoading(false);
                return;
            }
            const result = await saveResponse.json();
            console.log('Registration result:', result);
            const data = result.data || {};
            const paymentId = data.id;
            const regResult = result.data;
            localStorage.setItem('registrationId', paymentId);

            // Handle Manual Payments (Cash/Bank) or 100% Discount
            const isManualPayment = couponCode?.toUpperCase().trim() === 'CASH' || couponCode?.toUpperCase().trim() === 'BANK' || isManualPaymentSelected;

            if (parseFloat(totalAmount) === 0 || isManualPayment) {
                console.log('Processing manual/free registration...');

                // Show success UI for manual/free
                setTimeout(() => {
                    setPaymentSuccess(true);
                    setPaymentDetails({
                        callbackInfo: isGroup ? `group_${paymentId}` : `individual_${paymentId}`,
                        amount: totalAmount,
                        time: new Date().toISOString()
                    });
                    setRegistrationData(regResult);

                    // Update URL for the view
                    const url = new URL(window.location.href);
                    url.searchParams.set('callback_info', isGroup ? `group_${paymentId}` : `individual_${paymentId}`);
                    url.searchParams.set('total_amount', totalAmount);
                    window.history.pushState({}, '', url.toString());
                }, 1000);

                return;
            }

            const baseUrl =
                process.env.NEXT_PUBLIC_BASE_URL ||
                (typeof window !== 'undefined' ? window.location.origin : '');
            const registerReturnPath =
                orgSlug && eventSlug
                    ? `${baseUrl}/${orgSlug}/${eventSlug}/register`
                    : `${baseUrl}/register`;

            const paymentPayload = {
                title: isGroup ? "Group Registration" : "Church Leadership Summit Registration",
                amount: totalAmount,
                // Use a safe, standard format for callback_info to avoid gateway errors with special chars/spaces
                callback_info: isGroup ? `group_${paymentId}` : `individual_${paymentId}`,
                redirect_url: registerReturnPath,
                notify_url: `${baseUrl}/api/update_payment/${paymentId}`
            };

            console.log('Sending payment payload (Debug):', {
                totalAmount,
                appliedDiscount,
                payloadAmount: paymentPayload.amount
            });
            console.log('Sending payment payload:', paymentPayload);

            const response = await fetch("/api/payment/church_summit", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(paymentPayload)
            });

            console.log('Payment response status:', response.status);

            const paymentUrl = await response.text();
            console.log('Payment URL received:', paymentUrl);

            if (paymentUrl.startsWith("http")) {
                window.location.href = paymentUrl;
            } else {
                console.error("Invalid payment URL:", paymentUrl);
                alert(t.alertPaymentFailed);
            }

        } catch (error) {
            console.error("Error:", error);
            alert(t.alertErrorOccurred);
        } finally {
            setPaymentLoading(false);
        }
    };



    if (!resolvedSummit && summitLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-500">Loading event…</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <Head>
                <title>{displayTitle}</title>
                <meta name="description" content={t.metaDescription} />
            </Head>

            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-t-xl shadow-sm px-4 sm:px-8 py-4 sm:py-6 border-b relative">
                    <div className="absolute top-4 right-4 z-10">
                        <div className="relative inline-block text-left">
                            <button
                                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 focus:outline-none"
                            >
                                <Globe className="w-5 h-5" />
                                <span className="uppercase text-sm font-medium">{language}</span>
                            </button>
                            {isLangMenuOpen && (
                                <div className="absolute right-0 mt-2 w-32 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none overflow-hidden z-20">
                                    {(['en', 'am'] as Language[]).map((lang) => (
                                        <button
                                            key={lang}
                                            onClick={() => {
                                                handleLanguageChange(lang);
                                                setIsLangMenuOpen(false);
                                            }}
                                            className={`block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${language === lang ? 'bg-gray-50 font-bold' : ''}`}
                                        >
                                            {lang === 'en' ? 'English' : 'አማርኛ'}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center pr-12 sm:pr-0">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center shrink-0 border-2 sm:border-4 border-white shadow-lg overflow-hidden mr-3 sm:mr-4">
                            {resolvedSummit?.logoUrl ? (
                                <img src={resolvedSummit.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                            ) : (
                                <div className="w-full h-full bg-green-500 flex items-center justify-center text-white text-xl sm:text-2xl font-black">
                                    SM
                                </div>
                            )}
                        </div>
                        <h1 className="text-base sm:text-xl font-semibold text-gray-900">
                            {displayTitle}
                            <br />
                            <p className='text-xs sm:text-sm text-gray-500'>{displayDates}</p>
                            <p className='text-xs sm:text-sm text-gray-500'>{displayPlace}</p>
                            {resolvedSummit?.supportEmail && (
                                <p className="text-xs text-[#22C55E] mt-1">
                                    <a href={`mailto:${resolvedSummit.supportEmail}`}>{resolvedSummit.supportEmail}</a>
                                </p>
                            )}
                            {displayContacts.length > 0 && (
                                <div className="mt-2 text-xs text-gray-600 space-y-1">
                                    <p className="font-semibold text-gray-700">Contact</p>
                                    {displayContacts.map((contact, idx) => (
                                        <p key={`${contact.name || 'contact'}-${idx}`}>
                                            {contact.name || 'Contact'}
                                            {contact.phone ? ` - ${contact.phone}` : ''}
                                            {contact.email ? ` (${contact.email})` : ''}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </h1>
                    </div>
                </div>

                {/* Payment Success Message */}
                {paymentSuccess && (
                    <div className="bg-white px-4 lg:px-8 py-8">
                        <div className="max-w-2xl mx-auto">
                            <div className="text-center">
                                <div className="flex justify-center mb-6">
                                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-100">
                                        <CheckCircle className="w-10 h-10 text-white" />
                                    </div>
                                </div>
                                <h2 className="text-4xl font-black text-gray-900 mb-2 uppercase tracking-tight">
                                    {registrationData?.paymentStatus === 'PAY_SUCCESS' || (paymentSuccess && (registrationData?.paymentType === 'TELEBIRR' || Number(registrationData?.amount) === 0))
                                        ? t.registrationSuccessful
                                        : "Registration Submitted"}
                                </h2>
                                <p className="text-lg text-gray-600 mb-8 max-w-lg mx-auto">
                                    {/* Show "Pending Approval" message if NOT fully paid */}
                                    {registrationData?.paymentStatus !== 'PAY_SUCCESS' ? (
                                        <>
                                            Your registration was successful! <br />
                                            <span className="font-bold text-amber-600">Please wait for approval to attend.</span> <br />
                                            You will receive your badge once approved.
                                        </>
                                    ) : t.thankYouMessage}
                                </p>

                                {/* Only show Badge if PAY_SUCCESS */}
                                {registrationData && registrationData.paymentStatus === 'PAY_SUCCESS' && (
                                    <div className="mb-10">

                                        <div className="flex flex-wrap justify-center gap-16">
                                            {registrationData.isGroup && registrationData.attendees && registrationData.attendees.length > 0 ? (
                                                registrationData.attendees
                                                    .filter((attendee: any) => !filterTicket || String(attendee.ticketNumber) === filterTicket)
                                                    .map((attendee: any, index: number) => {
                                                        const badgeId = `CLS-${registrationData.id}-${attendee.id}`;
                                                        const qrData = {
                                                            id: registrationData.id,
                                                            subId: index + 1,
                                                            name: formatSummitPersonName(attendee.fullName, attendee.title, showTitleField),
                                                            church: registrationData.churchName,
                                                            type: 'group_member',
                                                            timestamp: new Date().toISOString()
                                                        };
                                                        return (
                                                            <div key={index} className="flex flex-col items-center mb-8 transform hover:scale-105 transition-transform duration-300">
                                                                <div id={`badge-group-${index}`} className="w-[360px] h-[227px] bg-white shadow-2xl overflow-hidden relative font-sans">
                                                                    {/* Full Ticket Info - Using Template Image */}
                                                                    <div className="relative w-full h-full overflow-hidden" style={{ WebkitPrintColorAdjust: 'exact' }}>
                                                                        {/* Background Image Tag */}
                                                                        <img
                                                                            src={badgeTemplateSrc}
                                                                            alt="Badge Template"
                                                                            className="absolute inset-0 w-full h-full object-cover z-0"
                                                                        />

                                                                        {/* QR Code Overlay - Positioned in the brown square */}
                                                                        <div className="absolute left-[9.5%] bottom-[9.5%] w-[20%] aspect-square flex items-center justify-center p-1 z-10">
                                                                            <QRCodeSVG
                                                                                value={badgeId}
                                                                                size={100}
                                                                                level="H"
                                                                                bgColor="transparent"
                                                                                fgColor="#FFFFFF"
                                                                                className="w-full h-full drop-shadow-sm"
                                                                            />
                                                                        </div>

                                                                        {/* Ticket Number Overlay - Top right orange box */}
                                                                        <div className="absolute top-[4%] right-[2%] w-[18%] h-[12%] flex items-center justify-center z-10">
                                                                            <span className="font-mono text-[12px] font-black text-white tracking-widest drop-shadow-sm leading-none pt-1">
                                                                                {registrationData.attendees[index].ticketNumber ? registrationData.attendees[index].ticketNumber.toString().padStart(4, '0') : '0000'}
                                                                            </span>
                                                                        </div>

                                                                        {/* Name Overlay - Centered in white area */}
                                                                        <div className="absolute right-0 top-[8%] bottom-[8%] w-[62%] flex flex-col items-center justify-center text-center px-4 z-10">
                                                                            <h2 className="text-[16px] font-black text-[#5D2E17] leading-none line-clamp-2 uppercase drop-shadow-sm" style={{ fontFamily: 'system-ui, sans-serif' }}>
                                                                                {formatSummitPersonName(attendee.fullName, attendee.title, showTitleField)}
                                                                            </h2>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="mt-4">
                                                                    {/* <button
                                                                        onClick={() => downloadBadge(`badge-group-${index}`, `badge-${attendee.fullName.replace(/\s+/g, '_')}`)}
                                                                        className="flex items-center px-6 py-2.5 bg-gray-900 text-white rounded-full hover:bg-black transition-all shadow-lg hover:shadow-xl text-sm font-medium"
                                                                    >
                                                                        <Download className="w-4 h-4 mr-2" /> Download Ticket
                                                                    </button> */}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                            ) : (
                                                <div className="flex flex-col items-center">
                                                    {(() => {
                                                        const badgeId = `CLS-${String(registrationData.id).padStart(4, '0')}`;
                                                        const qrData = {
                                                            id: registrationData.id,
                                                            name: formatSummitPersonName(registrationData.fullName, registrationData.title, showTitleField),
                                                            church: registrationData.churchName,
                                                            type: 'individual',
                                                            timestamp: new Date().toISOString()
                                                        };
                                                        return (
                                                            <>
                                                                <div id="badge-individual" className="w-[360px] h-[227px] bg-white shadow-2xl overflow-hidden relative font-sans mb-6">
                                                                    {/* Full Ticket Info - Using Template Image */}
                                                                    <div className="relative w-full h-full overflow-hidden" style={{ WebkitPrintColorAdjust: 'exact' }}>
                                                                        {/* Background Image Tag */}
                                                                        <img
                                                                            src={badgeTemplateSrc}
                                                                            alt="Badge Template"
                                                                            className="absolute inset-0 w-full h-full object-cover z-0"
                                                                        />

                                                                        {/* QR Code Overlay - Positioned in the brown square */}
                                                                        <div className="absolute left-[9.5%] bottom-[9.5%] w-[20%] aspect-square flex items-center justify-center p-1 z-10">
                                                                            <QRCodeSVG
                                                                                value={badgeId}
                                                                                size={100}
                                                                                level="H"
                                                                                bgColor="transparent"
                                                                                fgColor="#FFFFFF"
                                                                                className="w-full h-full drop-shadow-sm"
                                                                            />
                                                                        </div>

                                                                        {/* Ticket Number Overlay - Top right orange box */}
                                                                        <div className="absolute top-[4%] right-[2%] w-[18%] h-[12%] flex items-center justify-center z-10">
                                                                            <span className="font-mono text-[12px] font-black text-white tracking-widest drop-shadow-sm leading-none pt-1">
                                                                                {registrationData.ticketNumber ? registrationData.ticketNumber.toString().padStart(4, '0') : '0000'}
                                                                            </span>
                                                                        </div>

                                                                        {/* Name Overlay - Centered in white area */}
                                                                        <div className="absolute right-0 top-[8%] bottom-[8%] w-[62%] flex flex-col items-center justify-center text-center px-4 z-10">
                                                                            <h2 className="text-[20px] font-black text-[#5D2E17] leading-none line-clamp-2 uppercase drop-shadow-sm" style={{ fontFamily: 'system-ui, sans-serif' }}>
                                                                                {formatSummitPersonName(registrationData.fullName, registrationData.title, showTitleField)}
                                                                            </h2>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* <button
                                                                    onClick={() => downloadBadge('badge-individual', `badge-${registrationData.fullName.replace(/\s+/g, '_')}`)}
                                                                    className="flex items-center px-6 py-2.5 bg-gray-900 text-white rounded-full hover:bg-black transition-all shadow-lg hover:shadow-xl text-sm font-medium"
                                                                >
                                                                    <Download className="w-4 h-4 mr-2" /> Download Ticket
                                                                </button> */}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-center text-sm text-gray-500 mt-8 italic max-w-md mx-auto">
                                            {t.downloadInstructions}
                                        </p>
                                    </div>
                                )}

                                {isAdmin && registrationData && registrationData.paymentStatus !== 'PAY_SUCCESS' && (
                                    <div className="mt-8 pt-8 border-t border-gray-100 flex flex-col items-center">
                                        <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100 mb-6 w-full max-w-md">
                                            <h4 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                                Administrator Action Required
                                            </h4>
                                            <p className="text-sm text-amber-700">
                                                This manual registration is currently pending. You can approve it immediately below.
                                            </p>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                if (!confirm(`Are you sure you want to approve payment for ${registrationData.fullName}?`)) return;
                                                try {
                                                    const res = await fetch(`/api/update_payment/${registrationData.id}`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ trade_status: 'PAY_SUCCESS' })
                                                    });
                                                    if (res.ok) {
                                                        alert('Payment approved successfully!');
                                                        // Refresh data to show badges
                                                        const freshRes = await fetch(`/api/register_church_summit/${registrationData.id}`);
                                                        if (freshRes.ok) {
                                                            const freshData = await freshRes.json();
                                                            setRegistrationData(freshData.data);
                                                            setBadgeTemplateSrc(
                                                                typeof freshData.badgeTemplateSrc === 'string' &&
                                                                    freshData.badgeTemplateSrc
                                                                    ? freshData.badgeTemplateSrc
                                                                    : '/badge_template.jpg'
                                                            );
                                                        } else {
                                                            window.location.reload();
                                                        }
                                                    } else {
                                                        alert('Failed to approve payment');
                                                    }
                                                } catch (err) {
                                                    console.error(err);
                                                    alert('Error approving payment');
                                                }
                                            }}
                                            className="w-full max-w-md bg-[#22C55E] text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-[#22C55E]/20 hover:scale-[1.02] active:scale-[0.98] transition flex items-center justify-center gap-3"
                                        >
                                            <CheckCircle className="w-6 h-6" />
                                            Approve Payment Now
                                        </button>
                                    </div>
                                )}

                                <div className="pt-10 border-t border-gray-100 mt-10">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            window.location.href = registerAgainHref;
                                        }}
                                        className="w-full sm:w-auto px-10 py-4 bg-[#3DADB7] text-white font-bold rounded-2xl hover:bg-[#2c8a92] transition-all shadow-xl shadow-[#3DADB7]/20 active:scale-95"
                                    >
                                        {t.registerAnotherPerson}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Content */}
                {!paymentSuccess && (
                    <div className="bg-white px-4 sm:px-8 py-8 sm:py-10 shadow-lg rounded-b-3xl">
                        <div className="space-y-8 sm:space-y-10">
                            {/* 1. Registration Mode Toggle */}
                            {enableGroup && (
                                <div className="flex p-1.5 bg-gray-100 rounded-2xl max-w-md mx-auto ring-1 ring-gray-200">
                                    <button
                                        onClick={() => setIsGroup(false)}
                                        className={`flex-1 py-3 px-6 rounded-xl text-sm font-black transition-all duration-200 uppercase tracking-tight ${!isGroup ? 'bg-white text-gray-900 shadow-md ring-1 ring-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        {t.individualBtn}
                                    </button>
                                    <button
                                        onClick={() => setIsGroup(true)}
                                        className={`flex-1 py-3 px-6 rounded-xl text-sm font-black transition-all duration-200 uppercase tracking-tight ${isGroup ? 'bg-white text-gray-900 shadow-md ring-1 ring-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        {t.groupBtn}
                                    </button>
                                </div>
                            )}

                            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
                                {isGroup ? t.groupApplicationForm : t.individualApplicationForm}
                            </h2>

                            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                                {/* Honeypot for bots */}
                                <div style={{ display: 'none', position: 'absolute', opacity: 0, height: 0, width: 0, zIndex: -1 }} aria-hidden="true">
                                    <input
                                        type="text"
                                        name="website"
                                        value={honeyPot}
                                        onChange={(e) => setHoneyPot(e.target.value)}
                                        tabIndex={-1}
                                        autoComplete="off"
                                    />
                                </div>
                                {/* Common Field: Church Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        {t.churchNameLabel} <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Church className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <input
                                            type="text"
                                            name="churchName"
                                            required
                                            className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3DADB7] focus:border-transparent"
                                            placeholder={t.churchNamePlaceholder}
                                            value={isGroup ? groupData.churchName : formData.churchName}
                                            onChange={isGroup ? handleGroupInputChange : handleInputChange}
                                        />
                                    </div>
                                </div>

                                {!isGroup ? (
                                    <>
                                        {/* Individual Fields */}
                                        {showTitleField && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Title
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    name="title"
                                                    className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3DADB7] focus:border-transparent"
                                                    placeholder="e.g. Pastor, Dr., Rev., Mr."
                                                    value={formData.title}
                                                    onChange={handleInputChange}
                                                />
                                            </div>
                                        </div>
                                        )}

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {t.participantNameLabel} <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <User className="h-5 w-5 text-gray-400" />
                                                </div>
                                                <input
                                                    type="text"
                                                    name="fullName"
                                                    required
                                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3DADB7] focus:border-transparent"
                                                    placeholder={t.participantNamePlaceholder}
                                                    value={formData.fullName}
                                                    onChange={handleInputChange}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {t.roleCategoryLabel} <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Briefcase className="h-5 w-5 text-gray-400" />
                                                </div>
                                                <select
                                                    name="serviceRole"
                                                    required
                                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3DADB7] focus:border-transparent bg-white"
                                                    value={formData.serviceRole}
                                                    onChange={handleInputChange}
                                                >
                                                    <option value="">{t.selectRole}</option>
                                                    {(isAdmin ? [...pricedRoles, ...pricedInternalRoles] : pricedRoles).map(role => (
                                                        <option key={role.label} value={role.label}>
                                                            {/* @ts-ignore */}
                                                            {role.translationKey ? t.roles[role.translationKey] : role.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {t.phoneNumberLabel} <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Phone className="h-5 w-5 text-gray-400" />
                                                </div>
                                                <input
                                                    type="tel"
                                                    name="phoneNumber"
                                                    required
                                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3DADB7] focus:border-transparent"
                                                    placeholder="+251 9..."
                                                    value={formData.phoneNumber}
                                                    onChange={handleInputChange}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {t.emailLabel}
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Mail className="h-5 w-5 text-gray-400" />
                                                </div>
                                                <input
                                                    type="email"
                                                    name="email"
                                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3DADB7] focus:border-transparent"
                                                    placeholder="your-email@example.com"
                                                    value={formData.email}
                                                    onChange={handleInputChange}
                                                />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* Group Fields */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {t.contactPersonPhoneLabel} <span className="text-red-500">*</span>
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Phone className="h-5 w-5 text-gray-400" />
                                                </div>
                                                <input
                                                    type="tel"
                                                    name="contactPersonPhone"
                                                    required
                                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3DADB7] focus:border-transparent"
                                                    placeholder="+251 9..."
                                                    value={groupData.contactPersonPhone}
                                                    onChange={handleGroupInputChange}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                {t.contactEmailLabel}
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <Mail className="h-5 w-5 text-gray-400" />
                                                </div>
                                                <input
                                                    type="email"
                                                    name="email"
                                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#3DADB7] focus:border-transparent"
                                                    placeholder="contact-email@example.com"
                                                    value={groupData.email}
                                                    onChange={handleGroupInputChange}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-lg font-medium text-gray-900">{t.attendeesLabel}</h3>
                                                <button
                                                    type="button"
                                                    onClick={addAttendee}
                                                    className="flex items-center px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100"
                                                >
                                                    <Plus className="w-4 h-4 mr-1" /> {t.addAttendee}
                                                </button>
                                            </div>

                                            {groupData.attendees.length === 0 && (
                                                <p className="text-sm text-gray-500 italic text-center py-4 border-2 border-dashed rounded-lg">
                                                    {t.noAttendeesAdded}
                                                </p>
                                            )}

                                            {groupData.attendees.map((attendee, index) => (
                                                <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200 relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeAttendee(index)}
                                                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                    <div className={`grid grid-cols-1 gap-4 ${showTitleField ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                                                        {showTitleField && (
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                                                            <input
                                                                type="text"
                                                                value={attendee.title}
                                                                onChange={(e) => updateAttendee(index, 'title', e.target.value)}
                                                                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                                                placeholder="e.g. Pastor"
                                                            />
                                                        </div>
                                                        )}
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-500 mb-1">{t.nameLabel}</label>
                                                            <input
                                                                type="text"
                                                                value={attendee.fullName}
                                                                onChange={(e) => updateAttendee(index, 'fullName', e.target.value)}
                                                                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                                                placeholder={t.nameLabel}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-500 mb-1">{t.roleLabel}</label>
                                                            <select
                                                                value={attendee.role}
                                                                onChange={(e) => updateAttendee(index, 'role', e.target.value)}
                                                                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white"
                                                            >
                                                                <option value="">{t.selectRole}</option>
                                                                {(isAdmin ? [...pricedRoles, ...pricedInternalRoles] : pricedRoles).map(role => (
                                                                    <option key={role.label} value={role.label}>
                                                                        {/* @ts-ignore */}
                                                                        {role.translationKey ? t.roles[role.translationKey] : role.label}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-500 mb-1">{t.phoneOptionalLabel}</label>
                                                            <input
                                                                type="tel"
                                                                value={attendee.phoneNumber}
                                                                onChange={(e) => updateAttendee(index, 'phoneNumber', e.target.value)}
                                                                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                                                placeholder={t.phoneLabel}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {/* Coupon Code Section */}
                                {enableCoupons && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="w-1.5 h-4 bg-orange-500 rounded-full"></span>
                                            <label className="text-xs font-black text-gray-600 uppercase tracking-widest">{t.couponCode}</label>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    value={couponCode}
                                                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                                    placeholder="GCME..."
                                                    className="w-full h-12 bg-white border border-gray-300 rounded-xl px-4 text-gray-900 text-sm font-bold placeholder:text-gray-400 focus:ring-2 focus:ring-[#3DADB7] focus:border-transparent transition-all font-mono shadow-sm"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={applyCoupon}
                                                className="h-12 px-6 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase hover:bg-slate-200 transition-all border border-slate-200"
                                            >
                                                {t.apply}
                                            </button>
                                        </div>
                                        {discountMessage && (
                                            <p className={`text-[10px] font-black uppercase tracking-tighter ml-1 transition-all animate-pulse ${discountMessage.includes('Invalid') ? 'text-red-500' : 'text-green-500'}`}>
                                                {discountMessage}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Payment Method Selection */}
                                <div className="mb-8 p-6 bg-slate-50 border border-slate-200 rounded-xl">
                                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                        <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">1</span>
                                        {t.selectPaymentMethod}
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                                        {paymentMethodsList.map((method) => (
                                            <button
                                                key={method.id}
                                                type="button"
                                                onClick={() => setPaymentMethod(method.id)}
                                                className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all relative ${paymentMethod === method.id ? 'border-green-500 shadow-md ring-2 ring-green-500/20 bg-white' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                                            >
                                                <div className={`p-2 rounded-full ${method.bg || 'bg-slate-100'}`}>
                                                    <div className={`font-black text-xs ${method.color || 'text-slate-700'}`}>
                                                        {(method.shortLabel || method.label).substring(0, 2)}
                                                    </div>
                                                </div>
                                                <div className="font-bold text-xs text-center text-slate-700">{method.label}</div>
                                                {paymentMethod === method.id && <div className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold absolute top-2 right-2">✓</div>}
                                            </button>
                                        ))}
                                    </div>

                                    {!isTelebirrSelected && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                            {/* Bank Info for Public & Admin */}
                                            <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800 animate-in fade-in zoom-in-95 duration-300">
                                                <h4 className="font-bold mb-2 flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                    {t.bankTransferInstructions}
                                                </h4>
                                                <p className="mb-3 text-blue-700">{t.bankTransferDetails}</p>
                                                <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm space-y-3 mb-3">
                                                    {paymentMethodsList
                                                        .filter((m) => m.type === 'bank' && m.accountNumber && m.id === paymentMethod)
                                                        .map((m) => (
                                                            <div
                                                                key={m.id}
                                                                className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 pb-2 border-b border-gray-100 last:border-0 last:pb-0"
                                                            >
                                                                <span className="font-bold text-gray-700">
                                                                    {m.label}
                                                                    {m.accountName ? ` (${m.accountName})` : ''}
                                                                </span>
                                                                <code className="font-mono bg-gray-50 px-2 py-1 rounded text-blue-600 select-all">
                                                                    {m.accountNumber}
                                                                </code>
                                                            </div>
                                                        ))}
                                                    {/* Telebirr shouldn't be listed here for manual transfer because it has auto-pay natively. */}
                                                </div>
                                                <p className="text-xs text-blue-600 bg-blue-100/50 p-2 rounded">
                                                    {t.noteUploadReceipt}
                                                </p>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 mb-2">{t.uploadReceipt} <span className="text-red-500">*</span></label>
                                                <div className="relative">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                setReceiptFile(file);
                                                                const reader = new FileReader();
                                                                reader.onloadend = () => {
                                                                    setReceiptPreview(reader.result as string);
                                                                };
                                                                reader.readAsDataURL(file);
                                                            }
                                                        }}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                    />
                                                    <div className={`border-2 border-dashed ${receiptPreview ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-blue-400 bg-white'} rounded-lg p-6 text-center transition cursor-pointer flex flex-col items-center justify-center min-h-[100px]`}>
                                                        {receiptPreview ? (
                                                            <div className="relative w-full">
                                                                <img src={receiptPreview} alt="Receipt preview" className="max-h-40 mx-auto rounded shadow-sm object-contain" />
                                                                <div className="text-green-600 text-xs font-bold mt-2 flex items-center justify-center gap-1">
                                                                    <CheckCircle className="w-3 h-3" /> Image Selected
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-slate-400 text-sm">
                                                                <span className="font-semibold text-blue-600">{t.clickToUpload}</span> {t.orDragAndDrop}<br />
                                                                <span className="text-xs text-slate-400">{t.fileTypesLimit}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 bg-amber-50 text-amber-800 rounded-lg text-sm flex items-start gap-2 border border-amber-100">
                                                <div className="mt-0.5 font-bold">⚠️</div>
                                                <div>
                                                    <span className="font-bold">{t.manualVerification}:</span> {t.pendingConfirmation}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Total Amount Display */}
                                <div className="bg-blue-50 p-4 rounded-lg flex justify-between items-center">
                                    <span className="text-blue-800 font-medium">{t.totalAmountLabel}:</span>
                                    <div className="text-right">
                                        {appliedDiscount > 0 && (
                                            <span className="block text-sm text-gray-400 line-through">
                                                {isGroup
                                                    ? groupData.attendees.reduce((sum, a) => sum + parseInt(a.amount || '0'), 0)
                                                    : formData.amount} ETB
                                            </span>
                                        )}
                                        <span className="text-2xl font-bold text-blue-900">{calculateTotalAmount()} ETB</span>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-6 border-t">
                                    <button
                                        type="button"
                                        onClick={handlePayment}
                                        disabled={paymentLoading}
                                        className="px-8 py-3 bg-[#3DADB7] text-white font-semibold rounded-lg hover:bg-[#2c8a92] transition-colors shadow-sm flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {paymentLoading ? (
                                            t.processing
                                        ) : (
                                            <>
                                                <CreditCard className="mr-2 h-5 w-5" />
                                                {!isTelebirrSelected
                                                    ? t.registerManual
                                                    : (parseFloat(calculateTotalAmount()) === 0 ? t.registerNow : t.payAndRegister)
                                                }
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                <div className='mt-6 text-center text-sm text-gray-500'>
                    <p className="text-center">{t.poweredBy}</p>
                </div>
                <div className="mt-2 text-center text-sm text-gray-500">
                    &copy; {new Date().getFullYear()} {t.copyright}
                </div>
            </div>
        </div>
    );
}

