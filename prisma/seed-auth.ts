import { PrismaClient } from '@prisma/client';
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

const prisma = new PrismaClient();

const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
    },
    secret: process.env.BETTER_AUTH_SECRET || 'placeholder_secret',
});

async function main() {
    const email = process.env.ADMIN_EMAIL || 'admin@gcmethiopia.org';
    const password = process.env.ADMIN_PASSWORD || '@&?||4932Zb6';
    const name = process.env.ADMIN_NAME || 'Admin';

    console.log('Seeding admin user...');

    // Get Super Admin role
    const superAdminRole = await prisma.role.findUnique({
        where: { name: 'Super Admin' }
    });

    if (!superAdminRole) {
        console.error('Super Admin role not found. Run seed.ts first.');
        process.exit(1);
    }

    // Delete existing user if exists
    const existingUser = await prisma.user.findUnique({
        where: { email }
    });

    if (existingUser) {
        console.log('Deleting existing admin user...');
        await prisma.account.deleteMany({ where: { userId: existingUser.id } });
        await prisma.session.deleteMany({ where: { userId: existingUser.id } });
        await prisma.user.delete({ where: { id: existingUser.id } });
    }

    console.log('Creating admin user via Better Auth...');
    try {
        await auth.api.signUpEmail({
            body: {
                email,
                password,
                name,
            }
        });

        // Update role
        await prisma.user.update({
            where: { email },
            data: {
                roleId: superAdminRole.id,
                emailVerified: true,
            }
        });

        console.log('Admin user created successfully!');
        console.log(`Email: ${email}`);
    } catch (err) {
        console.error('Error creating admin via Better Auth:', err);
    }
}

main()
    .catch((e) => {
        console.error('Error seeding admin:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

