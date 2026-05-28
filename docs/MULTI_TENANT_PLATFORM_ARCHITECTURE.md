# Multi-tenant dynamic event platform — architecture

This document specifies how to evolve **cls-event** from a single-event, fixed-field system into an **organization-scoped, multi-tenant platform** with dynamic forms, events, and strict data isolation. It is intended as an implementation blueprint for senior engineers.

---

## 1. Design principles

| Principle | Application |
|-----------|-------------|
| **Tenant isolation** | Every query filters by `organizationId` (and `eventId` where relevant). Prefer composite unique constraints `(organizationId, slug)` over global uniqueness. |
| **Explicit membership** | Org access is never inferred from email alone; use `OrganizationMember` with an org-scoped role. |
| **Forms as schema** | `Form` + `FormField` define structure; answers live in `FormResponse.responses` (JSON). Operational state (payment, tickets, check-in) lives in domain tables that **reference** responses, not duplicate business fields. |
| **Progressive enhancement** | Ship vertical slices (orgs → events → one form → register) before building every dashboard module. |
| **better-auth** | Keep email/password and sessions; extend session payload with **active organization** and **org-scoped permissions**, not a second auth system. |

---

## 2. Updated Prisma schema (target state)

Below is a **cohesive target schema**. Adjust field names to match product language; keep `organizationId` on all tenant-owned rows.

> **Note:** This replaces the global `User.roleId` + global `Role` model for **application authorization**. You may keep better-auth tables (`User`, `Session`, `Account`, `Verification`) and **either** (a) drop global `Role`/`Permission`/`Invitation` in favor of org-scoped models, or (b) retain a **platform-only** `Role` for `SUPER_ADMIN` users who manage all organizations. The schema below uses **platform flag + org membership** (recommended).

