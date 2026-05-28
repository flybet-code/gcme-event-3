import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { sendConfirmationEmail } from '@/lib/emailService';
import { assignTicketNumbers } from '@/lib/tickets';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/update_payment/[paymentId]
 * Update payment status based on payment gateway callback or admin action
 */
export async function POST(
    request: NextRequest,
    props: { params: Promise<{ paymentId: string }> }
) {
    try {
        const params = await props.params;
        const { paymentId } = params;
        const id = parseInt(paymentId);

        if (isNaN(id)) {
            return NextResponse.json({ error: 'Invalid Payment ID' }, { status: 400 });
        }

        // Try to parse body as JSON, fallback to text if needed
        let body: any = {};
        try {
            body = await request.json();
        } catch (e) {
            console.log('Failed to parse JSON body, checking query params or text');
        }

        // Also check query params in case POST has them
        const searchParams = request.nextUrl.searchParams;
        const trade_status = body.trade_status || searchParams.get('trade_status');
        const total_amount = body.total_amount || searchParams.get('total_amount');

        console.log('Payment update request received:', { paymentId, trade_status, total_amount });

        // --- SECURITY: Distinguish between Gateway Callback and Admin Action ---
        // const callbackSecret = process.env.PAYMENT_CALLBACK_SECRET;
        // const providedSecret = request.headers.get('X-Callback-Secret') || searchParams.get('secret');

        // // Check for session (Admin Action)
        // const session = await auth.api.getSession({
        //     headers: request.headers
        // });

        // // Authorized if: 
        // // 1. It's a gateway callback with valid secret
        // // 2. It's an authenticated admin session
        // const isGatewayCallback = callbackSecret && providedSecret === callbackSecret;
        // const isAdminAction = !!session;

        // if (!isGatewayCallback && !isAdminAction) {
        //     console.error(`Unauthorized payment update attempt for ID ${paymentId}: No valid secret or session`);
        //     return NextResponse.json({ error: 'Unauthorized: Access denied' }, { status: 401 });
        // }
        // ----------------------------------------------------------------------

        // Check for the critical status (Case-Insensitive)
        const normalizedStatus = (trade_status || '').toString().toUpperCase();
        if (normalizedStatus !== 'COMPLETED' && normalizedStatus !== 'PAY_SUCCESS') {
            console.log(`Update skipped: Status is not PAY_SUCCESS (Current: ${trade_status})`);
            return NextResponse.json({
                message: 'Ignored: Payment not successful'
            }, { status: 200 });
        }

        // Verify registration exists and amount matches (if gateway provides total_amount)
        const existingRegistration = await prisma.registration.findUnique({
            where: { id }
        });

        if (!existingRegistration) {
            return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
        }

        const attendeeId = body.attendeeId || searchParams.get('attendeeId');

        if (attendeeId) {
            const attId = parseInt(attendeeId);
            const attendee = await prisma.attendee.findUnique({
                where: { id: attId },
                include: { registration: true }
            });

            if (!attendee) {
                return NextResponse.json({ error: 'Attendee not found' }, { status: 404 });
            }

            // Extract to new registration to approve them individually
            const newReg = await prisma.registration.create({
                data: {
                    title: attendee.title,
                    fullName: attendee.fullName,
                    churchName: attendee.registration.churchName,
                    serviceRole: attendee.role,
                    phoneNumber: attendee.phoneNumber || attendee.registration.phoneNumber,
                    email: attendee.registration.email,
                    amount: attendee.amount,
                    paymentStatus: 'PAY_SUCCESS',
                    organizationId: attendee.registration.organizationId,
                    eventId: attendee.registration.eventId,
                    vendorId: attendee.vendorId || attendee.registration.vendorId,
                    groupId: attendee.groupId || attendee.registration.groupId,
                    isGroup: false,
                    paymentType: 'MANUAL_APPROVAL'
                }
            });

            await prisma.attendee.delete({ where: { id: attendee.id } });
            
            await assignTicketNumbers(newReg.id);

            return NextResponse.json({ message: 'Individual member approved successfully' }, { status: 200 });
        }
        // If amount is provided, verify it matches
        // if (total_amount) {
        //     const paidAmount = parseFloat(total_amount.toString());
        //     const expectedAmount = parseFloat(existingRegistration.amount);
        //     if (Math.abs(paidAmount - expectedAmount) > 0.01) {
        //         console.error(`Amount mismatch for registration ${id}: Expected ${expectedAmount}, Got ${paidAmount}`);
        //         return NextResponse.json({ error: 'Security Alert: Amount mismatch' }, { status: 400 });
        //     }
        // }

        // Update payment status in database using Prisma
        const registration = await prisma.registration.update({
            where: { id },
            data: {
                paymentStatus: 'PAY_SUCCESS'
            },
            include: {
                attendees: true
            }
        });

        // Assign ticket numbers
        await assignTicketNumbers(id);

        // Re-fetch registration with ticket numbers assigned for the email
        const finalRegistration = await prisma.registration.findUnique({
            where: { id },
            include: { attendees: true }
        });

        // Send confirmation email if email exists
        if (finalRegistration && finalRegistration.email) {
            console.log(`Sending confirmation email to: ${finalRegistration.email}`);

            // Send confirmation email with QR code in background (don't wait)
            sendConfirmationEmail(finalRegistration as any, finalRegistration.email)
                .then((success) => {
                    if (success) {
                        console.log(`Confirmation email sent successfully to ${finalRegistration.email}`);
                    } else {
                        console.error(`Failed to send confirmation email to ${finalRegistration.email}`);
                    }
                })
                .catch((error) => {
                    console.error('Error sending confirmation email:', error);
                });
        } else {
            console.log('No email address found for registration, skipping email confirmation');
        }

        return NextResponse.json({
            message: 'Payment status updated successfully'
        }, { status: 200 });

    } catch (error) {
        console.error('Error updating payment status:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
