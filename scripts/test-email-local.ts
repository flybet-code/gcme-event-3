import { verifyEmailConfig, sendInvitationEmail } from '../src/lib/emailService';
// Environment variables must be loaded before running this script
// e.g. set -a && source .env && set +a && npx tsx scripts/test-email-local.ts

async function main() {
    console.log('Testing Email Configuration...');
    console.log(`SMTP Host: ${process.env.SMTP_HOST}`);
    console.log(`SMTP User: ${process.env.SMTP_USER}`);

    const isReady = await verifyEmailConfig();
    if (isReady) {
        console.log('✅ SMTP Connection Successful');
        console.log('Sending test invitation to admin@gcmethiopia.org...');

        const result = await sendInvitationEmail(
            'admin@gcmethiopia.org',
            'Test Role',
            'http://localhost:3001/test-invite'
        );

        if (result) {
            console.log('✅ Test Email Sent Successfully');
        } else {
            console.error('❌ Failed to send test email');
        }
    } else {
        console.error('❌ SMTP Connection Failed');
    }
}

main().catch(console.error);
