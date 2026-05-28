import { prisma } from '@/lib/prisma';
import { assignTicketNumbers } from '@/lib/tickets';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { registrationId } = await request.json();
        const id = parseInt(registrationId);

        if (isNaN(id)) {
            return NextResponse.json({ error: 'Invalid Registration ID' }, { status: 400 });
        }

        const token = process.env.TELEBIRR_GATEWAY_TOKEN || process.env.PAYMENT_GATEWAY_TOKEN_SUMMIT;
        const retrieveUrl = process.env.TELEBIRR_RETRIEVE_URL;
        const statusUrl = process.env.TELEBIRR_STATUS_URL;

        if (!token || !retrieveUrl || !statusUrl) {
            console.error('Telebirr configuration missing in environment variables');
            return NextResponse.json({ error: 'Gateway configuration error' }, { status: 500 });
        }

        // 1. Get transactions from the gateway
        const listRes = await fetch(`${retrieveUrl}?page=1&limit=5000`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: ''
        });

        if (!listRes.ok) {
            const errorText = await listRes.text();
            console.error('Failed to fetch transactions:', errorText);
            return NextResponse.json({ error: 'Failed to fetch transactions from gateway' }, { status: 502 });
        }

        const listData = await listRes.json();
        const transactions = listData.data || [];

        // Find the transaction matching our registration ID in notify_url
        const foundTransaction = transactions.find((t: any) =>
            t.notify_url && (t.notify_url.includes(`/api/update_payment/${id}`) || t.notify_url.endsWith(`/${id}`))
        );

        if (!foundTransaction) {
            return NextResponse.json({
                error: 'No matching transaction found on the gateway for this registration ID.',
                registrationId: id
            }, { status: 404 });
        }

        const merch_order_id = foundTransaction.merch_order_id;

        // 2. Check specific transaction status
        const statusRes = await fetch(statusUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ merch_order_id })
        });

        if (!statusRes.ok) {
            const errorText = await statusRes.text();
            console.error('Failed to check status:', errorText);
            return NextResponse.json({ error: 'Failed to verify status with gateway' }, { status: 502 });
        }

        const statusData = await statusRes.json();
        const tradeStatus = (statusData.order_status || (statusData.data && statusData.data.order_status) || '').toString().toUpperCase();

        console.log(`Checked status for reg ${id}, transaction ${merch_order_id}: ${tradeStatus}`);

        if (tradeStatus === 'PAY_SUCCESS' || tradeStatus === 'COMPLETED') {
            // Update database if it's successful
            await prisma.registration.update({
                where: { id },
                data: { paymentStatus: "PAY_SUCCESS" }
            });

            // Assign ticket numbers
            await assignTicketNumbers(id);

            return NextResponse.json({
                success: true,
                status: 'PAY_SUCCESS',
                message: 'Payment verified and updated successfully.'
            });
        }

        return NextResponse.json({
            success: false,
            status: 'PENDING',
            message: `Current status: ${tradeStatus || 'PENDING'}`
        });

    } catch (error) {
        console.error('Error in check_status route:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