```prisma
// prisma/schema.prisma (target — illustrative)

generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x", "linux-musl-arm64-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// --- Platform identity (better-auth compatible) ---

model User {
  id            String   @id @default(cuid())
  name          String?
  email         String   @unique
  emailVerified Boolean  @default(false)
  image         String?
  /// Platform super-admin: can list/manage all orgs (optional; use sparingly)
  isPlatformSuperAdmin Boolean @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  accounts          Account[]
  sessions          Session[]
  organizationMembers OrganizationMember[]
  ownedOrganizations  Organization[] @relation("OrganizationOwner")
}

// --- Multi-tenancy ---

model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  ownerId   String
  owner     User     @relation("OrganizationOwner", fields: [ownerId], references: [id])
  settings  Json?    // branding, default locale, billing metadata, feature flags
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members       OrganizationMember[]
  events        Event[]
  forms         Form[]
  groups        Group[]
  vendors       Vendor[]
  batches       Batch[]
  invitations   OrganizationInvitation[]
  registrations EventRegistration[]
  formResponses FormResponse[]
}

enum OrgRole {
  OWNER   // full control; billing; delete org (policy-defined)
  ADMIN   // manage events, forms, staff, registrations
  STAFF   // operational: check-in, view registrations per permission set
}

model OrganizationMember {
  id             String   @id @default(cuid())
  organizationId String
  userId         String
  role           OrgRole
  /// Fine-grained permissions for STAFF (and optional overrides for ADMIN)
  permissions    String[] // e.g. manage_events, manage_forms, view_registrations, ...
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([organizationId, userId])
  @@index([userId])
  @@index([organizationId])
}

model OrganizationInvitation {
  id             String   @id @default(cuid())
  organizationId String
  email          String
  role           OrgRole
  permissions    String[]
  token          String   @unique
  expiresAt      DateTime
  used           Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId, email])
}

// --- Events & forms ---

model Event {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  slug           String
  description    String?
  startsAt       DateTime?
  endsAt         DateTime?
  /// Primary registration form for this event (individual + group lead capture)
  registrationFormId String?
  registrationForm   Form?   @relation("EventRegistrationForm", fields: [registrationFormId], references: [id])
  settings       Json?    // capacity, pricing rules references, etc.
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  forms        Form[]       @relation("EventForms")

  registrations EventRegistration[]

  @@unique([organizationId, slug])
  @@index([organizationId])
}

model Form {
  id             String   @id @default(cuid())
  organizationId String
  eventId        String?  // optional: form scoped to event or reusable library
  name           String
  isActive       Boolean  @default(true)
  /// Default and supported locales for labels/options (i18n)
  defaultLocale   String   @default("en")
  supportedLocales String[] // e.g. ["en","am"]
  /// Optional: labels per locale for form title/description
  i18nMeta       Json?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  event        Event?       @relation("EventForms", fields: [eventId], references: [id], onDelete: SetNull)
  eventsAsRegistration Event[] @relation("EventRegistrationForm")

  fields    FormField[]
  responses FormResponse[]
}

model FormField {
  id          String   @id @default(cuid())
  formId      String
  /// Stable key for JSON storage and Zod generation, e.g. "full_name"
  fieldKey    String
  label       String
  /// For i18n: { "en": "...", "am": "..." }
  labelI18n   Json?
  type        FormFieldType
  required    Boolean  @default(false)
  order       Int      @default(0)
  options     Json?    // select/radio options; can be locale-keyed
  validation  Json?    // min, max, pattern, maxFileSize, etc.
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  form Form @relation(fields: [formId], references: [id], onDelete: Cascade)

  @@unique([formId, fieldKey])
  @@index([formId, order])
}

enum FormFieldType {
  TEXT
  TEXTAREA
  NUMBER
  EMAIL
  PHONE
  SELECT
  RADIO
  CHECKBOX
  MULTI_SELECT
  DATE
  DATETIME
  FILE
  HIDDEN
}

model FormResponse {
  id             String   @id @default(cuid())
  formId         String
  organizationId String
  eventId        String?  // denormalized for filtering (set on submit)
  /// answers: { [fieldKey]: value } — value shapes depend on field type
  responses      Json
  submittedByUserId String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  form         Form         @relation(fields: [formId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  primaryForRegistration EventRegistration? @relation("PrimaryResponse")
  attendeeRows           EventAttendee[]

  @@index([organizationId, formId])
  @@index([organizationId, eventId])
}

// --- Registration domain (operational metadata + dynamic answers) ---

model EventRegistration {
  id             String   @id @default(cuid())
  organizationId String
  eventId        String
  /// Primary submission (individual OR group contact)
  primaryResponseId String @unique
  primaryResponse   FormResponse @relation("PrimaryResponse", fields: [primaryResponseId], references: [id])

  isGroup        Boolean  @default(false)
  paymentStatus  String   @default("pending")
  paymentType    String?
  transactionReference String?
  amount         String?  // or Decimal + currency in settings
  receiptPath    String?
  couponCode     String?
  discountApplied String?
  deletedAt      DateTime?

  ticketNumber   Int?
  vendorId       String?
  groupId        String?

  checkedIn      Boolean  @default(false)
  checkedInAt    DateTime?
  isBadgePrinted Boolean  @default(false)
  badgePrintedAt DateTime?

  qrPayload      String?  @unique // stable token for check-in / badge
  activities     Json?

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  event        Event        @relation(fields: [eventId], references: [id], onDelete: Cascade)
  vendor       Vendor?      @relation(fields: [vendorId], references: [id])
  group        Group?       @relation(fields: [groupId], references: [id])
  attendees    EventAttendee[]

  @@index([organizationId, eventId])
  @@index([paymentStatus])
}

model EventAttendee {
  id               String   @id @default(cuid())
  eventRegistrationId String
  /// One FormResponse per attendee for group registrations (same or different form — product choice)
  formResponseId   String   @unique
  ticketNumber     Int?
  checkedIn        Boolean  @default(false)
  checkedInAt      DateTime?
  isBadgePrinted   Boolean  @default(false)
  badgePrintedAt   DateTime?
  vendorId         String?
  groupId          String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  eventRegistration EventRegistration @relation(fields: [eventRegistrationId], references: [id], onDelete: Cascade)
  formResponse      FormResponse       @relation(fields: [formResponseId], references: [id], onDelete: Restrict)
  vendor            Vendor?           @relation(fields: [vendorId], references: [id])
  group             Group?            @relation(fields: [groupId], references: [id])

  @@index([eventRegistrationId])
}

// --- Supporting entities (scoped) ---

model Batch {
  id              String   @id @default(cuid())
  organizationId  String
  name            String
  prefix          Int
  roles           String[]
  paymentStatuses String[]
  coupons         String[]
  registrationIds String[] // now UUIDs referencing EventRegistration.id
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, name])
}

model Group {
  id              String   @id @default(cuid())
  organizationId  String
  name            String
  description     String?
  roles           String[]
  paymentStatuses String[]
  coupons         String[]
  registrationIds String[]
  vendorId        String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  vendor       Vendor?      @relation(fields: [vendorId], references: [id])
  registrations EventRegistration[]
  attendees    EventAttendee[]
}

model Vendor {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  capacity       Int
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  registrations EventRegistration[]
  attendees    EventAttendee[]
  groups       Group[]

  @@unique([organizationId, name])
}

// --- better-auth (unchanged shape; omit if already generated) ---

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Account {
  id                    String    @id @default(cuid())
  userId                String
  accountId             String
  providerId            String
  accessToken           String?
  refreshToken          String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  idToken               String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Migration from current models:** Map old `Registration` → `EventRegistration` + `FormResponse` (populate `responses` from legacy columns). Map `Attendee` → `EventAttendee` + `FormResponse`. See [section 7](#7-migration-strategy-old--new).

---

## 3. RBAC model (extended)

| Layer | Who | How |
|-------|-----|-----|
| **Platform** | `User.isPlatformSuperAdmin` | Sees `/organizations`, cross-tenant admin; audited. |
| **Organization** | `OrganizationMember.role` + `permissions[]` | OWNER / ADMIN / STAFF; `permissions` mirrors strings like `manage_events`, `manage_forms`, `view_registrations`, `check_in_participants`, `manage_groups`, `manage_vendors`, `manage_batches`, `export_data`. |
| **Session** | `activeOrganizationId` | Stored in session (DB column on `Session` or separate `UserPreference` / encrypted cookie). better-auth `customSession` loads membership + permissions for that org. |

**Strict isolation rule:** API handlers resolve `organizationId` from **session active org** (or route param validated against membership), never from client-supplied body alone.

---

## 4. Folder structure (target)

```
src/
  app/
    (platform)/                    # optional: super-admin only
      organizations/
    (dashboard)/
      layout.tsx
      org/[orgSlug]/               # org-scoped segment (or use subdomain later)
        page.tsx                   # org home
        events/
        events/[eventSlug]/
        forms/
        forms/[formId]/
        registrations/
        groups/
        vendors/
        batches/
        attendance/
    api/
      orgs/
        route.ts                   # GET list (memberships), POST create
        [orgId]/
          route.ts                 # GET/PATCH
          members/route.ts
          invitations/route.ts
      events/
        route.ts
        [eventId]/route.ts
      forms/
        route.ts
        [formId]/
          route.ts
          fields/route.ts
          responses/route.ts
      register/
        route.ts                   # POST dynamic submit (validates org + event + form)
      ...                         # move legacy routes under org scope or deprecate
  lib/
    auth.ts                        # customSession: activeOrg + permissions
    tenancy/
      require-org.ts               # assert membership + orgId match
      scope-prisma.ts              # helpers: whereOrg(organizationId)
    forms/
      build-zod-schema.ts          # FormField[] → Zod
      render-field.tsx             # field type → input component map
    registrations/
      create-from-responses.ts
  middleware.ts                    # optional: subdomain → org slug; or skip v1
