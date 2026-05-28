import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireOrgEmailAccess } from '@/lib/org-emails-server';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
    try {
        const access = await requireOrgEmailAccess();
        if (!access.ok) {
            return NextResponse.json({ error: access.message }, { status: access.status });
        }

        const { id } = await params;
        const existing = await prisma.organizationEmailTemplate.findFirst({
            where: { id, organizationId: access.session.organizationId },
        });
        if (!existing) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        await prisma.organizationEmailTemplate.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('DELETE org email template', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
