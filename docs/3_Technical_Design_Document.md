# TECHNICAL DESIGN DOCUMENT & LOW-LEVEL SPECIFICATIONS (TDD/LLD)
## GCME Event Platform System Implementation Specs

---

## 1. Document Information

| Attribute | Details |
| :--- | :--- |
| **System** | cls-event |
| **Document Type** | Technical Design Document & Low-Level Specifications (TDD/LLD) |
| **Associated Version** | 3.0 |
| **Date of Creation** | June 5, 2026 |

---

## 2. Core Architectural Algorithms

### 2.1 Dynamic Zod Schema Compilation Algorithm

The system converts database configuration records (`FormField[]`) into a runtime-executable validation schema (`ZodObject`). This ensures that submitted registration datasets conform to required types and formats before database writes occur.

```
+------------------+      Iterate & Match Types     +--------------------------+
|  Database Fields | -----------------------------> | Compiled Zod Schema      |
|  (FormField[])   |                                | (z.object({ ... }))      |
+------------------+                                +--------------------------+
  - KEY: "email"                                      - email: z.string().email()
  - TYPE: EMAIL                                       - age: z.coerce.number()
  - REQUIRED: true                                    - notes: z.string().optional()
```

#### Algorithm Steps:
1. Fetch all `FormField` records belonging to the target `Form` (ordered by the `order` column).
2. Initialize an empty dictionary structure `shape: Record<string, z.ZodTypeAny>`.
3. Loop through each field config, switching on `FormField.type`:
   * **TEXT / TEXTAREA:** Map to `z.string()`. If `required` is true, append `.min(1, "Required Field")`.
   * **EMAIL:** Map to `z.string().email("Invalid email address")`.
   * **PHONE:** Map to a regex validator matching valid local country telephone numbers (e.g. `z.string().regex(/^\+251[79]\d{8}$/, "Invalid phone")`).
   * **NUMBER:** Map to `z.coerce.number()`. If minimums or maximums are stored in `FormField.validation` JSON, append `.min(minVal)` or `.max(maxVal)`.
   * **CHECKBOX:** Map to `z.boolean()`.
   * **SELECT / RADIO:** Validate against values in `FormField.options` JSON using `z.string()`.
   * **MULTI_SELECT:** Map to `z.array(z.string())`.
   * **DATE / DATETIME:** Map to ISO string representations or timestamp limits.
4. If a field's `required` property is false, apply `.optional()` to its schema type.
5. Pass the final `shape` dictionary to `z.object(shape)` to compile the validator.

---

### 2.2 Atomic Ticket Range Allocation Algorithm

To prevent race conditions during peak registration periods, the system assigns ticket numbers atomically using database transactions.

```
       User A Thread                           User B Thread
            |                                       |
    Start Transaction                       Start Transaction
            |                                       |
 Query Max Ticket (e.g., 20054)          Query Max Ticket (e.g., 20054)
    [ROW IS LOCKED]                          [WAIT FOR UNLOCK]
            |                                       |
 Increment Ticket (20055)                       .
            |                                       |
  Write Registration                            .
            |                                       |
    Commit & Unlock                                 |
            |                                       |
            +-------------------------------> Read Ticket (20055)
                                                    |
                                             Increment (20056)
                                                    |
                                             Write Registration
                                                    |
                                              Commit & Unlock
```

#### Algorithm Steps:
1. Determine the participant's role from their form response and load the corresponding `Batch` prefix range config.
2. Open a database transaction block (`prisma.$transaction`).
3. Query the maximum existing `ticketNumber` from `EventRegistration` matching the prefix range (e.g., matching `ticketNumber >= prefix` and `ticketNumber < prefix + 10000`). Use a row-locking query mechanism if supported, or fall back to atomic counters.
4. Calculate the next ticket number: `nextNumber = maxExistingTicket ? maxExistingTicket + 1 : prefix`.
5. Write the `EventRegistration` record using the calculated `nextNumber`.
6. Commit the database transaction.

---

### 2.3 On-Site Badge Template Parsing and PDF Compilation

The badge generation engine converts attendee data into printable PDF documents using browser-side layout engines.

```
[Attendee Record] + [HTML Template]
       |
       v
[Dynamic Template Substitution] (Replace {{full_name}}, {{ticketNumber}})
       |
       v
[HTML Canvas Rendering] (via html2canvas)
       |
       v
[PDF Page Compilation] (via jspdf)
       |
       v
[Send to Print Spooler / Trigger Download]
```

