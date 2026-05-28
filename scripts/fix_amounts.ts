import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting amount fix script...');

    // Find all registrations where amount is "0" but they have a coupon or discount
    const registrations = await prisma.registration.findMany({
        where: {
            OR: [
                { amount: "0" },
                { couponCode: { not: "" } },
                { discountApplied: { not: "" } }
            ],
            deletedAt: null
        },
        include: {
            _count: {
                select: { attendees: true }
            }
        }
    });

    console.log(`Found ${registrations.length} potential registrations to check.`);

    let updatedCount = 0;
    const BASE_PRICE = 1500;

    for (const reg of registrations) {
        const attendeeCount = reg.isGroup ? reg._count.attendees : 1;
        const expectedValue = (attendeeCount * BASE_PRICE).toString();

        if (reg.amount !== expectedValue) {
            console.log(`Updating Registration ID ${reg.id}: "${reg.amount}" -> "${expectedValue}"`);
            await prisma.registration.update({
                where: { id: reg.id },
                data: { amount: expectedValue }
            });
            updatedCount++;
        }
    }

    console.log(`Finished. Updated ${updatedCount} registrations.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
