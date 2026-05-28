import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding permissions...');

    const perms = [
        { name: 'manage_users', description: 'Can invite and manage team members' },
        { name: 'manage_roles', description: 'Can create and assign roles' },
        { name: 'view_registrations', description: 'Can view participant list' },
        { name: 'manage_payments', description: 'Can approve manual payments' },
        { name: 'register_participants', description: 'Can use the internal registration form' },
        { name: 'check_in_participants', description: 'Can check in attendees' },
        { name: 'view_financials', description: 'Can view revenue and financial reports' },
    ];

    for (const p of perms) {
        console.log(`Upserting permission: ${p.name}`);
        await prisma.permission.upsert({
            where: { name: p.name },
            update: { description: p.description },
            create: p,
        });
    }

    // Also update Super Admin role to include new permissions
    const allPermissions = await prisma.permission.findMany();

    await prisma.role.update({
        where: { name: 'Super Admin' },
        data: {
            permissions: {
                set: [], // Reset
                connect: allPermissions.map(p => ({ id: p.id }))
            }
        }
    });

    console.log('Permissions seeded successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
