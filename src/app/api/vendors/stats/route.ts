import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { resolveActiveOrganization } from '@/lib/tenancy/active-org-server';

/**
 * GET /api/vendors/stats
 * Get check-in statistics for each vendor across different meal/tea break activities
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
        const day = searchParams.get('day'); // '1', '2', '3' or null for all

        // Define activities we care about for vendors
        const activityPrefixes = ['lunch_day', 'tea_break_day', 'check_in_day'];

        const vendors = await prisma.vendor.findMany({
            where: { organizationId: orgId },
        });

        const [registrations, attendees] = await Promise.all([
            prisma.registration.findMany({
                where: {
                    organizationId: orgId,
                    paymentStatus: 'PAY_SUCCESS',
                    deletedAt: null
                },
                select: {
                    id: true,
                    vendorId: true,
                    isGroup: true,
                    activities: true
                }
            }),
            prisma.attendee.findMany({
                where: {
                    registration: {
                        organizationId: orgId,
                        paymentStatus: 'PAY_SUCCESS',
                        deletedAt: null
                    }
                },
                select: {
                    id: true,
                    vendorId: true,
                    registration: { select: { vendorId: true } },
                    activities: true
                }
            })
        ]);

        const stats = vendors.map(vendor => {
            const vendorId = vendor.id;

            // Calculate correct 'Allocated' count:
            // 1. Individual registrations assigned to this vendor
            const individualCount = registrations.filter(r => !r.isGroup && r.vendorId === vendorId).length;
            // 2. Attendees who are directly OR inheritedly assigned to this vendor
            const attendeeCount = attendees.filter(a =>
                a.vendorId === vendorId ||
                ((!a.vendorId || a.vendorId === "") && a.registration.vendorId === vendorId)
            ).length;

            const vendorStats: any = {
                id: vendor.id,
                name: vendor.name,
                capacity: vendor.capacity,
                allocated: individualCount + attendeeCount,
                activities: {}
            };

            // Process activities for this vendor
            const processItem = (activities: any) => {
                if (!activities) return;

                // Robust parsing for JSON
                let acts = activities;
                if (typeof acts === 'string') {
                    try {
                        acts = JSON.parse(acts);
                    } catch (e) { return; }
                }

                if (typeof acts !== 'object') return;

                Object.keys(acts).forEach(actId => {
                    // Check if it's a vendor-relevant activity
                    const isRelevant = activityPrefixes.some(p => actId.startsWith(p));
                    if (!isRelevant) return;

                    // Filter by day if requested
                    if (day && !actId.includes(`_day${day}`)) return;

                    if (!vendorStats.activities[actId]) {
                        vendorStats.activities[actId] = 0;
                    }
                    vendorStats.activities[actId]++;
                });
            };

            // Count usage for registrations (Individuals only, as groups use attendee records)
            registrations.filter(r => !r.isGroup && r.vendorId === vendorId)
                .forEach(r => processItem(r.activities));

            // Count usage for attendees 
            attendees.filter(a =>
                a.vendorId === vendorId ||
                ((!a.vendorId || a.vendorId === "") && a.registration.vendorId === vendorId)
            ).forEach(a => processItem(a.activities));

            return vendorStats;
        });

        // Calculate global totals
        const globalStats: any = {
            totalAllocated: stats.reduce((acc, s) => acc + s.allocated, 0),
            totalCapacity: stats.reduce((acc, s) => acc + s.capacity, 0),
            activities: {}
        };

        stats.forEach(s => {
            Object.entries(s.activities).forEach(([actId, count]: [string, any]) => {
                if (!globalStats.activities[actId]) {
                    globalStats.activities[actId] = 0;
                }
                globalStats.activities[actId] += count;
            });
        });

        return NextResponse.json({
            stats,
            globalStats,
            days: [1, 2, 3]
        });

    } catch (error) {
        console.error('Error fetching vendor stats:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
