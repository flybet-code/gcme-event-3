/**
 * One-time backfill: legacy Registration + Attendee -> FormResponse + EventRegistration + EventAttendee
 * Run: npx tsx scripts/backfill-event-registrations.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const orgSlug = process.env.DEFAULT_ORG_SLUG || 'gcme';
    const eventSlug = process.env.DEFAULT_EVENT_SLUG || 'church-leadership-summit';

    const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) throw new Error(`Organization not found: ${orgSlug}`);
    const event = await prisma.event.findUnique({
        where: { organizationId_slug: { organizationId: org.id, slug: eventSlug } },
        include: { registrationForm: { include: { fields: true } } },
    });
    if (!event?.registrationFormId) throw new Error('Event or registration form missing');

    const formId = event.registrationFormId;

    const existing = await prisma.eventRegistration.findFirst({
        where: {
            organizationId: org.id,
            eventId: event.id,
        },
    });
    if (existing) {
        console.log('EventRegistration rows already exist; skipping backfill.');
        return;
    }

    const registrations = await prisma.registration.findMany({
        include: { attendees: true },
        orderBy: { id: 'asc' },
    });

    console.log(`Backfilling ${registrations.length} legacy registrations...`);

    for (const r of registrations) {
        const responses: Record<string, unknown> = {
            title: r.title ?? '',
            full_name: r.fullName,
            church_name: r.churchName,
            service_role: r.serviceRole,
            phone_number: r.phoneNumber,
            email: r.email ?? '',
        };

        const primary = await prisma.formResponse.create({
            data: {
                formId,
                organizationId: org.id,
                eventId: event.id,
                responses,
            },
        });

        const er = await prisma.eventRegistration.create({
            data: {
                organizationId: org.id,
                eventId: event.id,
                primaryResponseId: primary.id,
                isGroup: r.isGroup,
                paymentStatus: r.paymentStatus,
                paymentType: r.paymentType,
                transactionReference: r.transactionReference,
                amount: r.amount,
                receiptPath: r.receiptPath,
                couponCode: r.couponCode,
                discountApplied: r.discountApplied,
                deletedAt: r.deletedAt,
                ticketNumber: r.ticketNumber,
                vendorId: r.vendorId,
                groupId: r.groupId,
                checkedIn: r.checkedIn,
                checkedInAt: r.checkedInAt,
                isBadgePrinted: r.isBadgePrinted,
                badgePrintedAt: r.badgePrintedAt,
                activities: {
                    ...(typeof r.activities === 'object' && r.activities !== null ? r.activities as object : {}),
                    legacyRegistrationId: r.id,
                },
            },
        });

        for (const a of r.attendees) {
            const attResponses: Record<string, unknown> = {
                title: a.title ?? '',
                full_name: a.fullName,
                role: a.role,
                amount: a.amount,
                phone_number: a.phoneNumber ?? '',
            };
            const fr = await prisma.formResponse.create({
                data: {
                    formId,
                    organizationId: org.id,
                    eventId: event.id,
                    responses: attResponses,
                },
            });
            await prisma.eventAttendee.create({
                data: {
                    eventRegistrationId: er.id,
                    formResponseId: fr.id,
                    ticketNumber: a.ticketNumber,
                    checkedIn: a.checkedIn,
                    checkedInAt: a.checkedInAt,
                    isBadgePrinted: a.isBadgePrinted,
                    badgePrintedAt: a.badgePrintedAt,
                    vendorId: a.vendorId,
                    groupId: a.groupId,
                },
            });
        }

        console.log(`Migrated registration ${r.id} -> ${er.id}`);
    }

    console.log('Backfill done.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