#### Process Logic:
1. Retrieve the badge layout template configuration (stored in `Organization.settings`).
2. Scan the template string for standard substitution tags (e.g., `{{full_name}}`, `{{church_name}}`, `{{ticket_number}}`).
3. Query the target `EventRegistration` and its corresponding `FormResponse` values. Substitute the template placeholders with the participant's actual details.
4. Generate check-in QR codes containing the participant's `qrPayload` string using the client-side QR renderer. Embed the output image into the HTML badge template wrapper.
5. Render the styled template inside a hidden container element on the page.
6. Use `html2canvas` to capture the hidden container, converting the output markup into a high-resolution canvas instance.
7. Initialize a new `jsPDF` instance matching the physical dimensions of the badge printer labels (e.g. 100mm x 150mm).
8. Convert the canvas image into a JPEG format byte stream and draw it onto the PDF page using `pdf.addImage()`.
9. Trigger the browser print window, sending the generated document payload directly to the physical printer.
10. Send an API request to `/api/badges/mark-printed` to flag the badge status in the database.

---

### 2.4 Cryptographic Signature Check for Payment Gateway Webhooks

Ensure the validity of incoming payment confirmations by executing cryptographic signature verification on the payload.

#### Process Logic:
1. Receive incoming callback headers and the raw request body from the payment gateway.
2. Read the authentication token prefix and payload signature header (`X-Gateway-Signature`).
3. Retrieve the organization's private endpoint validation key (`PAYMENT_GATEWAY_TOKEN_SUMMIT` variable).
4. Compute the expected hash signature:
   $$\text{ExpectedHash} = \text{HMAC-SHA256}(\text{RawRequestBody}, \text{SecretKey})$$
5. Compare the computed hash against the signature provided in the headers using a constant-time comparison helper (`crypto.timingSafeEqual`) to mitigate timing side-channel attacks.
6. If the signature checks out, proceed with the status update process. If it fails, reject the payload with a 401 Unauthorized status code.

---

## 3. Core API Endpoint Specifications

### 3.1 `POST /api/register`
* **Access Level:** Public access.
* **Payload Structure:**
  ```json
  {
    "eventId": "cuid_event_12345",
    "formId": "cuid_form_12345",
    "isGroup": false,
    "responses": {
      "full_name": "Daniel Tesfaye",
      "phone_number": "+251911223344",
      "church_name": "Bole Full Gospel Church",
      "service_role": "Youth Pastor"
    }
  }
  ```
* **Success Output (200 OK):**
  ```json
  {
    "status": "success",
    "registrationId": "cuid_reg_998877",
    "paymentStatus": "pending",
    "redirectUrl": "https://gateway.example.com/pay/token_12345"
  }
  ```
* **Error Output (400 Bad Request):**
  ```json
  {
    "status": "validation_error",
    "errors": [
      {
        "field": "phone_number",
        "message": "Invalid phone formatting structure"
      }
    ]
  }
  ```

---

### 3.2 `POST /api/check_in_church_summit`
* **Access Level:** Internal staff access (requires `check_in_participants` permission).
* **Payload Structure:**
  ```json
  {
    "qrPayload": "signed_token_payload_string",
    "vendorId": "cuid_vendor_123"
  }
  ```
* **Success Output (200 OK):**
  ```json
  {
    "status": "success",
    "message": "Attendee Daniel Tesfaye checked in successfully",
    "badgeData": {
      "fullName": "Daniel Tesfaye",
      "churchName": "Bole Full Gospel Church",
      "ticketNumber": 20055,
      "vendorName": "Vendor Area A"
    }
  }
  ```
* **Error Output (409 Conflict):**
  ```json
  {
    "status": "already_checked_in",
    "message": "This ticket was checked in on June 5, 2026 at 09:30 AM"
  }
  ```

---

### 3.3 `GET /api/vendors/stats`
* **Access Level:** System administrator access (requires `view_financials` or `manage_vendors` permission).
* **Success Output (200 OK):**
  ```json
  {
    "vendors": [
      {
        "id": "cuid_vendor_1",
        "name": "Vendor A",
        "capacity": 500,
        "assigned": 342,
        "checkedInCount": 210
      },
      {
        "id": "cuid_vendor_2",
        "name": "Vendor B",
        "capacity": 300,
        "assigned": 150,
        "checkedInCount": 98
      }
    ]
  }
  ```

---

### 3.4 `POST /api/admin/invitations`
* **Access Level:** Organization owner access (requires `manage_users` permission).
* **Payload Structure:**
  ```json
  {
    "email": "staff_member@gcmethiopia.org",
    "role": "STAFF",
    "permissions": ["check_in_participants", "view_registrations"]
  }
  ```
* **Success Output (200 OK):**
  ```json
  {
    "status": "success",
    "message": "Invitation successfully sent",
    "invitation": {
      "id": "cuid_invite_456",
      "email": "staff_member@gcmethiopia.org",
      "expiresAt": "2026-06-12T10:00:00.000Z"
    }
  }
  ```
