import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getPhoneVariations } from '@/lib/phone';
import { getDefaultOrganizationId } from '@/lib/tenancy/active-org-server';
import { getResolvedBadgeTemplateSrcForOrg } from '@/lib/badge-template-server';
import { getDefaultRegistrationFormIdFromSettings } from '@/lib/org-settings';

export async function GET(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown_ip';

        // --- Rate Limiting Removed ---
        // -----------------------------

        const { searchParams } = new URL(request.url);

        const phone = searchParams.get('phone');

        if (!phone) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        const tenantOrgId = await getDefaultOrganizationId();
        if (!tenantOrgId) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 503 });
        }

        const searchAsInt = parseInt(phone);
        const isNumeric = !isNaN(searchAsInt) && /^\d+$/.test(phone);

        // Phone search logic
        const phoneVariations = getPhoneVariations(phone);
        const phoneFilters = phoneVariations.map(v => ({ phoneNumber: { contains: v } }));

        // If it's numeric, support "starts with" search for ticket numbers via ranges.
        const numericFilters: any[] = [];
        if (isNumeric && !phone.startsWith('0') && !phone.startsWith('+')) {
            numericFilters.push({ ticketNumber: searchAsInt });
            [10, 100, 1000, 10000].forEach(multiplier => {
                const low = searchAsInt * multiplier;
                const high = (searchAsInt + 1) * multiplier - 1;
                numericFilters.push({ ticketNumber: { gte: low, lte: high } });
            });
        }

        // Search for registrations where the main phone matches OR any attendee's phone matches
        // OR ticket number matches.
        // AND the payment is successful.
        const registrations = await prisma.registration.findMany({
            where: {
                organizationId: tenantOrgId,
                OR: [
                    ...phoneFilters,
                    { attendees: { some: { OR: phoneFilters } } },
                    ...(numericFilters.length > 0 ? [
                        ...numericFilters,
                        { attendees: { some: { OR: numericFilters } } }
                    ] : [])
                ],
                paymentStatus: 'PAY_SUCCESS',
                deletedAt: null
            },
            include: {
                attendees: {
                    orderBy: { id: 'asc' }
                }
            }
        });

        const results: any[] = [];

        (registrations as any[]).forEach(reg => {
            if (reg.isGroup) {
                (reg.attendees as any[]).forEach((att, idx) => {
                    // Check if attendee matches phone, ticket number OR if the main contact matches
                    const isPhoneMatch = att.phoneNumber?.includes(phone) || reg.phoneNumber.includes(phone);
                    const ticketStr = String(att.ticketNumber || '');
                    const regTicketStr = String(reg.ticketNumber || '');
                    const isTicketMatch = isNumeric && (ticketStr.startsWith(phone) || regTicketStr.startsWith(phone));

                    if (isPhoneMatch || isTicketMatch) {
                        results.push({
                            id: `CLS-${reg.id}-${att.id}`,
                            rawId: reg.id,
                            attId: att.id,
                            index: idx,
                            title: att.title,
                            fullName: att.fullName,
                            role: att.role,
                            churchName: reg.churchName,
                            type: 'group',
                            ticketNo: att.ticketNumber || (idx + 1)
                        });
                    }
                });
            } else {
                results.push({
                    id: `CLS-${reg.id}`,
                    rawId: reg.id,
                    title: reg.title,
                    fullName: reg.fullName,
                    role: reg.serviceRole,
                    churchName: reg.churchName,
                    type: 'individual',
                    ticketNo: reg.ticketNumber || reg.id
                });
            }
        });

        // Dedup results if phone search is fuzzy
        const uniqueResults = results.filter((v, i, a) => a.findIndex(t => (t.ticketNo === v.ticketNo)) === i);

        const badgeTemplateSrc = await getResolvedBadgeTemplateSrcForOrg(tenantOrgId);

        let showTitleField = true;
        const orgRow = await prisma.organization.findUnique({
            where: { id: tenantOrgId },
            select: { settings: true },
        });
        const defaultFormId = getDefaultRegistrationFormIdFromSettings(orgRow?.settings);
        if (defaultFormId) {
            const metaForm = await prisma.form.findFirst({
                where: { id: defaultFormId, organizationId: tenantOrgId },
                select: { i18nMeta: true },
            });
            const rs = (metaForm?.i18nMeta as { registrationSettings?: { showTitleField?: boolean } } | null)
                ?.registrationSettings;
            if (rs?.showTitleField === false) {
                showTitleField = false;
            }
        }

        return NextResponse.json({ data: uniqueResults, badgeTemplateSrc, showTitleField });
    } catch (error) {
        console.error('Search API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
