import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { backfillTicketNumbers } from '@/lib/tickets';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers
        });

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await backfillTicketNumbers();

        return NextResponse.json({ success: true, message: 'Ticket numbers backfilled successfully' });
    } catch (error) {
        console.error('Backfill error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
