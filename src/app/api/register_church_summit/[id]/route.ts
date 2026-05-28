import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { assignMembersToGroups } from '@/lib/groups';
import { assignTicketNumbers } from '@/lib/tickets';
import {
    getDefaultOrganizationId,
    resolveActiveOrganization,
    canModifyRegistrationInOrg,
} from '@/lib/tenancy/active-org-server';
import { getResolvedBadgeTemplateSrcForOrg } from '@/lib/badge-template-server';
import { hasPlatformElevatedAccess } from '@/lib/platform-app-role';

export const dynamic = 'force-dynamic';

/** Parse admin-supplied amount; `undefined` = do not change, `null` = invalid */
function parseOptionalAmount(value: unknown): string | undefined | null {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const s = String(value).trim().replace(/,/g, '');
    if (s === '') return undefined;
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) return null;
    return String(n);
}

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const id = parseInt(params.id);

        if (isNaN(id)) {
            return NextResponse.json({ error: 'Valid ID is required' }, { status: 400 });
        }

        const registration = await prisma.registration.findUnique({
            where: { id },
            include: {
                attendees: {
                    orderBy: { id: 'asc' },
                    // @ts-ignore
                    include: { vendor: true, group: true }
                },
                vendor: true,
                group: true
            }
        });

        if (!registration || registration.deletedAt) {
            return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
        }

        const session = await auth.api.getSession({ headers: request.headers });
        if (session?.user?.id) {
            const user = await prisma.user.findUnique({
                where: { id: session.user.id },
                include: { role: true },
            });
            const elevated = hasPlatformElevatedAccess(user?.isPlatformSuperAdmin, user?.role?.name);
            const orgRes = await resolveActiveOrganization(session);
            if (!elevated) {
                if (!orgRes.ok) {
                    return NextResponse.json({ error: orgRes.message }, { status: orgRes.status });
                }
                if (registration.organizationId !== orgRes.organizationId) {
                    return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
                }
            }
        } else {
            const def = await getDefaultOrganizationId();
            if (def && registration.organizationId && registration.organizationId !== def) {
                return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
            }
        }

        const badgeTemplateSrc = await getResolvedBadgeTemplateSrcForOrg(registration.organizationId);

        return NextResponse.json({ data: registration, badgeTemplateSrc }, { status: 200 });
    } catch (error) {
        console.error('Error fetching registration:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        const id = parseInt(params.id);

        if (isNaN(id)) {
            return NextResponse.json({ error: 'Valid ID is required' }, { status: 400 });
        }

        // --- Security Check: Super Admin or Edit Permission ---
        const session = await auth.api.getSession({
            headers: request.headers
        });

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch user from DB to get role and permissions
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

        const canEdit =
            isFullAdmin ||
            (orgRes.ok &&
                (await canModifyRegistrationInOrg(session.user.id, orgRes.organizationId, 'edit')));

        if (!canEdit) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }
        // -----------------------------------------

        const reg = await prisma.registration.findUnique({ where: { id } });
        if (!reg) {
            return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
        }
        if (!isFullAdmin && reg.organizationId !== orgRes.organizationId) {
            return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
        }

        const body = await request.json();
        const { title, fullName, phoneNumber, email, serviceRole, churchName, isGroupMember, attendeeId, vendorId, groupId } = body;

        let amountUpdate: string | undefined;
        if ('amount' in body) {
            const parsed = parseOptionalAmount(body.amount);
            if (parsed === null) {
                return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
            }
            amountUpdate = parsed;
        }

        const registrationPaymentPatch: {
            receiptPath?: string | null;
            transactionReference?: string | null;
            paymentStatus?: string;
        } = {};
        if ('receiptPath' in body) {
            const raw = body.receiptPath;
            registrationPaymentPatch.receiptPath =
                raw === null || raw === '' ? null : String(raw).trim();
        }
        if ('transactionReference' in body) {
            const raw = body.transactionReference;
            registrationPaymentPatch.transactionReference =
                raw === null || raw === '' ? null : String(raw).trim();
        }
        if ('paymentStatus' in body) {
            const raw = String(body.paymentStatus ?? '').trim();
            if (raw !== 'pending' && raw !== 'PAY_SUCCESS') {
                return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 });
            }
            registrationPaymentPatch.paymentStatus = raw;
        }

        const prevPaymentStatus = reg.paymentStatus;
        const willMarkPaid = registrationPaymentPatch.paymentStatus === 'PAY_SUCCESS';

        if (isGroupMember && attendeeId) {
            // Update the attendee
            await prisma.attendee.update({
                where: { id: parseInt(attendeeId) },
                data: {
                    title,
                    fullName,
                    phoneNumber,
                    role: serviceRole,
                    // @ts-ignore
                    vendorId: vendorId || null,
                    // @ts-ignore
                    groupId: groupId || null,
                    ...(amountUpdate !== undefined ? { amount: amountUpdate } : {}),
                }
            });

            const regPatch: Record<string, unknown> = { ...registrationPaymentPatch };
            if (churchName) regPatch.churchName = churchName;
            if (Object.keys(regPatch).length > 0) {
                await prisma.registration.update({
                    where: { id },
                    data: regPatch,
                });
            }

            // Sync group assignments
            await assignMembersToGroups();

            if (willMarkPaid && prevPaymentStatus !== 'PAY_SUCCESS') {
                await assignTicketNumbers(id);
            }

            return NextResponse.json({
                message: 'Attendee updated successfully'
            }, { status: 200 });
        }

        // Update the registration
        const updatedRegistration = await prisma.registration.update({
            where: { id },
            data: {
                title,
                fullName,
                phoneNumber,
                email,
                serviceRole,
                churchName,
                // @ts-ignore
                vendorId: vendorId || null,
                // @ts-ignore
                groupId: groupId || null,
                ...(amountUpdate !== undefined ? { amount: amountUpdate } : {}),
                ...registrationPaymentPatch,
            }
        });

        // Sync group assignments
        await assignMembersToGroups();

        if (willMarkPaid && prevPaymentStatus !== 'PAY_SUCCESS') {
            await assignTicketNumbers(id);
            const refreshed = await prisma.registration.findUnique({
                where: { id },
                include: {
                    attendees: {
                        orderBy: { id: 'asc' },
                        include: { vendor: true, group: true },
                    },
                    vendor: true,
                    group: true,
                },
            });
            return NextResponse.json({
                message: 'Registration updated successfully',
                data: refreshed ?? updatedRegistration,
            }, { status: 200 });
        }

        return NextResponse.json({
            message: 'Registration updated successfully',
            data: updatedRegistration
        }, { status: 200 });

    } catch (error) {
        console.error('Error updating registration:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        // --- Security Check: Super Admin or Delete Permission ---
        const session = await auth.api.getSession({
            headers: request.headers
        });

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch user from DB to get role and permissions
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

        const canDelete =
            isFullAdmin ||
            (orgRes.ok &&
                (await canModifyRegistrationInOrg(session.user.id, orgRes.organizationId, 'delete')));

        if (!canDelete) {
            return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
        }
        // -----------------------------------------

        const params = await props.params;
        const id = parseInt(params.id);

        if (isNaN(id)) {
            return NextResponse.json({ error: 'Valid ID is required' }, { status: 400 });
        }

        const attendeeId = request.nextUrl.searchParams.get('attendeeId');
        if (attendeeId) {
            const attId = parseInt(attendeeId);
            const att = await prisma.attendee.findUnique({
                where: { id: attId },
                include: { registration: true },
            });
            if (!att || att.registrationId !== id || !att.registration) {
                return NextResponse.json({ error: 'Attendee not found' }, { status: 404 });
            }
            if (!isFullAdmin) {
                if (!orgRes.ok || att.registration.organizationId !== orgRes.organizationId) {
                    return NextResponse.json({ error: 'Attendee not found' }, { status: 404 });
                }
            }

            // Delete just the attendee
            await prisma.attendee.delete({
                where: { id: attId }
            });
            
            // Sync group assignments
            await assignMembersToGroups();
            
            return NextResponse.json({ message: 'Attendee deleted successfully' }, { status: 200 });
        }

        const reg = await prisma.registration.findUnique({ where: { id } });
        if (!reg) {
            return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
        }
        if (!isFullAdmin && (!orgRes.ok || reg.organizationId !== orgRes.organizationId)) {
            return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
        }

        // Perform soft delete
        await (prisma as any).registration.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                groupId: null,
                vendorId: null
            }
        });

        // Unassign attendees too
        await (prisma as any).attendee.updateMany({
            where: { registrationId: id },
            data: {
                groupId: null,
                vendorId: null
            }
        });

        // Sync group assignments
        await assignMembersToGroups();

        return NextResponse.json({ message: 'Registration deleted successfully' }, { status: 200 });
    } catch (error) {
        console.error('Error deleting registration:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
