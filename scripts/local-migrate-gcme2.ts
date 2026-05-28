import { PrismaClient, OrgRole, FormFieldType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const CSV_DIR = '/Users/dsethiopia/Downloads/Telegram Desktop/db_exports';

function parseCSV(content: string): Record<string, string>[] {
    const lines: string[] = [];
    let cur = '', inQ = false;
    for (const ch of content) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === '\n' && !inQ) { lines.push(cur); cur = ''; continue; }
        else if (ch === '\r' && !inQ) { continue; }
        cur += ch;
    }
    if (cur) lines.push(cur);
    if (!lines.length) return [];
    const headers = splitLine(lines[0]);
    const out: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const vals = splitLine(lines[i]);
        const obj: Record<string, string> = {};
        headers.forEach((h, j) => { obj[h] = vals[j] ?? ''; });
        out.push(obj);
    }
    return out;
}
function splitLine(line: string): string[] {
    const parts: string[] = [];
    let cur = '', inQ = false;
    for (const ch of line) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { parts.push(cur); cur = ''; }
        else { cur += ch; }
    }
    parts.push(cur);
    return parts.map(v => {
        let s = v.trim();
        if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
        return s.replace(/""/g, '"');
    });
}
function parsePgArray(s: string): string[] {
    if (!s) return [];
    let str = s.trim();
    if (str.startsWith('"') && str.endsWith('"')) str = str.slice(1, -1);
    if (!str.startsWith('{') || !str.endsWith('}')) return [];
    str = str.slice(1, -1).trim();
    if (!str) return [];
    const res: string[] = [];
    let cur = '', inQ = false;
    for (const ch of str) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { res.push(cleanElem(cur)); cur = ''; }
        else { cur += ch; }
    }
    res.push(cleanElem(cur));
    return res;
}
function cleanElem(v: string): string {
    let s = v.trim();
    if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
    return s.replace(/\\"/g, '"').replace(/""/g, '"');
}
const boolVal = (v: string) => ['t', 'true', '1'].includes((v ?? '').trim().toLowerCase());
const dateVal = (v: string): Date | null => {
    if (!v || v === 'NULL' || v === 'null') return null;
    const d = new Date(v); return isNaN(d.getTime()) ? null : d;
};
const jsonVal = (v: string): unknown => {
    if (!v || v === 'NULL' || v === 'null') return null;
    try { return JSON.parse(v); } catch { return v; }
};
const intVal = (v: string): number | null => { const n = parseInt(v, 10); return isNaN(n) ? null : n; };

async function migrate() {
    const ORG_SLUG = 'gcme-2';
    const ORG_NAME = 'GCME-2';
    const EVENT_SLUG = 'church-leadership-summit-2';
    const EVENT_NAME = 'Church Leadership Summit (GCME-2)';

    // 1. Global auth – upsert (safe to re-run)
    const permRows = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'Permission.csv'), 'utf8'));
    console.log(`Upserting ${permRows.length} permissions...`);
    for (const r of permRows) {
        await prisma.permission.upsert({ where: { id: r.id }, update: {}, create: { id: r.id, name: r.name, description: r.description || null, createdAt: dateVal(r.createdAt) ?? new Date(), updatedAt: dateVal(r.updatedAt) ?? new Date() } });
    }
    const roleRows = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'Role.csv'), 'utf8'));
    console.log(`Upserting ${roleRows.length} roles...`);
    for (const r of roleRows) {
        await prisma.role.upsert({ where: { id: r.id }, update: {}, create: { id: r.id, name: r.name, description: r.description || null, createdAt: dateVal(r.createdAt) ?? new Date(), updatedAt: dateVal(r.updatedAt) ?? new Date() } });
    }
    const relRows = parseCSV(fs.readFileSync(path.join(CSV_DIR, '_PermissionToRole.csv'), 'utf8'));
    for (const r of relRows) { await prisma.$executeRaw`INSERT INTO "_PermissionToRole" ("A","B") VALUES (${r.A}, ${r.B}) ON CONFLICT DO NOTHING`; }
    const userRows = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'User.csv'), 'utf8'));
    console.log(`Upserting ${userRows.length} users...`);
    for (const r of userRows) {
        await prisma.user.upsert({ where: { id: r.id }, update: {}, create: { id: r.id, name: r.name || null, email: r.email, emailVerified: boolVal(r.emailVerified), image: r.image || null, isPlatformSuperAdmin: r.email === 'admin@gcmethiopia.org', createdAt: dateVal(r.createdAt) ?? new Date(), updatedAt: dateVal(r.updatedAt) ?? new Date(), roleId: r.roleId || null } });
    }
    const sessionRows = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'Session.csv'), 'utf8'));
    console.log(`Upserting ${sessionRows.length} sessions...`);
    for (const r of sessionRows) {
        await prisma.session.upsert({ where: { id: r.id }, update: {}, create: { id: r.id, userId: r.userId, token: r.token, expiresAt: dateVal(r.expiresAt) ?? new Date(), ipAddress: r.ipAddress || null, userAgent: r.userAgent || null, createdAt: dateVal(r.createdAt) ?? new Date(), updatedAt: dateVal(r.updatedAt) ?? new Date() } });
    }
    const accountRows = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'Account.csv'), 'utf8'));
    console.log(`Upserting ${accountRows.length} accounts...`);
    for (const r of accountRows) {
        await prisma.account.upsert({ where: { id: r.id }, update: {}, create: { id: r.id, userId: r.userId, accountId: r.accountId, providerId: r.providerId, accessToken: r.accessToken || null, refreshToken: r.refreshToken || null, accessTokenExpiresAt: dateVal(r.accessTokenExpiresAt), refreshTokenExpiresAt: dateVal(r.refreshTokenExpiresAt), scope: r.scope || null, idToken: r.idToken || null, password: r.password || null, createdAt: dateVal(r.createdAt) ?? new Date(), updatedAt: dateVal(r.updatedAt) ?? new Date() } });
    }
    const invRows = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'Invitation.csv'), 'utf8'));
    for (const r of invRows) {
        const e = await prisma.invitation.findUnique({ where: { id: r.id } });
        if (!e) await prisma.invitation.create({ data: { id: r.id, email: r.email, roleId: r.roleId, grantPlatformSuperAdmin: false, token: r.token, expiresAt: dateVal(r.expiresAt) ?? new Date(), used: boolVal(r.used), createdAt: dateVal(r.createdAt) ?? new Date(), updatedAt: dateVal(r.updatedAt) ?? new Date() } });
    }

    // 2. Org – upsert (handles both fresh and resume cases)
    const adminUser = await prisma.user.findFirstOrThrow({ where: { email: 'admin@gcmethiopia.org' } });
    let org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
    if (!org) {
        console.log(`Creating organisation: ${ORG_NAME}`);
        org = await prisma.organization.create({ data: { slug: ORG_SLUG, name: ORG_NAME, ownerId: adminUser.id, settings: { migratedFrom: 'legacy-single-tenant' } } });
    } else {
        console.log(`Resuming import for existing org: ${ORG_NAME} (${org.id})`);
    }

    // Scoped cleanup: delete existing operational data for this organization to ensure clean import
    console.log(`Cleaning up existing data for organisation ${ORG_NAME}...`);
    await prisma.eventAttendee.deleteMany({ where: { eventRegistration: { organizationId: org.id } } });
    await prisma.eventRegistration.deleteMany({ where: { organizationId: org.id } });
    await prisma.formResponse.deleteMany({ where: { organizationId: org.id } });
    await prisma.attendee.deleteMany({ where: { registration: { organizationId: org.id } } });
    await prisma.registration.deleteMany({ where: { organizationId: org.id } });
    await prisma.formField.deleteMany({ where: { form: { organizationId: org.id } } });
    await prisma.form.deleteMany({ where: { organizationId: org.id } });
    await prisma.event.deleteMany({ where: { organizationId: org.id } });
    await prisma.group.deleteMany({ where: { organizationId: org.id } });
    await prisma.batch.deleteMany({ where: { organizationId: org.id } });
    await prisma.vendor.deleteMany({ where: { organizationId: org.id } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: org.id } });

    // Reset PostgreSQL auto-increment sequences so they start generating IDs above the existing ones
    console.log('Resetting PostgreSQL sequences...');
    await prisma.$executeRawUnsafe('SELECT setval(pg_get_serial_sequence(\'"Registration"\', \'id\'), COALESCE(MAX(id), 1)) FROM "Registration"');
    await prisma.$executeRawUnsafe('SELECT setval(pg_get_serial_sequence(\'"Attendee"\', \'id\'), COALESCE(MAX(id), 1)) FROM "Attendee"');

    // 3. Vendors – fresh IDs, old->new map
    const vendorRows = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'Vendor.csv'), 'utf8'));
    console.log(`Creating ${vendorRows.length} vendors...`);
    const vendorMap = new Map<string, string>();
    for (const r of vendorRows) {
        const v = await prisma.vendor.create({ data: { organizationId: org.id, name: r.name, capacity: parseInt(r.capacity, 10) || 0, createdAt: dateVal(r.createdAt) ?? new Date(), updatedAt: dateVal(r.updatedAt) ?? new Date() } });
        vendorMap.set(r.id, v.id);
    }

    // 4. Groups – fresh IDs, old->new map
    const groupRows = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'Group.csv'), 'utf8'));
    console.log(`Creating ${groupRows.length} groups...`);
    const groupMap = new Map<string, string>();
    for (const r of groupRows) {
        const g = await prisma.group.create({ data: { organizationId: org.id, name: r.name, description: r.description || null, roles: parsePgArray(r.roles), paymentStatuses: parsePgArray(r.paymentStatuses), coupons: parsePgArray(r.coupons), registrationIds: parsePgArray(r.registrationIds).map(x => parseInt(x, 10)).filter(x => !isNaN(x)), eventRegistrationIds: [], vendorId: r.vendorId ? (vendorMap.get(r.vendorId) ?? null) : null, createdAt: dateVal(r.createdAt) ?? new Date(), updatedAt: dateVal(r.updatedAt) ?? new Date() } });
        groupMap.set(r.id, g.id);
    }

    // 5. Batches – fresh IDs
    const batchRows = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'Batch.csv'), 'utf8'));
    console.log(`Creating ${batchRows.length} batches...`);
    for (const r of batchRows) {
        await prisma.batch.create({ data: { organizationId: org.id, name: r.name, prefix: parseInt(r.prefix, 10) || 0, roles: parsePgArray(r.roles), paymentStatuses: parsePgArray(r.paymentStatuses), coupons: parsePgArray(r.coupons), registrationIds: [], eventRegistrationIds: [], createdAt: dateVal(r.createdAt) ?? new Date(), updatedAt: dateVal(r.updatedAt) ?? new Date() } });
    }

    // 6. Registrations – auto-increment id, old->new map
    const regRows = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'Registration.csv'), 'utf8'));
    console.log(`Creating ${regRows.length} registrations...`);
    const regMap = new Map<number, number>();
    for (const r of regRows) {
        const nr = await prisma.registration.create({ data: { organizationId: org.id, title: r.title || null, fullName: r.fullName, churchName: r.churchName, serviceRole: r.serviceRole, phoneNumber: r.phoneNumber, email: r.email || null, receiptPath: r.receiptPath || null, amount: r.amount, paymentStatus: r.paymentStatus || 'pending', isGroup: boolVal(r.isGroup), checkedIn: boolVal(r.checkedIn), checkedInAt: dateVal(r.checkedInAt), couponCode: r.couponCode || null, discountApplied: r.discountApplied || null, activities: jsonVal(r.activities), paymentType: r.paymentType || 'TELEBIRR', transactionReference: r.transactionReference || null, deletedAt: dateVal(r.deletedAt), ticketNumber: intVal(r.ticketNumber), vendorId: r.vendorId ? (vendorMap.get(r.vendorId) ?? null) : null, groupId: r.groupId ? (groupMap.get(r.groupId) ?? null) : null, isBadgePrinted: boolVal(r.isBadgePrinted), badgePrintedAt: dateVal(r.badgePrintedAt), createdAt: dateVal(r.createdAt) ?? new Date(), updatedAt: dateVal(r.updatedAt) ?? new Date() } });
        regMap.set(parseInt(r.id, 10), nr.id);
    }

    // 7. Attendees – auto-increment id, map registrationId
    const attRows = parseCSV(fs.readFileSync(path.join(CSV_DIR, 'Attendee.csv'), 'utf8'));
    console.log(`Creating ${attRows.length} attendees...`);
    let skipped = 0;
    for (const r of attRows) {
        const newRegId = regMap.get(parseInt(r.registrationId, 10));
        if (!newRegId) { skipped++; continue; }
        await prisma.attendee.create({ data: { registrationId: newRegId, title: r.title || null, fullName: r.fullName, role: r.role, amount: r.amount, phoneNumber: r.phoneNumber || null, checkedIn: boolVal(r.checkedIn), checkedInAt: dateVal(r.checkedInAt), activities: jsonVal(r.activities), ticketNumber: intVal(r.ticketNumber), vendorId: r.vendorId ? (vendorMap.get(r.vendorId) ?? null) : null, groupId: r.groupId ? (groupMap.get(r.groupId) ?? null) : null, isBadgePrinted: boolVal(r.isBadgePrinted), badgePrintedAt: dateVal(r.badgePrintedAt), createdAt: dateVal(r.createdAt) ?? new Date(), updatedAt: dateVal(r.updatedAt) ?? new Date() } });
    }
    if (skipped) console.log(`  Skipped ${skipped} orphaned attendees.`);

    // 8. Form + Event
    console.log('Creating form and event...');
    const form = await prisma.form.create({ data: { organizationId: org.id, name: 'Summit registration (legacy fields)', isActive: true, defaultLocale: 'en', supportedLocales: ['en', 'am', 'or', 'ti'], i18nMeta: { uiTemplate: 'summit_legacy' } } });
    const fieldDefs = [
        { fieldKey: 'title', label: 'Title', type: FormFieldType.TEXT, order: 0, required: false },
        { fieldKey: 'full_name', label: 'Full name', type: FormFieldType.TEXT, order: 1, required: true },
        { fieldKey: 'church_name', label: 'Church name', type: FormFieldType.TEXT, order: 2, required: true },
        { fieldKey: 'service_role', label: 'Service role', type: FormFieldType.TEXT, order: 3, required: true },
        { fieldKey: 'phone_number', label: 'Phone number', type: FormFieldType.PHONE, order: 4, required: true },
        { fieldKey: 'email', label: 'Email', type: FormFieldType.EMAIL, order: 5, required: false },
    ];
    for (const f of fieldDefs) { await prisma.formField.create({ data: { formId: form.id, ...f } }); }
    const event = await prisma.event.create({ data: { organizationId: org.id, name: EVENT_NAME, slug: EVENT_SLUG, registrationFormId: form.id } });
    await prisma.form.update({ where: { id: form.id }, data: { eventId: event.id } });
    await prisma.registration.updateMany({ where: { organizationId: org.id, eventId: null }, data: { eventId: event.id } });

    // 9. Backfill EventRegistration / EventAttendee
    console.log('Backfilling EventRegistration / EventAttendee...');
    const allRegs = await prisma.registration.findMany({ where: { organizationId: org.id }, include: { attendees: true }, orderBy: { id: 'asc' } });
    let erCount = 0, eaCount = 0;
    for (const r of allRegs) {
        const pFR = await prisma.formResponse.create({ data: { formId: form.id, organizationId: org.id, eventId: event.id, responses: { title: r.title ?? '', full_name: r.fullName, church_name: r.churchName, service_role: r.serviceRole, phone_number: r.phoneNumber, email: r.email ?? '' } } });
        const er = await prisma.eventRegistration.create({ data: { organizationId: org.id, eventId: event.id, primaryResponseId: pFR.id, isGroup: r.isGroup, paymentStatus: r.paymentStatus, paymentType: r.paymentType, transactionReference: r.transactionReference, amount: r.amount, receiptPath: r.receiptPath, couponCode: r.couponCode, discountApplied: r.discountApplied, deletedAt: r.deletedAt, ticketNumber: r.ticketNumber, vendorId: r.vendorId, groupId: r.groupId, checkedIn: r.checkedIn, checkedInAt: r.checkedInAt, isBadgePrinted: r.isBadgePrinted, badgePrintedAt: r.badgePrintedAt, activities: { ...(typeof r.activities === 'object' && r.activities !== null ? r.activities as object : {}), legacyRegistrationId: r.id } } });
        erCount++;
        for (const a of r.attendees) {
            const aFR = await prisma.formResponse.create({ data: { formId: form.id, organizationId: org.id, eventId: event.id, responses: { title: a.title ?? '', full_name: a.fullName, role: a.role, amount: a.amount, phone_number: a.phoneNumber ?? '' } } });
            await prisma.eventAttendee.create({ data: { eventRegistrationId: er.id, formResponseId: aFR.id, ticketNumber: a.ticketNumber, checkedIn: a.checkedIn, checkedInAt: a.checkedInAt, isBadgePrinted: a.isBadgePrinted, badgePrintedAt: a.badgePrintedAt, vendorId: a.vendorId, groupId: a.groupId } });
            eaCount++;
        }
    }

    // 10. Org members
    console.log('Adding users as GCME-2 members...');
    const ALL_PERMS = ['manage_events','manage_forms','view_registrations','register_participants','check_in_participants','view_financials','manage_payments','delete_registrations','edit_registrations','manage_batches','manage_groups','manage_vendors','manage_users','manage_roles','export_data'];
    const users = await prisma.user.findMany({ include: { role: true } });
    for (const u of users) {
        const orgRole = u.email === 'admin@gcmethiopia.org' ? OrgRole.OWNER : (u.role?.name === 'Super Admin' || u.role?.name === 'Admin') ? OrgRole.ADMIN : OrgRole.STAFF;
        await prisma.organizationMember.upsert({ where: { organizationId_userId: { organizationId: org.id, userId: u.id } }, update: { role: orgRole, permissions: ALL_PERMS }, create: { organizationId: org.id, userId: u.id, role: orgRole, permissions: ALL_PERMS } });
    }

    await printSummary(org.id, ORG_NAME, erCount, eaCount, skipped);
}

