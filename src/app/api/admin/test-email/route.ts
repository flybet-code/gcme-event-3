import { verifyEmailConfig, sendInvitationEmail } from '@/lib/emailService';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        });

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isReady = await verifyEmailConfig();

        const testEmail = request.nextUrl.searchParams.get('email');
        if (testEmail && isReady) {
            console.log('Sending test invite email to:', testEmail);
            const success = await sendInvitationEmail(testEmail, 'Test Role', 'http://localhost:3001/test-invite');
            return NextResponse.json({
                status: isReady ? 'ready' : 'failed',
                testEmailSent: success
            });
        }

        return NextResponse.json({
            status: isReady ? 'ready' : 'failed',
            message: 'To send a test email, add ?email=your@email.com to the URL'
        });
    } catch (error) {
        console.error('Email verify error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
