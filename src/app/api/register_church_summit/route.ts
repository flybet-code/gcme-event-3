import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { assignTicketNumbers } from '@/lib/tickets';
import { assignMembersToGroups } from '@/lib/groups';
import { NextRequest, NextResponse } from 'next/server';
import { getPhoneVariations, getPhoneFormatsForLookup, normalizePhone } from '@/lib/phone';
import {
    canModifyRegistrationInOrg,
    getDefaultOrganizationId,
    resolveActiveOrganization,
} from '@/lib/tenancy/active-org-server';
import { getResolvedBadgeTemplateSrcForOrg } from '@/lib/badge-template-server';
import {
    DEFAULT_SUMMIT_PAYMENT_METHODS,
    getSummitPricingForRegistrationApi,
    normalizeCouponRecord,
    resolveLinePriceEtb,
    type SummitPaymentMethodConfig,
} from '@/lib/summit-registration-config';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';
import { getDefaultRegistrationFormIdFromSettings } from '@/lib/org-settings';
/**
 * POST /api/register_church_summit
 * Create a new church summit registration
 *
 * @deprecated Prefer POST /api/register with orgSlug + eventSlug for multi-tenant dynamic forms.
 * This route remains for backward compatibility with the legacy fixed Registration model.
 */



function extractCouponsFromSettings(raw: unknown): Record<string, number> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const settings = raw as Record<string, unknown>;
    const summitBlock = (settings.summitRegistration ?? settings.summitDefaults) as
        | Record<string, unknown>
        | undefined;
    const coupons = summitBlock?.coupons;
    if (!coupons || typeof coupons !== 'object' || Array.isArray(coupons)) return {};
    return normalizeCouponRecord(coupons as Record<string, number>);
}

function extractPaymentMethodsFromSettings(raw: unknown): SummitPaymentMethodConfig[] {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const settings = raw as Record<string, unknown>;
    const summitBlock = (settings.summitRegistration ?? settings.summitDefaults) as
        | Record<string, unknown>
        | undefined;
    const methods = summitBlock?.paymentMethods;
    if (!Array.isArray(methods)) return [];
    return methods as SummitPaymentMethodConfig[];
}

function toShortPaymentLabel(method: SummitPaymentMethodConfig): string {
    const explicit = (method.shortLabel || '').trim();
    if (explicit) return explicit.toUpperCase();
    const label = (method.label || '').trim();
    if (!label) return (method.id || '').trim().toUpperCase();
    const words = label
        .split(/\s+/)
        .map((w) => w.trim())
        .filter(Boolean);
    if (words.length >= 2) return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
    return label.slice(0, 2).toUpperCase();
}

function buildPaymentTypeLabelMap(methods: SummitPaymentMethodConfig[]): Record<string, string> {
    const out: Record<string, string> = {
        TELEBIRR: 'TB',
        BANK_TRANSFER: 'BANK',
        CASH: 'CASH',
        CBE: 'CBE',
        BRN: 'BR',
    };
    methods.forEach((m) => {
        out[m.id] = toShortPaymentLabel(m);
    });
    const bankMethods = methods.filter((m) => m.type === 'bank');
    bankMethods.forEach((m, idx) => {
        out[`BANK_${idx}`] = toShortPaymentLabel(m);
    });
    return out;
}

function buildPaymentTypeInfoMap(
    methods: SummitPaymentMethodConfig[]
): Record<string, { label: string; shortLabel: string }> {
    const out: Record<string, { label: string; shortLabel: string }> = {
        TELEBIRR: { label: 'Telebirr', shortLabel: 'TB' },
        BANK_TRANSFER: { label: 'Bank Transfer', shortLabel: 'BANK' },
        CASH: { label: 'Cash', shortLabel: 'CASH' },
        CBE: { label: 'Commercial Bank of Ethiopia', shortLabel: 'CBE' },
        BRN: { label: 'Berhan Bank', shortLabel: 'BR' },
    };
    methods.forEach((m) => {
        out[m.id] = {
            label: m.label || m.id,
            shortLabel: toShortPaymentLabel(m),
        };
    });
    const bankMethods = methods.filter((m) => m.type === 'bank');
    bankMethods.forEach((m, idx) => {
        out[`BANK_${idx}`] = {
            label: m.label || `Bank ${idx + 1}`,
            shortLabel: toShortPaymentLabel(m),
        };
    });
    return out;
}

