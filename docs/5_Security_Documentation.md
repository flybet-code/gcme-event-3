# SECURITY & COMPLIANCE SPECIFICATIONS
## GCME Event Operations Platform Secure SDLC Documentation

---

## 1. Document Information

| Attribute | Details |
| :--- | :--- |
| **System** | cls-event |
| **Document Type** | Security Policies, Threat Modeling, and Incident Response Specifications |
| **Associated Version** | 3.0 |
| **Date of Creation** | June 5, 2026 |

---

## 2. Platform Threat Modeling (STRIDE Methodology)

The security model is structured using the STRIDE threat categorization framework, addressing potential vulnerabilities and implementing targeted countermeasures across the system.

```
       Threat Area                     Potential Attack Vector                       System Countermeasure
+-----------------------+      +-------------------------------------+      +-------------------------------------+
| Spoofing Identity     | ---> | Impersonate staff credentials       | ---> | Cryptographic better-auth session   |
+-----------------------+      +-------------------------------------+      +-------------------------------------+
| Tampering Data        | ---> | Forged payment confirmation queries | ---> | HMAC-SHA256 callback verification  |
+-----------------------+      +-------------------------------------+      +-------------------------------------+
| Repudiation           | ---> | Staff denies deleting registration  | ---> | Audit logging and history registers  |
+-----------------------+      +-------------------------------------+      +-------------------------------------+
| Information Disclosure| ---> | Intercepting another tenant's lists | ---> | Database tenant boundary query gates |
+-----------------------+      +-------------------------------------+      +-------------------------------------+
| Denial of Service     | ---> | Brute-forcing registration page API | ---> | Rate-limiting client middleware     |
+-----------------------+      +-------------------------------------+      +-------------------------------------+
| Elevation of Privilege| ---> | User accesses admin panel actions   | ---> | RBAC permission matrix verification |
+-----------------------+      +-------------------------------------+      +-------------------------------------+
```

### 2.1 Spoofing Identity
* **Threat:** Attackers attempting to spoof user identities to access staff and admin panels.
* **Mitigation:**
  * Implement authentication using `better-auth` with cryptographically signed cookies and tokens.
  * Store sessions in database tables to allow instant token revocation.
  * Enable CSRF token checks and configure cookie attributes (`HttpOnly`, `Secure`, `SameSite=Lax`).

### 2.2 Tampering Data
* **Threat:** Attackers intercepting and altering payment callback requests to change registration statuses without processing actual payments.
* **Mitigation:**
  * Validate payment gateway callback signatures using private API tokens.
  * Compute expected payloads using HMAC-SHA256 signature verifications.
  * Query payment statuses from the gateway directly via backend API calls rather than relying solely on user-submitted parameters.

### 2.3 Repudiation
* **Threat:** Users performing administrative actions (e.g. deleting registrations or altering batch allocations) and claiming they did not execute the commands.
* **Mitigation:**
  * Log operations affecting user records, payment updates, and structural configurations in audit-ready database tables.
  * Log mass email dispatches in the `OrganizationEmailSent` table, tracking sender identities, recipient counts, and timestamps.
  * Store creator and modifier IDs directly on database rows (e.g., `submittedByUserId` on form responses).

### 2.4 Information Disclosure
* **Threat:** Users from one organization accessing registrant data, event settings, or financial reports belonging to another tenant.
* **Mitigation:**
  * Enforce strict tenant database separation. API endpoints must query data using parameters verified against the user's active session (`activeOrganizationId`), rather than trusting input parameters directly:
    ```typescript
    // Secure query pattern
    const registrations = await prisma.eventRegistration.findMany({
      where: {
        organizationId: session.activeOrgId, // Scoped from active session
        eventId: targetEventId
      }
    });
    ```
  * Verify user permissions at the application gateway layer before loading resources.

### 2.5 Denial of Service (DoS)
* **Threat:** Attackers flooding public endpoints (e.g., `/api/register` or password reset requests) to exhaust server resources.
* **Mitigation:**
  * Apply rate-limiting middleware (`src/lib/rate-limit.ts`) to public endpoints, limiting request rates based on client IP addresses.
  * Set database connection pool limits to prevent connection exhaustion.
  * Configure front-end load balancers to filter out malicious traffic patterns.

### 2.6 Elevation of Privilege
* **Threat:** Standard staff accounts calling restricted administrative APIs to alter roles or change user settings.
* **Mitigation:**
  * Validate roles at the route handler level using the `OrganizationMember` permission list.
  * Verify permissions server-side on every request rather than relying on frontend view toggles.

---

## 3. Secure Development Policies and Guidelines

Developers must adhere to the secure coding guidelines detailed below to maintain system integrity:

### 3.1 Input Validation and Sanitization
* Validate user inputs using typed validation schemas (`ZodObject`) before processing data.
* Sanitize HTML characters in inputs before rendering them in the browser to prevent Cross-Site Scripting (XSS) attacks.

### 3.2 Database Security
* Use parameterized queries (such as those generated by Prisma Client ORM) to prevent SQL injection vulnerabilities.
* Avoid raw SQL queries unless absolutely necessary. Raw queries must use parameter inputs (e.g., `prisma.$queryRaw` with typed inputs).

### 3.3 Cryptographic Key Management
* Never commit secrets, database connection strings, or API tokens to the code repository.
* Load credentials dynamically using server environment variables (`.env`).
* Store environment files securely on production nodes, restricting read permissions to system operators.

---

## 4. Incident Response Plan

In the event of a security breach or data compromise, the operations team will execute the response plan below:

```
[Phase 1: Identification] ---> [Phase 2: Containment] ---> [Phase 3: Eradication]
                                                                  |
                                                                  v
[Phase 5: Review]        <--- [Phase 4: Recovery]    <--- [Post-Incident Patching]
```

### 4.1 Phase 1: Identification
* **Trigger:** An anomaly is detected (e.g., high rate of failed logins, unauthorized database access, or cross-tenant query errors).
* **Actions:**
  * Isolate database and application logs to analyze request histories.
  * Identify affected user accounts, organizations, and database rows.
  * Document the attack vector and security vulnerabilities.

### 4.2 Phase 2: Containment
* **Trigger:** A breach is verified.
* **Actions:**
  * Temporarily suspend compromised credentials and disable affected staff profiles.
  * Revoke session cookies globally by clearing the `Session` database table.
  * Apply temporary IP blocks at the network firewall layer if the attack is ongoing.

### 4.3 Phase 3: Eradication
* **Trigger:** The attack is contained.
* **Actions:**
  * Identify and resolve the underlying code vulnerability or configuration error.
  * Test and deploy the security patch to the staging environment.
  * Audit database tables to identify and correct any corrupted or unauthorized data modifications.

### 4.4 Phase 4: Recovery
* **Trigger:** The patch is verified and deployed.
* **Actions:**
  * Restore database tables from clean backup snapshots if data was corrupted.
  * Force password resets for affected user accounts on their next login attempt.
  * Monitor application performance and access logs closely for recurring attack patterns.

### 4.5 Phase 5: Post-Incident Review
* **Actions:**
  * Document the root cause, containment timelines, and resolution details.
  * Update the threat modeling guide and secure coding guidelines to prevent similar incidents.
  * Share findings with project stakeholders to improve overall system security.
