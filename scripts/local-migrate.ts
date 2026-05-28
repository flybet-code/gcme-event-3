import { PrismaClient, OrgRole, FormFieldType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const CSV_DIR = '/Users/dsethiopia/Downloads/Telegram Desktop/db_exports';

// CSV Parsing Helper
function parseCSV(content: string): Record<string, string>[] {
    const lines: string[] = [];
    let currentLine = '';
    let inQuotes = false;
    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === '\n' && !inQuotes) {
            lines.push(currentLine);
            currentLine = '';
            continue;
        } else if (char === '\r' && !inQuotes) {
            continue; // skip carriage return
        }
        currentLine += char;
    }
    if (currentLine) {
        lines.push(currentLine);
    }
    if (lines.length === 0) return [];
    
    const headers = splitCSVLine(lines[0]);
    const results: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = splitCSVLine(lines[i]);
        const obj: Record<string, string> = {};
        headers.forEach((header, idx) => {
            obj[header] = values[idx] ?? '';
        });
        results.push(obj);
    }
    return results;
}

function splitCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result.map(val => {
        let clean = val.trim();
        if (clean.startsWith('"') && clean.endsWith('"')) {
            clean = clean.substring(1, clean.length - 1);
        }
        return clean.replace(/""/g, '"');
    });
}

function parsePgArray(pgArrStr: string): string[] {
    if (!pgArrStr) return [];
    let str = pgArrStr.trim();
    if (str.startsWith('"') && str.endsWith('"')) {
        str = str.slice(1, -1);
    }
    if (!str.startsWith('{') || !str.endsWith('}')) {
        return [];
    }
    str = str.slice(1, -1).trim();
    if (!str) return [];
    
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(cleanPgArrayElement(current));
            current = '';
        } else {
            current += char;
        }
    }
    result.push(cleanPgArrayElement(current));
    return result;
}

