'use server'
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        // --- SECURITY: CSRF & Origin Check ---
        const origin = request.headers.get('origin');
        const referer = request.headers.get('referer');
        const allowedOrigins = [
            'https://event.dsethiopia.org',
            'http://localhost:3000',
            'http://localhost:3001'
        ];
        if (process.env.NEXT_PUBLIC_APP_URL) {
            allowedOrigins.push(process.env.NEXT_PUBLIC_APP_URL);
        }

        const isAllowedOrigin = origin && allowedOrigins.some(allowed => origin.startsWith(allowed));
        const isAllowedReferer = referer && allowedOrigins.some(allowed => referer.startsWith(allowed));

        if (origin && !isAllowedOrigin) {
            return NextResponse.json({ error: 'Forbidden: Invalid Request Origin' }, { status: 403 });
        }
        if (!origin && referer && !isAllowedReferer) {
            return NextResponse.json({ error: 'Forbidden: Invalid Request Referer' }, { status: 403 });
        }
        // -------------------------------------

        const body = await request.json();

        const gatewayUrl = process.env.PAYMENT_GATEWAY_URL;
        const gatewayToken = process.env.PAYMENT_GATEWAY_TOKEN_SUMMIT;

        if (!gatewayUrl) {
            console.error("PAYMENT_GATEWAY_URL is not defined");
            return NextResponse.json({ error: "Configuration error" }, { status: 500 });
        }

        console.log(`Initiating payment request to: ${gatewayUrl}`);
        console.log('Payment request body:', JSON.stringify(body, null, 2));

        // Forward the request to the payment gateway
        const response = await fetch(gatewayUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${gatewayToken}`
            },
            body: JSON.stringify(body)
        });

        const responseText = await response.text();

        if (!response.ok) {
            console.error("Payment gateway error status:", response.status);
            console.error("Payment gateway error details:", responseText);
            return NextResponse.json(
                { error: "Payment gateway error", details: responseText },
                { status: response.status }
            );
        }

        // Return the response from the payment gateway
        // The gateway returns a text URL or JSON depending on the case, but based on page.tsx it seems to return a text URL
        return new NextResponse(responseText, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain'
            }
        });

    } catch (error) {
        console.error("Error in payment proxy:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