```

Use **`src/lib/tenancy/require-org.ts`** in every API route: parse session → `activeOrganizationId` → `prisma.organizationMember.findFirst({ where: { userId, organizationId } })` → abort if missing.

---

## 5. Key API route examples

### 5.1 `GET/POST /api/orgs`

```typescript
// src/app/api/orgs/route.ts — pattern only

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const isSuper = (session.user as { isPlatformSuperAdmin?: boolean }).isPlatformSuperAdmin;

  if (isSuper) {
    const orgs = await prisma.organization.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ organizations: orgs });
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    include: { organization: true },
  });
  return NextResponse.json({
    organizations: memberships.map((m) => ({
      ...m.organization,
      role: m.role,
      permissions: m.permissions,
    })),
  });
}
```

### 5.2 `POST /api/register` (dynamic)

```typescript
// src/app/api/register/route.ts — core steps

// 1. Resolve event + form by public slug + org (from host header or body.orgSlug)
// 2. Load Form + FormFields for organizationId + eventId
// 3. buildZodSchema(fields).parse(body.responses)
// 4. prisma.$transaction: create FormResponse, create EventRegistration, assign ticket batch, etc.
// 5. Return { registrationId, qrPayload } — never leak other tenants' data
```

### 5.3 `GET/POST /api/forms/[formId]/fields`

- **POST** creates/updates fields (ADMIN + `manage_forms`).
- Validate `form.organizationId === activeOrganizationId`.
- On field change, consider versioning forms for in-flight events (optional `formVersion` on `FormResponse`).

### 5.4 Middleware

Next.js **middleware** can set `x-organization-slug` from subdomain or path. For v1, **path-based** `org/[orgSlug]` + session `activeOrganizationId` is simpler than subdomain SSL.

```typescript
// middleware.ts — minimal
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Optional: redirect /dashboard → /org/default if single-org UX
  return NextResponse.next();
}

