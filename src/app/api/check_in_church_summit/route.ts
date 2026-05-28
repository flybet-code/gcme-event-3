import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getDefaultOrganizationId } from '@/lib/tenancy/active-org-server';

/**
 * POST /api/check_in_church_summit
 * Check in an attendee by their QR ID for a specific activity
 */
export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown_ip';

        // --- Rate Limiting Removed ---
        // -----------------------------

        // Public access - no authentication required for check-in

        const body = await request.json();
        const { qrId, activity = 'check_in' } = body;

        console.log(`[Check-In] IP: ${ip}, qrId: "${qrId}", activity: "${activity}"`);

        if (!qrId) {
            return NextResponse.json(
                { error: 'QR ID is required' },
                { status: 400 }
            );
        }

        // Parse ID (e.g., "12" or "AID-456" or "12-ATT-0")
        const qrString = String(qrId).trim();
        let regId: number = -1;
        let attendeeIndex: number = -1;
        let directAttendeeId: number = -1;

        if (qrString.startsWith('AID-')) {
            directAttendeeId = parseInt(qrString.replace('AID-', ''));
        } else if (qrString.startsWith('CLS-')) {
            // New Format: CLS-{RegID}-{AttID} OR Legacy Format: CLS-{RegID}-{Index}
            const match = qrString.match(/^CLS-(.+)-(\d+)$/);
            if (match) {
                const rID = parseInt(match[1]);
                const lastID = parseInt(match[2]);

                // First, try treating lastID as a direct Attendee Primary Key
                const attendee = await prisma.attendee.findFirst({
                    where: { id: lastID, registrationId: rID }
                });

                if (attendee) {
                    directAttendeeId = attendee.id;
                    console.log(`[Check-In] Found attendee by direct ID ${lastID} in Reg ${rID}`);
                } else {
                    // Fallback: treat as 1-based index (Legacy)
                    regId = rID;
                    attendeeIndex = lastID - 1;
                    console.log(`[Check-In] Falling back to index ${attendeeIndex} for Reg ${regId}`);
                }
            } else {
                // Individual: CLS-{ID}
                regId = parseInt(qrString.replace('CLS-', ''));
            }
        } else {
            const parts = qrString.split('-ATT-');
            regId = parseInt(parts[0]);
            attendeeIndex = parts.length > 1 ? parseInt(parts[1]) : -1;
        }

        console.log(`[Check-In] Parsed: qrId="${qrString}", direct=${directAttendeeId}, regId=${regId}, attendeeIndex=${attendeeIndex}`);

        if (directAttendeeId === -1 && isNaN(regId)) {
            return NextResponse.json({ error: 'Invalid QR ID format' }, { status: 400 });
        }

        // Find registration or attendee directly
        let registration: any = null;
        let targetedAttendee: any = null;

        if (directAttendeeId !== -1) {
            targetedAttendee = await prisma.attendee.findUnique({
                where: { id: directAttendeeId },
                include: {
                    registration: {
                        include: {
                            vendor: true
                        }
                    },
                    vendor: true
                }
            });

            if (targetedAttendee) {
                registration = targetedAttendee.registration;
            }
        } else {
            registration = await prisma.registration.findUnique({
                where: { id: regId },
                include: {
                    attendees: {
                        orderBy: { id: 'asc' },
                        include: { vendor: true }
                    },
                    vendor: true
                }
            });
        }

        if (!registration || registration.deletedAt) {
            return NextResponse.json(
                { error: 'Registration not found' },
                { status: 404 }
            );
        }

        const tenantOrgId = await getDefaultOrganizationId();
        if (
            tenantOrgId &&
            registration.organizationId &&
            registration.organizationId !== tenantOrgId
        ) {
            return NextResponse.json(
                { error: 'Registration not found' },
                { status: 404 }
            );
        }

        const now = new Date();
        let updatedName = registration.fullName;
        let updatedTitle = registration.title;
        let updatedRole = registration.serviceRole;
        let wasAlreadyCheckedIn = false;
        let checkedInAtTimestamp = now.toISOString();
        let finalActivities: any = {};

        let vendorName = registration.vendor?.name || 'No Vendor';

        // Update logic based on type (Individual vs Group Attendee)
        if (directAttendeeId !== -1 || attendeeIndex >= 0) {
            // It is a group attendee
            let attendee = targetedAttendee;
            if (!attendee) {
                const sortedAttendees = registration.attendees.sort((a: { id: number }, b: { id: number }) => a.id - b.id);
                attendee = sortedAttendees[attendeeIndex];
            }

            vendorName = attendee?.vendor?.name || registration.vendor?.name || 'No Vendor';

            if (!attendee) {
                return NextResponse.json(
                    { error: 'Attendee not found in group' },
                    { status: 404 }
                );
            }

            const currentActivities = (attendee.activities as any) || {};
            finalActivities = currentActivities;

            // Check if already checked in for this activity
            if (currentActivities[activity]) {
                wasAlreadyCheckedIn = true;
                checkedInAtTimestamp = currentActivities[activity];

                // Idempotency Check: If checked in within the last 60 seconds, treat as success (debounce)
                const checkedInTime = new Date(checkedInAtTimestamp).getTime();
                const nowTime = now.getTime();
                if (nowTime - checkedInTime < 60000) {
                    return NextResponse.json({
                        message: 'Check-in successful (Idempotent)',
                        status: 'success',
                        data: {
                            title: attendee.title || '',
                            fullName: attendee.fullName || 'Group Member',
                            role: attendee.role || 'Attendee',
                            churchName: registration.churchName,
                            checkedInAt: checkedInAtTimestamp,
                            isGroupMember: true,
                            activity: activity,
                            allActivities: finalActivities,
                            vendorName: vendorName,
                            regId: registration.id,
                            attendeeIndex: attendeeIndex >= 0 ? attendeeIndex : undefined,
                            directAttendeeId: attendee.id
                        }
                    }, { status: 200 });
                }
            }

            if (wasAlreadyCheckedIn) {
                return NextResponse.json({
                    message: `Already tracked for ${activity}`,
                    status: 'already_checked_in',
                    data: {
                        title: attendee.title || '',
                        fullName: attendee.fullName || 'Group Member',
                        role: attendee.role || 'Attendee',
                        churchName: registration.churchName,
                        checkedInAt: checkedInAtTimestamp,
                        isGroupMember: true,
                        activity: activity,
                        allActivities: finalActivities,
                        vendorName: vendorName,
                        regId: Number(regId),
                        attendeeIndex: Number(attendeeIndex)
                    }
                }, { status: 200 });
            }

            // Perform update
            const updatedActivities = { ...currentActivities, [activity]: now.toISOString() };
            finalActivities = updatedActivities;

            const updateData: any = {
                activities: updatedActivities
            };
            if (activity.startsWith('check_in')) {
                updateData.checkedIn = true;
                updateData.checkedInAt = now;
            }

            await prisma.attendee.update({
                where: { id: attendee.id },
                data: updateData
            });

            updatedName = attendee.fullName;
            updatedTitle = attendee.title;
            updatedRole = attendee.role;

        } else {
            // Individual registration
            const currentActivities = (registration.activities as any) || {};
            finalActivities = currentActivities;

            // Check if already checked in for this activity
            if (currentActivities[activity]) {
                wasAlreadyCheckedIn = true;
                checkedInAtTimestamp = currentActivities[activity];

                // Idempotency Check: If checked in within the last 60 seconds, treat as success (debounce)
                const checkedInTime = new Date(checkedInAtTimestamp).getTime();
                const nowTime = now.getTime();
                if (nowTime - checkedInTime < 60000) {
                    return NextResponse.json({
                        message: 'Check-in successful (Idempotent)',
                        status: 'success',
                        data: {
                            title: registration.title || '',
                            fullName: registration.fullName || 'Attendee',
                            role: registration.serviceRole || 'Attendee',
                            churchName: registration.churchName,
                            checkedInAt: checkedInAtTimestamp,
                            isGroupMember: false,
                            activity: activity,
                            allActivities: finalActivities,
                            vendorName: vendorName,
                            regId: Number(regId)
                        }
                    }, { status: 200 });
                }
            }

            if (wasAlreadyCheckedIn) {
                return NextResponse.json({
                    message: `Already tracked for ${activity}`,
                    status: 'already_checked_in',
                    data: {
                        title: registration.title || '',
                        fullName: registration.fullName || 'Attendee',
                        role: registration.serviceRole || 'Attendee',
                        churchName: registration.churchName,
                        checkedInAt: checkedInAtTimestamp,
                        isGroupMember: false,
                        activity: activity,
                        allActivities: finalActivities,
                        vendorName: vendorName,
                        regId: Number(regId)
                    }
                }, { status: 200 });
            }

            const updatedActivities = { ...currentActivities, [activity]: now.toISOString() };
            finalActivities = updatedActivities;

            const updateData: any = {
                activities: updatedActivities
            };

            if (activity.startsWith('check_in')) {
                updateData.checkedIn = true;
                updateData.checkedInAt = now;
            }

            await prisma.registration.update({
                where: { id: registration.id },
                data: updateData
            });
        }

        return NextResponse.json({
            message: 'Check-in successful',
            status: 'success',
            data: {
                title: updatedTitle,
                fullName: updatedName,
                role: updatedRole,
                churchName: registration.churchName,
                checkedInAt: now.toISOString(),
                isGroupMember: attendeeIndex >= 0,
                activity: activity,
                allActivities: finalActivities,
                vendorName: vendorName,
                regId: registration.id,
                attendeeIndex: attendeeIndex >= 0 ? attendeeIndex : undefined,
                directAttendeeId: directAttendeeId !== -1 ? directAttendeeId : (attendeeIndex >= 0 ? (targetedAttendee?.id || registration.attendees[attendeeIndex]?.id) : undefined)
            }
        }, { status: 200 });

    } catch (error) {
        console.error('Error processing check-in:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