function cleanPgArrayElement(val: string): string {
    let clean = val.trim();
    if (clean.startsWith('"') && clean.endsWith('"')) {
        clean = clean.substring(1, clean.length - 1);
    }
    return clean.replace(/\\"/g, '"').replace(/""/g, '"');
}

function parseBool(val: string): boolean {
    if (!val) return false;
    const clean = val.trim().toLowerCase();
    return clean === 't' || clean === 'true' || clean === '1';
}

function parseDate(val: string): Date | null {
    if (!val || val === 'NULL' || val === 'null') return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
}

function parseJson(val: string): any {
    if (!val || val === 'NULL' || val === 'null') return null;
    try {
        return JSON.parse(val);
    } catch {
        return val;
    }
}

async function migrate() {
    console.log('Truncating all tables for a clean migration...');
    // Delete in dependency order
    await prisma.eventAttendee.deleteMany({});
    await prisma.eventRegistration.deleteMany({});
    await prisma.formResponse.deleteMany({});
    
    await prisma.attendee.deleteMany({});
    await prisma.registration.deleteMany({});
    
    await prisma.formField.deleteMany({});
    await prisma.form.deleteMany({});
    await prisma.event.deleteMany({});
    await prisma.group.deleteMany({});
    await prisma.batch.deleteMany({});
    await prisma.vendor.deleteMany({});
    
    await prisma.userActiveOrganization.deleteMany({});
    await prisma.organizationMember.deleteMany({});
    await prisma.organization.deleteMany({});
    
    await prisma.session.deleteMany({});
    await prisma.account.deleteMany({});
    await prisma.invitation.deleteMany({});
    await prisma.verification.deleteMany({});
    await prisma.user.deleteMany({});
    
    await prisma.$executeRaw`DELETE FROM "_PermissionToRole"`;
    await prisma.role.deleteMany({});
    await prisma.permission.deleteMany({});

    console.log('Tables truncated. Starting migration...');

    // 1. Permission
    const permissionsCSV = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'Permission.csv'), 'utf8'));
    console.log(`Parsed ${permissionsCSV.length} permissions.`);
    for (const row of permissionsCSV) {
        await prisma.permission.create({
            data: {
                id: row.id,
                name: row.name,
                description: row.description || null,
                createdAt: parseDate(row.createdAt) || new Date(),
                updatedAt: parseDate(row.updatedAt) || new Date(),
            }
        });
    }

    // 2. Role
    const rolesCSV = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'Role.csv'), 'utf8'));
    console.log(`Parsed ${rolesCSV.length} roles.`);
    for (const row of rolesCSV) {
        await prisma.role.create({
            data: {
                id: row.id,
                name: row.name,
                description: row.description || null,
                createdAt: parseDate(row.createdAt) || new Date(),
                updatedAt: parseDate(row.updatedAt) || new Date(),
            }
        });
    }

    // 3. _PermissionToRole
    if (fs.existsSync(path.join(CSV_DIR, '_PermissionToRole.csv'))) {
        const relsCSV = parseCSV(fs.readFileSync(path.join(CSV_DIR, '_PermissionToRole.csv'), 'utf8'));
        console.log(`Parsed ${relsCSV.length} permission-to-role relationships.`);
        for (const row of relsCSV) {
            await prisma.$executeRaw`
                INSERT INTO "_PermissionToRole" ("A", "B")
                VALUES (${row.A}, ${row.B})
                ON CONFLICT DO NOTHING
            `;
        }
    }

    // 4. User
    const usersCSV = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'User.csv'), 'utf8'));
    console.log(`Parsed ${usersCSV.length} users.`);
    for (const row of usersCSV) {
        await prisma.user.create({
            data: {
                id: row.id,
                name: row.name || null,
                email: row.email,
                emailVerified: parseBool(row.emailVerified),
                image: row.image || null,
                isPlatformSuperAdmin: row.email === 'admin@gcmethiopia.org',
                createdAt: parseDate(row.createdAt) || new Date(),
                updatedAt: parseDate(row.updatedAt) || new Date(),
                roleId: row.roleId || null,
            }
        });
    }

    // 5. Session
    const sessionsCSV = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'Session.csv'), 'utf8'));
    console.log(`Parsed ${sessionsCSV.length} sessions.`);
    for (const row of sessionsCSV) {
        await prisma.session.create({
            data: {
                id: row.id,
                userId: row.userId,
                token: row.token,
                expiresAt: parseDate(row.expiresAt) || new Date(),
                ipAddress: row.ipAddress || null,
                userAgent: row.userAgent || null,
                createdAt: parseDate(row.createdAt) || new Date(),
                updatedAt: parseDate(row.updatedAt) || new Date(),
            }
        });
    }

    // 6. Account
    const accountsCSV = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'Account.csv'), 'utf8'));
    console.log(`Parsed ${accountsCSV.length} accounts.`);
    for (const row of accountsCSV) {
        await prisma.account.create({
            data: {
                id: row.id,
                userId: row.userId,
                accountId: row.accountId,
                providerId: row.providerId,
                accessToken: row.accessToken || null,
                refreshToken: row.refreshToken || null,
                accessTokenExpiresAt: parseDate(row.accessTokenExpiresAt),
                refreshTokenExpiresAt: parseDate(row.refreshTokenExpiresAt),
                scope: row.scope || null,
                idToken: row.idToken || null,
                password: row.password || null,
                createdAt: parseDate(row.createdAt) || new Date(),
                updatedAt: parseDate(row.updatedAt) || new Date(),
            }
        });
    }

    // 7. Verification
    const verificationCSV = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'Verification.csv'), 'utf8'));
    console.log(`Parsed ${verificationCSV.length} verifications.`);
    for (const row of verificationCSV) {
        await prisma.verification.create({
            data: {
                id: row.id,
                identifier: row.identifier,
                value: row.value,
                expiresAt: parseDate(row.expiresAt) || new Date(),
                createdAt: parseDate(row.createdAt) || new Date(),
                updatedAt: parseDate(row.updatedAt) || new Date(),
            }
        });
    }

    // 8. Invitation
    const invitationCSV = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'Invitation.csv'), 'utf8'));
    console.log(`Parsed ${invitationCSV.length} invitations.`);
    for (const row of invitationCSV) {
        await prisma.invitation.create({
            data: {
                id: row.id,
                email: row.email,
                roleId: row.roleId,
                grantPlatformSuperAdmin: false,
                token: row.token,
                expiresAt: parseDate(row.expiresAt) || new Date(),
                used: parseBool(row.used),
                createdAt: parseDate(row.createdAt) || new Date(),
                updatedAt: parseDate(row.updatedAt) || new Date(),
            }
        });
    }

    // 9. Vendor
    const vendorCSV = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'Vendor.csv'), 'utf8'));
    console.log(`Parsed ${vendorCSV.length} vendors.`);
    for (const row of vendorCSV) {
        await prisma.vendor.create({
            data: {
                id: row.id,
                name: row.name,
                capacity: parseInt(row.capacity, 10) || 0,
                createdAt: parseDate(row.createdAt) || new Date(),
                updatedAt: parseDate(row.updatedAt) || new Date(),
            }
        });
    }

    // 10. Group
    const groupCSV = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'Group.csv'), 'utf8'));
    console.log(`Parsed ${groupCSV.length} groups.`);
    for (const row of groupCSV) {
        await prisma.group.create({
            data: {
                id: row.id,
                name: row.name,
                description: row.description || null,
                roles: parsePgArray(row.roles),
                paymentStatuses: parsePgArray(row.paymentStatuses),
                coupons: parsePgArray(row.coupons),
                registrationIds: parsePgArray(row.registrationIds).map(x => parseInt(x, 10)),
                eventRegistrationIds: parsePgArray(row.eventRegistrationIds),
                vendorId: row.vendorId || null,
                createdAt: parseDate(row.createdAt) || new Date(),
                updatedAt: parseDate(row.updatedAt) || new Date(),
            }
        });
    }

    // 11. Batch
    const batchCSV = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'Batch.csv'), 'utf8'));
    console.log(`Parsed ${batchCSV.length} batches.`);
    for (const row of batchCSV) {
        await prisma.batch.create({
            data: {
                id: row.id,
                name: row.name,
                prefix: parseInt(row.prefix, 10) || 0,
                roles: parsePgArray(row.roles),
                paymentStatuses: parsePgArray(row.paymentStatuses),
                coupons: parsePgArray(row.coupons),
                registrationIds: parsePgArray(row.registrationIds).map(x => parseInt(x, 10)),
                eventRegistrationIds: parsePgArray(row.eventRegistrationIds),
                createdAt: parseDate(row.createdAt) || new Date(),
                updatedAt: parseDate(row.updatedAt) || new Date(),
            }
        });
    }

    // 12. Registration
    const registrationCSV = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'Registration.csv'), 'utf8'));
    console.log(`Parsed ${registrationCSV.length} registrations.`);
    for (const row of registrationCSV) {
        await prisma.registration.create({
            data: {
                id: parseInt(row.id, 10),
                title: row.title || null,
                fullName: row.fullName,
                churchName: row.churchName,
                serviceRole: row.serviceRole,
                phoneNumber: row.phoneNumber,
                email: row.email || null,
                receiptPath: row.receiptPath || null,
                amount: row.amount,
                paymentStatus: row.paymentStatus || 'pending',
                createdAt: parseDate(row.createdAt) || new Date(),
                updatedAt: parseDate(row.updatedAt) || new Date(),
                isGroup: parseBool(row.isGroup),
                checkedIn: parseBool(row.checkedIn),
                checkedInAt: parseDate(row.checkedInAt),
                couponCode: row.couponCode || null,
                discountApplied: row.discountApplied || null,
                activities: parseJson(row.activities),
                paymentType: row.paymentType || 'TELEBIRR',
                transactionReference: row.transactionReference || null,
                deletedAt: parseDate(row.deletedAt),
                ticketNumber: parseInt(row.ticketNumber, 10) || null,
                vendorId: row.vendorId || null,
                groupId: row.groupId || null,
                isBadgePrinted: parseBool(row.isBadgePrinted),
                badgePrintedAt: parseDate(row.badgePrintedAt),
            }
        });
    }

    // 13. Attendee
    const attendeeCSV = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'Attendee.csv'), 'utf8'));
    console.log(`Parsed ${attendeeCSV.length} attendees.`);
    for (const row of attendeeCSV) {
        await prisma.attendee.create({
            data: {
                id: parseInt(row.id, 10),
                registrationId: parseInt(row.registrationId, 10),
                title: row.title || null,
                fullName: row.fullName,
                role: row.role,
                amount: row.amount,
                phoneNumber: row.phoneNumber || null,
                checkedIn: parseBool(row.checkedIn),
                checkedInAt: parseDate(row.checkedInAt),
                activities: parseJson(row.activities),
                createdAt: parseDate(row.createdAt) || new Date(),
                updatedAt: parseDate(row.updatedAt) || new Date(),
                ticketNumber: parseInt(row.ticketNumber, 10) || null,
                vendorId: row.vendorId || null,
                groupId: row.groupId || null,
                isBadgePrinted: parseBool(row.isBadgePrinted),
                badgePrintedAt: parseDate(row.badgePrintedAt),
            }
        });
    }

    console.log('Core data import completed.');

    // 14. Seed/Set up Default Organization & Event
    console.log('Setting up default Organization & Event...');
    const orgSlug = process.env.DEFAULT_ORG_SLUG || 'gcme';
    const orgName = process.env.DEFAULT_ORG_NAME || 'GCME Default Organization';
    const eventSlug = process.env.DEFAULT_EVENT_SLUG || 'church-leadership-summit';
    const eventName = process.env.EVENT_NAME || 'Church Leadership Summit';

    // Find the admin user
    const adminUser = await prisma.user.findFirst({
        where: { email: 'admin@gcmethiopia.org' }
    });
    if (!adminUser) {
        throw new Error('Admin user (admin@gcmethiopia.org) not found in imported users!');
    }

    const org = await prisma.organization.upsert({
        where: { slug: orgSlug },
        update: { ownerId: adminUser.id, name: orgName },
        create: { slug: orgSlug, name: orgName, ownerId: adminUser.id, settings: { migratedFrom: 'legacy-single-tenant' } }
    });

    // Link imported operational data to this default organization
    console.log('Scoping vendors, groups, batches, and registrations to the default organization...');
    await prisma.vendor.updateMany({
        where: { organizationId: null },
        data: { organizationId: org.id }
    });
    await prisma.group.updateMany({
        where: { organizationId: null },
        data: { organizationId: org.id }
    });
    await prisma.batch.updateMany({
        where: { organizationId: null },
        data: { organizationId: org.id }
    });
    await prisma.registration.updateMany({
        where: { organizationId: null },
        data: { organizationId: org.id }
    });

    // Create the default registration form
    let registrationForm = await prisma.form.findFirst({
        where: { organizationId: org.id, name: 'Summit registration (legacy fields)' },
    });
    if (!registrationForm) {
        registrationForm = await prisma.form.create({
            data: {
                organizationId: org.id,
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

    // Create default Event
    const event = await prisma.event.upsert({
        where: { organizationId_slug: { organizationId: org.id, slug: eventSlug } },
        update: { registrationFormId: registrationForm.id },
        create: {
            organizationId: org.id,
            name: eventName,
            slug: eventSlug,
            registrationFormId: registrationForm.id,
        }
    });

    await prisma.form.update({
        where: { id: registrationForm.id },
        data: { eventId: event.id, isActive: true }
    });

    await prisma.registration.updateMany({
        where: { eventId: null },
        data: { eventId: event.id }
    });

    // Map all users to organization members
    console.log('Mapping users to organization members...');
    const users = await prisma.user.findMany({
        include: { role: true }
    });

    const ALL_ORG_PERMISSIONS = [
        'manage_events',
        'manage_forms',
        'view_registrations',
        'register_participants',
        'check_in_participants',
        'view_financials',
        'manage_payments',
        'delete_registrations',
        'edit_registrations',
        'manage_batches',
        'manage_groups',
        'manage_vendors',
        'manage_users',
        'manage_roles',
        'export_data',
    ];

    for (const u of users) {
        let orgRole = OrgRole.STAFF;
        if (u.email === 'admin@gcmethiopia.org') {
            orgRole = OrgRole.OWNER;
        } else if (u.role?.name === 'Super Admin' || u.role?.name === 'Admin') {
            orgRole = OrgRole.ADMIN;
        }

        await prisma.organizationMember.upsert({
            where: {
                organizationId_userId: {
                    organizationId: org.id,
                    userId: u.id,
                }
            },
            update: { role: orgRole, permissions: ALL_ORG_PERMISSIONS },
            create: {
                organizationId: org.id,
                userId: u.id,
                role: orgRole,
                permissions: ALL_ORG_PERMISSIONS
            }
        });

        await prisma.userActiveOrganization.upsert({
            where: { userId: u.id },
            update: { organizationId: org.id },
            create: { userId: u.id, organizationId: org.id }
        });
    }

    console.log('Default organization and event setup completed.');

    // 15. Execute backfill logic
    console.log('Running backfill of legacy registrations into multi-tenant tables...');
    const formId = registrationForm.id;
    const registrations = await prisma.registration.findMany({
        include: { attendees: true },
        orderBy: { id: 'asc' },
    });

    console.log(`Backfilling ${registrations.length} legacy registrations...`);

    let backfilledCount = 0;
    let attendeesBackfilledCount = 0;
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
            attendeesBackfilledCount++;
        }
        backfilledCount++;
    }

    console.log(`Backfill done. Successfully backfilled ${backfilledCount} registrations and ${attendeesBackfilledCount} attendees.`);

    // 16. Print summary verification stats
    console.log('\n--- Migration Verification Summary ---');
    console.log(`Permissions: ${await prisma.permission.count()}`);
    console.log(`Roles: ${await prisma.role.count()}`);
    console.log(`Users: ${await prisma.user.count()}`);
    console.log(`Sessions: ${await prisma.session.count()}`);
    console.log(`Accounts: ${await prisma.account.count()}`);
    console.log(`Invitations: ${await prisma.invitation.count()}`);
    console.log(`Vendors: ${await prisma.vendor.count()}`);
    console.log(`Groups: ${await prisma.group.count()}`);
    console.log(`Batches: ${await prisma.batch.count()}`);
    console.log(`Registrations: ${await prisma.registration.count()}`);
    console.log(`Attendees: ${await prisma.attendee.count()}`);
    console.log(`EventRegistrations: ${await prisma.eventRegistration.count()}`);
    console.log(`EventAttendees: ${await prisma.eventAttendee.count()}`);
    console.log(`FormResponses: ${await prisma.formResponse.count()}`);
    console.log('-------------------------------------\n');
}

migrate()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