export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown_ip';

        // --- Rate Limiting Removed ---
        // -----------------------------

        const body = await request.json();

        // --- Honeypot Check ---
        if (body.website) {
            console.warn(`Bot detected via honeypot from IP: ${ip}`);
            return NextResponse.json({ error: 'Submission rejected' }, { status: 400 });
        }
        // ----------------------

        // --- SECURITY: CSRF & Origin Check ---
        const origin = request.headers.get('origin');
        const referer = request.headers.get('referer');

        // Allowed domains
        const allowedOrigins = [
            'https://event.dsethiopia.org',
            'http://localhost:3001'
        ];

        // Add configured APP_URL if present
        if (process.env.NEXT_PUBLIC_APP_URL) {
            allowedOrigins.push(process.env.NEXT_PUBLIC_APP_URL);
        }

        const isAllowedOrigin = origin && allowedOrigins.some(allowed => origin.startsWith(allowed));
        const isAllowedReferer = referer && allowedOrigins.some(allowed => referer.startsWith(allowed));

        // Block if Origin is present but invalid, or if Origin is missing but Referer is invalid
        // (Note: Valid non-browser tools might miss these headers, but browser forms will send them)
        if (origin && !isAllowedOrigin) {
            return NextResponse.json({ error: 'Forbidden: Invalid Request Origin' }, { status: 403 });
        }
        if (!origin && referer && !isAllowedReferer) {
            return NextResponse.json({ error: 'Forbidden: Invalid Request Referer' }, { status: 403 });
        }
        // -------------------------------------
        const {
            title,
            fullName,
            churchName,
            serviceRole,
            phoneNumber,
            email,
            paymentStatus,
            amount,
            isGroup,
            attendees,
            transactionReference,
            paymentType,
            couponCode,
            discountApplied,
            receiptPath,
            responses
        } = body;

        // --- MAP DYNAMIC RESPONSES TO LEGACY FIELDS ---
        const mappedFullName = fullName || responses?.full_name || responses?.name || (isGroup ? `${churchName} Group` : '');
        const mappedPhoneNumber = phoneNumber || responses?.phone || responses?.phone_number;
        const mappedEmail = email || responses?.email || responses?.email_address;
        const mappedChurchName = churchName || responses?.church_name || responses?.church;
        const mappedServiceRole = serviceRole || responses?.service_role || responses?.role;
        // ----------------------------------------------

        const orgSlugIn = typeof body.orgSlug === 'string' ? body.orgSlug.trim() : '';
        const eventSlugIn = typeof body.eventSlug === 'string' ? body.eventSlug.trim() : '';

        let tenantOrgId: string;
        let resolvedEventId: string | null = null;

        if (orgSlugIn && eventSlugIn) {
            const org = await prisma.organization.findUnique({ where: { slug: orgSlugIn } });
            if (!org) {
                return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
            }
            const event = await prisma.event.findUnique({
                where: {
                    organizationId_slug: {
                        organizationId: org.id,
                        slug: eventSlugIn,
                    },
                },
            });
            if (!event) {
                return NextResponse.json({ error: 'Event not found' }, { status: 400 });
            }
            tenantOrgId = org.id;
            resolvedEventId = event.id;
        } else {
            const def = await getDefaultOrganizationId();
            if (!def) {
                return NextResponse.json(
                    { error: 'Server configuration error: no default organization' },
                    { status: 500 }
                );
            }
            tenantOrgId = def;
        }

        const scopeDuplicate = {
            organizationId: tenantOrgId,
            ...(resolvedEventId ? { eventId: resolvedEventId } : {}),
        };

        // Validate required fields
        if (!mappedChurchName || !mappedPhoneNumber || !paymentStatus || !amount) {
            return NextResponse.json(
                { error: 'Required fields are missing' },
                { status: 400 }
            );
        }

        // Detect Payment Method
        let finalPaymentType = paymentType || 'TELEBIRR';
        let finalPaymentStatus = 'pending'; // Force pending for security

        // --- Fetch Dynamic Coupons/Settings (form > event > org > legacy default) ---
        const [orgForCoupons, eventForCoupons] = await Promise.all([
            prisma.organization.findUnique({
                where: { id: tenantOrgId },
                select: { settings: true },
            }),
            resolvedEventId
                ? prisma.event.findUnique({
                      where: { id: resolvedEventId },
                      select: {
                          settings: true,
                          registrationForm: { select: { i18nMeta: true } },
                      },
                  })
                : Promise.resolve(null),
        ]);

        const orgCoupons = extractCouponsFromSettings(orgForCoupons?.settings);
        const eventCoupons = extractCouponsFromSettings(eventForCoupons?.settings);
        const formMeta = eventForCoupons?.registrationForm?.i18nMeta as
            | { registrationSettings?: { coupons?: Record<string, number> } }
            | null;
        const formCoupons = normalizeCouponRecord(formMeta?.registrationSettings?.coupons);
        const effectiveCoupons: Record<string, number> = { ...orgCoupons, ...eventCoupons, ...formCoupons };

        const normalizedCoupon = typeof couponCode === 'string' ? couponCode.trim().toUpperCase() : '';
        const isPaymentShortcut = normalizedCoupon === 'CASH' || normalizedCoupon === 'BANK';
        if (normalizedCoupon && !isPaymentShortcut && !effectiveCoupons[normalizedCoupon]) {
            return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 });
        }

        // --- SECURITY: Server-side Amount Calculation ---
        // Do not trust the amount sent from the client — use form/org/event list price + per-role overrides.
        const { listBasePriceEtb, registrationSettings } = await getSummitPricingForRegistrationApi(
            tenantOrgId,
            resolvedEventId
        );
        let calculatedAmount = 0;

        if (isGroup) {
            const list = Array.isArray(attendees) ? attendees : [];
            calculatedAmount = list.reduce(
                (sum: number, a: { role?: string }) =>
                    sum + resolveLinePriceEtb(listBasePriceEtb, registrationSettings, a?.role),
                0
            );
        } else {
            calculatedAmount = resolveLinePriceEtb(listBasePriceEtb, registrationSettings, mappedServiceRole);
        }

        // Coupon discount fraction (0 = none). CASH/BANK are payment shortcuts, not discounts here.
        const applicableDiscountFrac =
            normalizedCoupon && !isPaymentShortcut && effectiveCoupons[normalizedCoupon]
                ? effectiveCoupons[normalizedCoupon]
                : 0;

        // `Registration.amount` stores list/event line totals (like the registration form). Net due after
        // coupon is not stored here—use couponCode + discountApplied for reporting.

        if (applicableDiscountFrac === 1) {
            finalPaymentStatus = 'pending'; // Free / fully comped still requires verification
        }

        if (normalizedCoupon === 'CASH') {
            finalPaymentType = 'CASH';
            finalPaymentStatus = 'pending';
        } else if (normalizedCoupon === 'BANK') {
            finalPaymentType = 'BANK_TRANSFER';
            finalPaymentStatus = 'pending';
        }
        // --- UNIQUE PHONE CHECK (Only block if payment is completed) ---
        // Use normalized formats so 09..., 9..., +251... are treated as same number
        const mainPhoneFormats = getPhoneFormatsForLookup(String(mappedPhoneNumber || '').trim());

        const phoneExists = await prisma.registration.findFirst({
            where: {
                ...scopeDuplicate,
                phoneNumber: { in: mainPhoneFormats },
                deletedAt: null,
                paymentStatus: 'PAY_SUCCESS'
            }
        });

        if (phoneExists) {
            return NextResponse.json(
                { error: 'This phone number already has a completed registration. You cannot register again with the same number.' },
                { status: 400 }
            );
        }

        const attendeePhoneExists = await prisma.attendee.findFirst({
            where: {
                phoneNumber: { in: mainPhoneFormats },
                registration: {
                    ...scopeDuplicate,
                    deletedAt: null,
                    paymentStatus: 'PAY_SUCCESS'
                }
            }
        });

        if (attendeePhoneExists) {
            return NextResponse.json(
                { error: 'This phone number is already part of a completed group registration.' },
                { status: 400 }
            );
        }

        if (isGroup && attendees && Array.isArray(attendees)) {
            // Each attendee must have a unique phone (contact may be one of the attendees)
            for (const attendee of attendees) {
                if (attendee.phoneNumber) {
                    const attFormats = getPhoneFormatsForLookup(attendee.phoneNumber);
                    const regExists = await prisma.registration.findFirst({
                        where: {
                            ...scopeDuplicate,
                            phoneNumber: { in: attFormats },
                            deletedAt: null,
                            paymentStatus: 'PAY_SUCCESS'
                        }
                    });
                    if (regExists) {
                        return NextResponse.json(
                            { error: `Attendee ${attendee.fullName}'s phone number already has a completed registration. Each person must use a unique number.` },
                            { status: 400 }
                        );
                    }

                    const attExists = await prisma.attendee.findFirst({
                        where: {
                            phoneNumber: { in: attFormats },
                            registration: {
                                ...scopeDuplicate,
                                deletedAt: null,
                                paymentStatus: 'PAY_SUCCESS'
                            }
                        }
                    });
                    if (attExists) {
                        return NextResponse.json(
                            { error: `Attendee ${attendee.fullName}'s phone number is already part of a completed group registration.` },
                            { status: 400 }
                        );
                    }
                }
            }

            // Duplicate phones within the attendee list: each attendee must have a unique number
            const submittedCores = attendees
                .map(a => a.phoneNumber && normalizePhone(a.phoneNumber))
                .filter((p): p is string => !!p);

            const uniqueCores = new Set(submittedCores);
            if (uniqueCores.size !== submittedCores.length) {
                return NextResponse.json(
                    { error: 'Duplicate phone numbers in the attendee list. Each attendee must have a unique phone number.' },
                    { status: 400 }
                );
            }
        }
        // ------------------------------------------------

        // Insert registration into database using Prisma
        let registration = await prisma.registration.create({
            data: {
                organizationId: tenantOrgId,
                ...(resolvedEventId ? { eventId: resolvedEventId } : {}),
                title: title || undefined,
                fullName: mappedFullName,
                churchName: mappedChurchName,
                serviceRole: mappedServiceRole,
                phoneNumber: mappedPhoneNumber,
                email: mappedEmail,
                paymentStatus: finalPaymentStatus,
                paymentType: finalPaymentType, // Store specific bank name if needed, or mapped type
                transactionReference: transactionReference || undefined,
                receiptPath: receiptPath || undefined,
                amount: String(Math.round(calculatedAmount)),
                isGroup: !!isGroup,
                couponCode: couponCode || undefined,
                discountApplied: discountApplied || undefined,
                responses: responses || undefined,
                attendees: {
                    create: (attendees || []).map((a: any) => ({
                        title: a.title || undefined,
                        fullName: a.fullName,
                        role: a.role,
                        amount: String(resolveLinePriceEtb(listBasePriceEtb, registrationSettings, a?.role)),
                        phoneNumber: a.phoneNumber || '',
                        responses: a.responses || undefined,
                    }))
                }
            },
            include: {
                attendees: {
                    orderBy: { id: 'asc' },
                    include: { vendor: true, group: true }
                }
            }
        });

        // If payment is already successful (e.g. Free/Staff coupon), assign ticket numbers immediately
        if (finalPaymentStatus === 'PAY_SUCCESS') {
            await assignTicketNumbers(Number(registration.id));
            // Re-fetch to get the assigned ticket numbers
            const updatedReg = await prisma.registration.findUnique({
                where: { id: registration.id },
                include: {
                    attendees: {
                        orderBy: { id: 'asc' },
                        include: { vendor: true, group: true }
                    },
                    vendor: true,
                    group: true
                }
            });
            if (updatedReg) {
                registration = updatedReg;
            }
        }
        // ------------------------------------------------

        // Auto-assign members based on active groups
        await assignMembersToGroups();

        return NextResponse.json({
            message: 'Registration successful',
            id: registration.id,
            data: registration
        }, { status: 200 });

    } catch (error) {
        console.error('Error inserting data:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/register_church_summit
 * Fetch all church summit registrations
 */
export async function GET(request: NextRequest) {
    try {
        // Public access allowed for attendance search functionality

        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const search = searchParams.get('search') || '';
        const phoneNumberParam = searchParams.get('phoneNumber') || '';
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

        const dateFilter = searchParams.get('dateFilter') || 'all';
        const statusFilter = searchParams.get('statusFilter') || 'all';
        const printedFilter = searchParams.get('printedFilter') || 'all';
        const vendorId = searchParams.get('vendorId');
        const groupId = searchParams.get('groupId');

        const session = await auth.api.getSession({ headers: request.headers });
        let orgScopeId: string | null = null;
        if (session?.user?.id) {
            const orgRes = await resolveActiveOrganization(session);
            if (!orgRes.ok) {
                return NextResponse.json({ error: orgRes.message }, { status: orgRes.status });
            }
            orgScopeId = orgRes.organizationId;
        } else {
            orgScopeId = await getDefaultOrganizationId();
        }
        if (!orgScopeId) {
            return NextResponse.json(
                { error: 'No default organization configured' },
                { status: 503 }
            );
        }

        // Build where clause
        const where: any = { organizationId: orgScopeId };

        // Printed Filter
        if (printedFilter === 'printed') {
            where.isBadgePrinted = true;
        } else if (printedFilter === 'unprinted') {
            where.isBadgePrinted = false;
        }

        if (vendorId) {
            if (vendorId === 'none') {
                where.AND = [
                    ...(where.AND || []),
                    { vendorId: null },
                    { attendees: { none: { vendorId: { not: null } } } }
                ];
            } else {
                where.OR = [
                    { vendorId: vendorId },
                    { attendees: { some: { vendorId: vendorId } } }
                ];
            }
        }

        if (groupId) {
            if (groupId === 'none') {
                where.AND = [
                    ...(where.AND || []),
                    { groupId: null },
                    { attendees: { none: { groupId: { not: null } } } }
                ];
            } else {
                where.OR = [
                    ...(where.OR || []),
                    { groupId: groupId },
                    { attendees: { some: { groupId: groupId } } }
                ];
            }
        }

        if (statusFilter === 'deleted') {
            where.deletedAt = { not: null };
        } else {
            where.deletedAt = null;

            // Status Filter
            if (statusFilter === 'completed') {
                where.paymentStatus = 'PAY_SUCCESS';
            } else if (statusFilter === 'pending') {
                where.paymentStatus = { not: 'PAY_SUCCESS' };
            }
        }

        // Date Filter
        if (dateFilter !== 'all') {
            const now = new Date();
            const pastDate = new Date();
            if (dateFilter === 'last30') {
                pastDate.setDate(now.getDate() - 30);
            } else if (dateFilter === 'last7') {
                pastDate.setDate(now.getDate() - 7);
            }
            where.createdAt = { gte: pastDate };
        }

        // Search Filter
        if (search || phoneNumberParam) {
            const searchQuery = search || phoneNumberParam;
            const searchAsInt = parseInt(searchQuery);
            const isNumeric = !isNaN(searchAsInt) && /^\d+$/.test(searchQuery);

            // Phone search logic
            const phoneVariations = getPhoneVariations(searchQuery);
            const phoneFilters = phoneVariations.map(v => ({ phoneNumber: { contains: v } }));

            // If it's numeric, we want to support "starts with" search for ticket numbers.
            // Since ticketNumber is an Int, we use ranges.
            const numericFilters = [];
            if (isNumeric && !searchQuery.startsWith('0') && !searchQuery.startsWith('+')) {
                const searchVal = parseInt(searchQuery);
                numericFilters.push({ id: searchVal });
                numericFilters.push({ ticketNumber: searchVal });

                // If query is short, add range filters to support "starts with" 
                // e.g. "20" matches 200-209, 2000-2099, 20000-20999
                if (searchQuery.length < 5) {
                    [10, 100, 1000, 10000].forEach(multiplier => {
                        const low = searchVal * multiplier;
                        const high = (searchVal + 1) * multiplier - 1;
                        numericFilters.push({ ticketNumber: { gte: low, lte: high } });
                    });
                }
            }

            where.OR = [
                { fullName: { contains: searchQuery, mode: 'insensitive' } },
                { churchName: { contains: searchQuery, mode: 'insensitive' } },
                { email: { contains: searchQuery, mode: 'insensitive' } },
                ...phoneFilters,
                { serviceRole: { contains: searchQuery, mode: 'insensitive' } },
                ...numericFilters,
                {
                    attendees: {
                        some: {
                            OR: [
                                { fullName: { contains: searchQuery, mode: 'insensitive' } },
                                ...phoneFilters,
                                { role: { contains: searchQuery, mode: 'insensitive' } },
                                ...numericFilters.map(f => {
                                    if (f.ticketNumber) return { ticketNumber: f.ticketNumber };
                                    return null;
                                }).filter(Boolean) as any
                            ]
                        }
                    }
                }
            ];
        }

        // Fetch data and count
        const [allRegistrations, totalItems] = await Promise.all([
            prisma.registration.findMany({
                where,
                include: {
                    attendees: {
                        orderBy: { id: 'asc' },
                        // @ts-ignore
                        include: { vendor: true, group: true }
                    },
                    vendor: true,
                    group: true
                },
                orderBy: { [sortBy]: sortOrder },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.registration.count({ where })
        ]);

        // Calculate stats (Exclude deleted registrations from all dashboard metrics as per user request)
        const statsData = await prisma.registration.findMany({
            where: { ...where, deletedAt: null },
            select: {
                paymentStatus: true,
                amount: true,
                isGroup: true,
                paymentType: true,
                couponCode: true,
                discountApplied: true,
                attendees: { select: { id: true } }
            }
        });

        const stats = statsData.reduce((acc: any, reg: any) => {
            const attendeeCount = reg.isGroup ? (reg.attendees?.length || 0) : 1;
            const amount = parseFloat(reg.amount || '0');

            acc.totalRegistrations += attendeeCount;

            if (reg.paymentStatus === 'PAY_SUCCESS') {
                acc.totalCompleted += attendeeCount;
                const hasCoupon = reg.couponCode && reg.couponCode.trim() !== '';
                const hasDiscount = reg.discountApplied && reg.discountApplied.trim() !== '';
                // Any 100% OFF or discount applied or even 0 amount is considered sponsored as requested
                const isSponsored = hasCoupon || hasDiscount || amount === 0;

                // For sponsored registrations, we count their full value based on base price
                // regardless of what was actually paid (even if it was a partial discount)
                // This ensures "Sponsored Revenue" reflects the total value of the registration sponsorship
                const regValue = amount;

                if (isSponsored) {
                    acc.sponsoredRevenue += regValue;
                    acc.sponsoredCount += attendeeCount;
                } else {
                    acc.cashRevenue += regValue;
                    acc.totalCashCount += attendeeCount;
                }

                // totalRevenue now represents the combined value (Total Revenue All)
                acc.totalRevenue = acc.cashRevenue + acc.sponsoredRevenue;
                acc.allTransactionsRevenue = acc.totalRevenue;

                // Track revenue and counts by payment type
                if (reg.paymentType === 'TELEBIRR') {
                    acc.telebirrTotalCount += attendeeCount;
                    if (!isSponsored) {
                        acc.telebirrRevenue += amount;
                        acc.telebirrCount += attendeeCount;
                    }
                } else if (reg.paymentType === 'CBE') {
                    acc.cbeTotalCount += attendeeCount;
                    if (!isSponsored) {
                        acc.cbeRevenue += amount;
                        acc.cbeCount += attendeeCount;
                    }
                } else if (reg.paymentType === 'BRN') {
                    acc.brnTotalCount += attendeeCount;
                    if (!isSponsored) {
                        acc.brnRevenue += amount;
                        acc.brnCount += attendeeCount;
                    }
                } else if (reg.paymentType === 'BANK_TRANSFER') {
                    acc.bankTransferTotalCount += attendeeCount;
                    if (!isSponsored) {
                        acc.bankTransferRevenue += amount;
                        acc.bankTransferCount += attendeeCount;
                    }
                }
            } else {
                acc.totalPending += attendeeCount;
            }
            return acc;
        }, {
            totalRegistrations: 0,
            totalRevenue: 0, // Combined Sum
            cashRevenue: 0,  // Pure Cash Collected
            totalCashCount: 0,
            sponsoredRevenue: 0,
            allTransactionsRevenue: 0,
            sponsoredCount: 0,
            totalPending: 0,
            totalCompleted: 0,
            // Revenue by payment type (Cash-only stats)
            telebirrRevenue: 0,
            telebirrCount: 0,
            telebirrTotalCount: 0,
            cbeRevenue: 0,
            cbeCount: 0,
            cbeTotalCount: 0,
            brnRevenue: 0,
            brnCount: 0,
            brnTotalCount: 0,
            bankTransferRevenue: 0,
            bankTransferCount: 0,
            bankTransferTotalCount: 0
        });

        const totalPages = Math.ceil(totalItems / limit);

        const badgeTemplateSrc = await getResolvedBadgeTemplateSrcForOrg(orgScopeId);

        let showTitleField = true;
        const orgForMeta = await prisma.organization.findUnique({
            where: { id: orgScopeId },
            select: { settings: true },
        });
        let paymentMethods: SummitPaymentMethodConfig[] = extractPaymentMethodsFromSettings(orgForMeta?.settings);
        const defaultFormId = getDefaultRegistrationFormIdFromSettings(orgForMeta?.settings);
        if (defaultFormId) {
            const metaForm = await prisma.form.findFirst({
                where: { id: defaultFormId, organizationId: orgScopeId },
                select: { i18nMeta: true },
            });
            const rs = (metaForm?.i18nMeta as {
                registrationSettings?: { showTitleField?: boolean; paymentMethods?: string[] };
            } | null)
                ?.registrationSettings;
            if (rs?.showTitleField === false) {
                showTitleField = false;
            }
            if ((!paymentMethods || paymentMethods.length === 0) && rs?.paymentMethods?.length) {
                paymentMethods = DEFAULT_SUMMIT_PAYMENT_METHODS.filter((m) => rs.paymentMethods?.includes(m.id));
            }
        }
        if (!paymentMethods || paymentMethods.length === 0) {
            paymentMethods = DEFAULT_SUMMIT_PAYMENT_METHODS;
        }
        const paymentTypeLabelMap = buildPaymentTypeLabelMap(paymentMethods);
        const paymentTypeInfoMap = buildPaymentTypeInfoMap(paymentMethods);

        return NextResponse.json({
            data: allRegistrations,
            badgeTemplateSrc,
            meta: {
                page,
                limit,
                totalItems,
                totalPages,
                showTitleField,
                paymentTypeLabelMap,
                paymentTypeInfoMap,
            },
            stats
        }, { status: 200 });
    } catch (error) {
        console.error('Error fetching data:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        // --- Security Check: Super Admin or Delete Permission ---
        const session = await auth.api.getSession({
            headers: request.headers
        });

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                role: {
                    include: { permissions: true }
                }
            }
        });

        const isFullAdmin = hasPlatformElevatedAccess(user?.isPlatformSuperAdmin, user?.role?.name);

        const orgRes = await resolveActiveOrganization(session);
        if (!isFullAdmin && !orgRes.ok) {
            return NextResponse.json({ error: orgRes.message }, { status: orgRes.status });
        }
        const orgScopeId = orgRes.ok ? orgRes.organizationId : null;

        const canDelete =
            isFullAdmin ||
            (orgRes.ok &&
                (await canModifyRegistrationInOrg(session.user.id, orgRes.organizationId, 'delete')));

        if (!canDelete) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }
        // -----------------------------------------

        const body = await request.json();
        const { ids } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'Valid IDs are required' }, { status: 400 });
        }

        // Perform bulk soft delete (platform Admin / Super Admin may span orgs)
        if (isFullAdmin) {
            await prisma.registration.updateMany({
                where: { id: { in: ids } },
                data: { deletedAt: new Date() },
            });
        } else {
            if (!orgScopeId) {
                return NextResponse.json({ error: 'No active organization scope' }, { status: 403 });
            }
            await prisma.registration.updateMany({
                where: {
                    id: { in: ids },
                    organizationId: orgScopeId,
                },
                data: {
                    deletedAt: new Date(),
                },
            });
        }

        return NextResponse.json({ message: `${ids.length} registrations deleted successfully` }, { status: 200 });
    } catch (error) {
        console.error('Error bulk deleting registrations:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