export const config = {
  matcher: ["/org/:path*", "/api/orgs/:path*", "/api/events/:path*", "/api/forms/:path*"],
};
```

Pair middleware with **server-side** membership checks; never rely on middleware alone for authorization.

---

## 6. Dynamic form rendering (React + react-hook-form + Zod)

### 6.1 Build Zod from fields

```typescript
// src/lib/forms/build-zod-schema.ts
import { z } from "zod";
import type { FormField, FormFieldType } from "@prisma/client";

export function buildDynamicSchema(fields: FormField[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const f of fields.sort((a, b) => a.order - b.order)) {
    let fieldSchema: z.ZodTypeAny;

    switch (f.type) {
      case "TEXT":
      case "TEXTAREA":
      case "EMAIL":
      case "PHONE":
        fieldSchema = z.string();
        break;
      case "NUMBER":
        fieldSchema = z.coerce.number();
        break;
      case "DATE":
      case "DATETIME":
        fieldSchema = z.string(); // or z.coerce.date()
        break;
      case "CHECKBOX":
        fieldSchema = z.boolean();
        break;
      case "SELECT":
      case "RADIO":
        fieldSchema = z.string();
        break;
      case "MULTI_SELECT":
        fieldSchema = z.array(z.string());
        break;
      case "FILE":
        fieldSchema = z.any(); // or custom file schema
        break;
      default:
        fieldSchema = z.unknown();
    }

    if (!f.required && f.type !== "CHECKBOX") {
      fieldSchema = fieldSchema.optional();
    } else if (!f.required && f.type === "CHECKBOX") {
      fieldSchema = fieldSchema.optional();
    }

    if (f.required) {
      if (f.type === "TEXT" || f.type === "TEXTAREA") {
        fieldSchema = (fieldSchema as z.ZodString).min(1, "Required");
      }
    }

    shape[f.fieldKey] = fieldSchema;
  }

  return z.object(shape);
}
```

Refine with `validation` JSON (min, max, regex) from `FormField.validation`.

### 6.2 Dynamic field component

```tsx
// src/components/forms/DynamicForm.tsx (sketch)
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { FormField } from "@prisma/client";
import { buildDynamicSchema } from "@/lib/forms/build-zod-schema";

type Props = {
  fields: FormField[];
  locale?: string;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
};

export function DynamicForm({ fields, locale = "en", onSubmit }: Props) {
  const schema = buildDynamicSchema(fields);
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: fields.reduce(
      (acc, f) => ({ ...acc, [f.fieldKey]: f.type === "CHECKBOX" ? false : "" }),
      {} as Record<string, unknown>
    ),
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {fields
        .sort((a, b) => a.order - b.order)
        .map((field) => (
          <div key={field.id}>
            <label className="block text-sm font-medium">
              {resolveLabel(field, locale)}
            </label>
            <DynamicFieldInput field={field} control={form.control} name={field.fieldKey} />
          </div>
        ))}
      <button type="submit" className="rounded bg-emerald-600 px-4 py-2 text-white">
        Submit
      </button>
    </form>
  );
}