async function printSummary(orgId: string, orgName: string, erCount: number, eaCount: number, skipped: number) {
    console.log('\n--- GCME-2 Migration Verification Summary ---');
    console.log(`Organisation:       ${orgName} (${orgId})`);
    console.log(`Vendors:            ${await prisma.vendor.count({ where: { organizationId: orgId } })}`);
    console.log(`Groups:             ${await prisma.group.count({ where: { organizationId: orgId } })}`);
    console.log(`Batches:            ${await prisma.batch.count({ where: { organizationId: orgId } })}`);
    console.log(`Registrations:      ${await prisma.registration.count({ where: { organizationId: orgId } })}`);
    console.log(`Attendees:          ${await prisma.attendee.count({ where: { registration: { organizationId: orgId } } })}${skipped ? ` (${skipped} orphaned skipped)` : ''}`);
    console.log(`EventRegistrations: ${await prisma.eventRegistration.count({ where: { organizationId: orgId } })}`);
    console.log(`EventAttendees:     ${await prisma.eventAttendee.count({ where: { eventRegistration: { organizationId: orgId } } })}`);
    console.log(`FormResponses:      ${await prisma.formResponse.count({ where: { organizationId: orgId } })}`);
    console.log('─────────────────────────────────────────────');
    console.log('GCME-2 migration complete.');
}

migrate()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
