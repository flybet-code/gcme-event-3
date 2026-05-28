import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resolveActiveOrganization } from '@/lib/tenancy/active-org-server';

/**
 * GET /api/vendors/usage-details
 * Get list of participants who used services for a specific vendor on a specific day
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const orgRes = await resolveActiveOrganization(session);
        if (!orgRes.ok) {
            return NextResponse.json({ error: orgRes.message }, { status: orgRes.status });
        }
        const orgId = orgRes.organizationId;

        const { searchParams } = new URL(request.url);
        const vendorId = searchParams.get('vendorId');
        const day = searchParams.get('day');
        const activityId = searchParams.get('activityId');
        const search = searchParams.get('search') || '';

        if (!vendorId || !day) {
            return NextResponse.json({ error: 'Vendor ID and Day are required' }, { status: 400 });
        }

        const dayNum = parseInt(day);

        const vendor = await prisma.vendor.findFirst({
            where: { id: vendorId, organizationId: orgId },
            select: { name: true }
        });

        if (!vendor) {
            return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
        }

        // Fetch registrations and attendees for this vendor
        // We'll filter them in memory to get the exact activity lists
        const [registrations, attendees] = await Promise.all([
            prisma.registration.findMany({
                where: {
                    organizationId: orgId,
                    vendorId: vendorId,
                    paymentStatus: 'PAY_SUCCESS',
                    deletedAt: null,
                    isGroup: false // Groups are handled via attendees
                },
                select: {
                    id: true,
                    fullName: true,
                    serviceRole: true,
                    churchName: true,
                    ticketNumber: true,
                    phoneNumber: true,
                    activities: true
                }
            }),
            prisma.attendee.findMany({
                where: {
                    OR: [
                        { vendorId: vendorId },
                        {
                            AND: [
                                { OR: [{ vendorId: null }, { vendorId: "" }] },
                                { registration: { vendorId: vendorId } }
                            ]
                        }
                    ],
                    registration: {
                        organizationId: orgId,
                        paymentStatus: 'PAY_SUCCESS',
                        deletedAt: null
                    }
                },
                select: {
                    id: true,
                    fullName: true,
                    role: true,
                    phoneNumber: true,
                    activities: true,
                    ticketNumber: true,
                    registration: {
                        select: {
                            churchName: true,
                            phoneNumber: true
                        }
                    }
                }
            })
        ]);

        const participantsMap = new Map<string, any>();

        const processItem = (item: any, isAttendee: boolean) => {
            const rawActivities = item.activities;
            let activities: any = {};

            if (rawActivities) {
                if (typeof rawActivities === 'string') {
                    try {
                        activities = JSON.parse(rawActivities);
                    } catch (e) {
                        activities = {};
                    }
                } else {
                    activities = rawActivities;
                }
            }

            const key = `${isAttendee ? 'ATT' : 'REG'}-${item.id}`;

            // Check if this participant has any activity for the selected day
            const hasActivityForDay = Object.keys(activities).some(actId => actId.includes(`_day${dayNum}`));

            // If we filter by activityId, check that specifically
            if (activityId) {
                if (!activities[activityId]) return;
            } else if (!hasActivityForDay) {
                return;
            }

            // --- Search Filtering ---
            if (search) {
                const s = search.toLowerCase();
                const name = (item.fullName || '').toLowerCase();
                const ticket = String(item.ticketNumber || '').toLowerCase();

                // Smart Phone Match (last 8 digits)
                const phone = (item.phoneNumber || item.registration?.phoneNumber || '').toLowerCase();
                let isPhoneMatch = phone.includes(s);
                if (!isPhoneMatch && s.replace(/[^\d]/g, '').length >= 8) {
                    const cleanS = s.replace(/[^\d]/g, '').slice(-8);
                    const cleanPhone = phone.replace(/[^\d]/g, '');
                    isPhoneMatch = cleanPhone.includes(cleanS);
                }

                const isMatch = name.includes(s) || ticket.includes(s) || isPhoneMatch;
                if (!isMatch) return;
            }
            // ------------------------

            if (!participantsMap.has(key)) {
                participantsMap.set(key, {
                    id: item.id,
                    name: item.fullName || 'Unknown',
                    role: isAttendee ? item.role : item.serviceRole,
                    church: isAttendee ? (item.registration?.churchName || 'N/A') : (item.churchName || 'N/A'),
                    ticketNumber: item.ticketNumber,
                    type: isAttendee ? 'Attendee' : 'Registration',
                    check_in: null,
                    tea_am: null,
                    lunch: null,
                    tea_pm: null
                });
            }

            const p = participantsMap.get(key);
            Object.entries(activities).forEach(([act, timestamp]) => {
                if (!act.includes(`_day${dayNum}`)) return;

                if (act.startsWith('check_in_day')) p.check_in = timestamp;
                else if (act.includes('tea_break') && act.includes('_am')) p.tea_am = timestamp;
                else if (act.includes('lunch')) p.lunch = timestamp;
                else if (act.includes('tea_break') && act.includes('_pm')) p.tea_pm = timestamp;
            });
        };

        registrations.forEach(r => processItem(r, false));
        attendees.forEach(a => processItem(a, true));

        const results = Array.from(participantsMap.values());

        // Sort by name
        results.sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json({
            vendorName: vendor.name,
            day: dayNum,
            participants: results || []
        });

    } catch (error) {
        console.error('Error fetching usage details:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
