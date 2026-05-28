import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildDynamicSchema } from '@/lib/forms/build-zod-schema';
import { resolveEffectiveRegistrationFields } from '@/lib/forms/effective-registration-fields';
import { randomBytes } from 'crypto';

/**
 * Public dynamic registration: orgSlug + eventSlug identify tenant + event;
 * validates responses against the event's registration form.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const orgSlug = String(body.orgSlug || '').trim();
        const eventSlug = String(body.eventSlug || '').trim();
        const responsesRaw = body.responses;
        if (!orgSlug || !eventSlug || !responsesRaw || typeof responsesRaw !== 'object') {
            return NextResponse.json(
                { error: 'orgSlug, eventSlug, and responses object required' },
                { status: 400 }
            );
        }

        const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
        if (!org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const event = await prisma.event.findUnique({
            where: {
                organizationId_slug: {
                    organizationId: org.id,
                    slug: eventSlug,
                },
            },
            include: {
                registrationForm: {
                    include: { fields: { orderBy: { order: 'asc' } } },
                },
            },
        });

        if (!event?.registrationForm) {
            return NextResponse.json({ error: 'Event or registration form not configured' }, { status: 400 });
        }

        const form = event.registrationForm;
        if (!form.isActive) {
            return NextResponse.json({ error: 'Registration is closed' }, { status: 400 });
        }

        let validatedResponses = responsesRaw;
        
        if (!body.isGroup) {
            const fields = await resolveEffectiveRegistrationFields(org.id, org.settings, form);
            const schema = buildDynamicSchema(fields);
            const parsed = schema.safeParse(responsesRaw);
            if (!parsed.success) {
                return NextResponse.json({ error: 'Validation failed', issues: parsed.error.flatten() }, { status: 400 });
            }
            validatedResponses = parsed.data;
        }

        const primary = await prisma.formResponse.create({
            data: {
                formId: form.id,
                organizationId: org.id,
                eventId: event.id,
                responses: validatedResponses as object,
            },
        });

        const qrPayload = `er_${randomBytes(12).toString('hex')}`;

        const registration = await prisma.eventRegistration.create({
            data: {
                organizationId: org.id,
                eventId: event.id,
                primaryResponseId: primary.id,
                isGroup: Boolean(body.isGroup),
                paymentStatus: (body.amount === 0 || body.amount === '0') ? 'PAY_SUCCESS' : 'pending',
                paymentType: body.paymentType || 'TELEBIRR',
                transactionReference: body.transactionReference,
                amount: body.amount != null ? String(body.amount) : null,
                receiptPath: body.receiptPath,
                couponCode: body.couponCode,
                qrPayload,
            },
        });

        return NextResponse.json({
            id: registration.id,
            formResponseId: primary.id,
            qrPayload,
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