function resolveLabel(field: FormField, locale: string) {
  const i18n = field.labelI18n as Record<string, string> | null;
  return i18n?.[locale] ?? field.label;
}

// DynamicFieldInput: switch on field.type → Input, Select, RadioGroup, etc.
```

---

## 7. Migration strategy (old → new)

### Phase 0 — Preparation

1. Freeze production schema changes; backup database.
2. Introduce **new tables** alongside existing `Registration` / `Attendee` (additive migration).

### Phase 1 — Organizations and membership

1. Create `Organization`, `OrganizationMember`, `OrganizationInvitation`.
2. Seed one default organization (slug `gcme`) and attach all existing users as OWNER/ADMIN per business rules.
3. Add `organizationId` to `Vendor`, `Group`, `Batch` (nullable first, backfill, then `NOT NULL`).

### Phase 2 — Events and forms

1. Create `Event` (one row mirroring current summit), `Form`, `FormField` rows that replicate current fixed fields (`fullName`, `churchName`, …).
2. Link `Event.registrationFormId` to that form.

### Phase 3 — Dual-write or backfill

1. **Backfill script:** For each `Registration`, create `FormResponse` with `responses` JSON from columns; create `EventRegistration` pointing to it.
2. For each `Attendee`, create `FormResponse` + `EventAttendee` linked to parent `EventRegistration`.
3. Verify counts, ticket numbers, payment statuses match.

### Phase 4 — Cutover

1. Point API routes to new tables; keep read-only legacy tables for rollback window.
2. Update dashboard queries to use `EventRegistration` + `FormResponse`.
3. Remove deprecated columns/tables after validation.

### Phase 5 — Extras

- **Badges:** Template stores field keys (e.g. `{{full_name}}`) resolved from `FormResponse.responses`.
- **Search:** PostgreSQL `JSONB` indexes on `FormResponse.responses` (GIN) for hot keys; or `generated` columns for email/phone.
- **Export:** Stream CSV from `EventRegistration` joined with `FormResponse` for flat rows.
- **QR:** `EventRegistration.qrPayload` = signed JWT or random ULID; check-in endpoint validates org + event.

---

## 8. Extra features (mapping)

| Feature | Approach |
|---------|----------|
| Dynamic badges | HTML/PDF template + mustache-like replacement from `responses` + `EventRegistration.ticketNumber`. |
| Filter/search | `WHERE organizationId = ? AND eventId = ?` + Prisma `JsonFilter` or raw SQL `responses->>'email' ILIKE`. |
| Export | Server route with CSV (later: Excel via `exceljs`). |
| QR check-in | `POST /api/events/[id]/check-in` with `qrPayload`; set `checkedIn` on registration or attendee row. |
| Multi-language | `Form.defaultLocale`, `supportedLocales`, `labelI18n` on fields; pass `locale` into `DynamicForm`. |

---

## 9. Scalability notes

- **Indexes:** All list endpoints need composite indexes on `(organizationId, eventId, createdAt)`.
- **Large JSON:** Cap single response size; for heavy file fields use object storage keys in JSON.
- **Tenancy at scale:** Later, **row-level security** in Postgres or per-tenant DB are options; start with app-level scoping + tests that assert cross-tenant reads fail.

---

## 10. Summary checklist

- [ ] Prisma schema: `Organization`, `OrganizationMember`, `Event`, `Form`, `FormField`, `FormResponse`, `EventRegistration`, `EventAttendee`; scope `Group`, `Vendor`, `Batch`.
- [ ] Session: `activeOrganizationId` + org permissions in `customSession`.
- [ ] APIs: `/api/orgs`, `/api/events`, `/api/forms`, nested `fields` / `responses`, `/api/register`.
- [ ] UI: org switcher, new nav (Events, Forms, Registrations), refactor existing modules under `org/[slug]`.
- [ ] Migration: phased backfill from legacy `Registration`/`Attendee`.

This document is the single reference for the transformation; implement in vertical slices and keep tenant isolation tests in CI from day one.
