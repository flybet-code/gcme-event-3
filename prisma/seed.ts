import { PrismaClient, OrgRole, FormFieldType } from '@prisma/client';
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { ALL_ORG_PERMISSIONS } from '../src/lib/org-permissions';

const prisma = new PrismaClient();

const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    emailAndPassword: {
        enabled: true,
    },
    secret: process.env.BETTER_AUTH_SECRET || 'super_long_secret_for_better_auth_placeholder_12345',
});

async function main() {
    const email = process.env.ADMIN_EMAIL || 'admin@gcmethiopia.org';
    const password = process.env.ADMIN_PASSWORD || '@&?||4932Zb6';
    const name = process.env.ADMIN_NAME || 'Super Admin';

    console.log('Seeding permissions and roles...');

    const perms = [
        { name: 'manage_users', description: 'Can invite and manage team members (User Management)' },
        { name: 'manage_roles', description: 'Can create and assign roles' },
        { name: 'view_registrations', description: 'Can view participant list (All Registration, Badges)' },
        { name: 'manage_payments', description: 'Can approve manual payments' },
        { name: 'register_participants', description: 'Can use the internal registration form (New Registration)' },
        { name: 'check_in_participants', description: 'Can check in attendees (Check-In)' },
        { name: 'view_financials', description: 'Can view revenue and financial reports (Overview)' },
        { name: 'delete_registrations', description: 'Can delete registrations' },
        { name: 'edit_registrations', description: 'Can edit registration details' },
        { name: 'manage_batches', description: 'Can manage ticket number batches and prefixes (Batch and Prefix)' },
        { name: 'manage_groups', description: 'Can manage participant groups (Groups)' },
        { name: 'manage_vendors', description: 'Can manage vendors and catering (Vendors)' },
    ];

    for (const p of perms) {
        await prisma.permission.upsert({
            where: { name: p.name },
            update: { description: p.description },
            create: p,
        });
    }

    const allPermissions = await prisma.permission.findMany();

    const superAdminRole = await prisma.role.upsert({
        where: { name: 'Super Admin' },
        update: {
            permissions: {
                set: [],
                connect: allPermissions.map(p => ({ id: p.id }))
            }
        },
        create: {
            name: 'Super Admin',
            description: 'Full access to all system features',
            permissions: {
                connect: allPermissions.map(p => ({ id: p.id }))
            }
        }
    });

    await prisma.role.upsert({
        where: { name: 'Admin' },
        update: {
            permissions: {
                set: [],
                connect: allPermissions.map(p => ({ id: p.id }))
            }
        },
        create: {
            name: 'Admin',
            description: 'General administration access',
            permissions: {
                connect: allPermissions.map(p => ({ id: p.id }))
            }
        }
    });

    let adminUser = await prisma.user.findUnique({ where: { email } });

    if (!adminUser) {
        console.log('Creating admin user via Better Auth...');
        await auth.api.signUpEmail({
            body: { email, password, name },
        });
        adminUser = await prisma.user.findUnique({ where: { email } });
        if (!adminUser) throw new Error('Admin user not found after signup');
    }

    await prisma.user.update({
        where: { email },
        data: {
            roleId: superAdminRole.id,
            emailVerified: true,
            isPlatformSuperAdmin: true,
        },
    });

    adminUser = await prisma.user.findUniqueOrThrow({ where: { email } });

    const defaultSlug = process.env.DEFAULT_ORG_SLUG || 'gcme';
    const orgName = process.env.DEFAULT_ORG_NAME || 'GCME Default Organization';

    console.log('Upserting default organization...');
    const organization = await prisma.organization.upsert({
        where: { slug: defaultSlug },
        update: {
            ownerId: adminUser.id,
            name: orgName,
        },
        create: {
            name: orgName,
            slug: defaultSlug,
            ownerId: adminUser.id,
            settings: { migratedFrom: 'legacy-single-tenant' },
        },
    });

    await prisma.organizationMember.upsert({
        where: {
            organizationId_userId: {
                organizationId: organization.id,
                userId: adminUser.id,
            },
        },
        update: {
            role: OrgRole.OWNER,
            permissions: ALL_ORG_PERMISSIONS,
        },
        create: {
            organizationId: organization.id,
            userId: adminUser.id,
            role: OrgRole.OWNER,
            permissions: ALL_ORG_PERMISSIONS,
        },
    });

    await prisma.userActiveOrganization.upsert({
        where: { userId: adminUser.id },
        update: { organizationId: organization.id },
        create: {
            userId: adminUser.id,
            organizationId: organization.id,
        },
    });

    console.log('Scoping vendors, groups, batches to default organization...');
    await prisma.vendor.updateMany({
        where: { organizationId: null },
        data: { organizationId: organization.id },
    });

    await prisma.group.updateMany({
        where: { organizationId: null },
        data: { organizationId: organization.id },
    });

    await prisma.batch.updateMany({
        where: { organizationId: null },
        data: { organizationId: organization.id },
    });

    console.log('Backfilling Registration.organizationId from vendor/group/default org...');
    await prisma.$executeRaw`
        UPDATE "Registration" r
        SET "organizationId" = COALESCE(
            (SELECT v."organizationId" FROM "Vendor" v WHERE v.id = r."vendorId"),
            (SELECT g."organizationId" FROM "Group" g WHERE g.id = r."groupId"),
            ${organization.id}::text
        )
        WHERE r."organizationId" IS NULL
    `;

    console.log('Upserting default batches (per org)...');
    const defaultBatches = [
        { name: 'Students', prefix: 10000, roles: ['Student'] },
        { name: 'Leaders', prefix: 20000, roles: ['Church Leader', 'Church Leader/Minister'] },
        { name: 'Professionals', prefix: 30000, roles: ['Professional'] },
        { name: 'Internal/Staff', prefix: 40000, roles: ['Staff', 'Ministry Partners', 'Associates', 'Women leaders', 'Youths leaders', 'Event Coordinators', 'Media', 'Speakers'] },
    ];

    for (const b of defaultBatches) {
        await prisma.batch.upsert({
            where: {
                organizationId_name: {
                    organizationId: organization.id,
                    name: b.name,
                },
            },
            update: {
                prefix: b.prefix,
                roles: b.roles,
            },
            create: {
                organizationId: organization.id,
                name: b.name,
                prefix: b.prefix,
                roles: b.roles,
                paymentStatuses: [],
                coupons: [],
                registrationIds: [],
                eventRegistrationIds: [],
            },
        });
    }

    console.log('Upserting default vendors...');
    const defaultVendors = [
        { name: 'Vendor A', capacity: 100 },
        { name: 'Vendor B', capacity: 100 },
        { name: 'Vendor C', capacity: 100 },
    ];

    for (const v of defaultVendors) {
        await prisma.vendor.upsert({
            where: {
                organizationId_name: {
                    organizationId: organization.id,
                    name: v.name,
                },
            },
            update: { capacity: v.capacity },
            create: {
                organizationId: organization.id,
                name: v.name,
                capacity: v.capacity,
            },
        });
    }

    console.log('Creating default registration form and event...');
    const eventSlug = process.env.DEFAULT_EVENT_SLUG || 'church-leadership-summit';

    let registrationForm = await prisma.form.findFirst({
        where: { organizationId: organization.id, name: 'Summit registration (legacy fields)' },
    });
    if (!registrationForm) {
        registrationForm = await prisma.form.create({
            data: {
                organizationId: organization.id,
                name: 'Summit registration (legacy fields)',
                isActive: true,
                defaultLocale: 'en',
                supportedLocales: ['en', 'am', 'or', 'ti'],
                i18nMeta: { uiTemplate: 'summit_legacy' },
            },
        });
    }

    const fieldDefs: { fieldKey: string; label: string; type: FormFieldType; order: number; required: boolean }[] = [
        { fieldKey: 'title', label: 'Title', type: FormFieldType.TEXT, order: 0, required: false },
        { fieldKey: 'full_name', label: 'Full name', type: FormFieldType.TEXT, order: 1, required: true },
        { fieldKey: 'church_name', label: 'Church name', type: FormFieldType.TEXT, order: 2, required: true },
        { fieldKey: 'service_role', label: 'Service role', type: FormFieldType.TEXT, order: 3, required: true },
        { fieldKey: 'phone_number', label: 'Phone number', type: FormFieldType.PHONE, order: 4, required: true },
        { fieldKey: 'email', label: 'Email', type: FormFieldType.EMAIL, order: 5, required: false },
    ];

    for (const f of fieldDefs) {
        await prisma.formField.upsert({
            where: {
                formId_fieldKey: {
                    formId: registrationForm.id,
                    fieldKey: f.fieldKey,
                },
            },
            update: {
                label: f.label,
                type: f.type,
                order: f.order,
                required: f.required,
            },
            create: {
                formId: registrationForm.id,
                fieldKey: f.fieldKey,
                label: f.label,
                type: f.type,
                order: f.order,
                required: f.required,
            },
        });
    }

    const event = await prisma.event.upsert({
        where: {
            organizationId_slug: {
                organizationId: organization.id,
                slug: eventSlug,
            },
        },
        update: {
            registrationFormId: registrationForm.id,
        },
        create: {
            organizationId: organization.id,
            name: process.env.EVENT_NAME || 'Church Leadership Summit',
            slug: eventSlug,
            registrationFormId: registrationForm.id,
        },
    });

    await prisma.form.update({
        where: { id: registrationForm.id },
        data: {
            eventId: event.id,
            isActive: true,
            i18nMeta: { uiTemplate: 'summit_legacy' },
        },
    });

    const orgSettingsRow = await prisma.organization.findUnique({
        where: { id: organization.id },
        select: { settings: true },
    });
    const prevSettings =
        orgSettingsRow?.settings &&
        typeof orgSettingsRow.settings === 'object' &&
        !Array.isArray(orgSettingsRow.settings)
            ? (orgSettingsRow.settings as Record<string, unknown>)
            : {};
    await prisma.organization.update({
        where: { id: organization.id },
        data: {
            settings: {
                ...prevSettings,
                defaultRegistrationFormId: registrationForm.id,
            },
        },
    });

    console.log(`Default org: ${organization.slug} (${organization.id})`);
    console.log(`Default event: ${event.slug} (${event.id})`);
    console.log(`Registration form: ${registrationForm.id}`);

    console.log('Seed completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
