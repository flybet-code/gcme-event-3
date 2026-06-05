# USER AND ADMINISTRATOR GUIDE
## GCME Event Operations Platform User Manual

---

## 1. Document Information

| Attribute | Details |
| :--- | :--- |
| **System** | cls-event |
| **Document Type** | User and Administrator System Operations Guide |
| **Associated Version** | 3.0 |
| **Date of Creation** | June 5, 2026 |

---

## 2. Platform Administrative Onboarding

To initialize a new regional chapter or church organization on the platform, a Platform Super Admin must complete the onboarding process.

```
+-----------------------------------+
| Super Admin creates Organization  |
|  and defines slug (e.g. "gcme")   |
+-----------------------------------+
                  |
                  v
+-----------------------------------+
| Owner account is created and bound|
| to organization as Org Owner      |
+-----------------------------------+
                  |
                  v
+-----------------------------------+
| Settings, locales, and SMTP variables|
| are initialized in database       |
+-----------------------------------+
```

### Setup Steps:
1. Log in to the platform console using a Super Admin account.
2. Navigate to the **Organizations Control Panel** and click **Create New Organization**.
3. Enter the organization's official name (e.g., *GCME Addis Ababa Chapter*) and assign a unique URL slug (e.g., `gcme-aa`). This slug will be used in all routing paths (e.g., `/org/gcme-aa/*`).
4. Enter the email address of the organization's primary owner. If the user doesn't exist, the system will send an onboarding invitation email to set up their password.
5. Save the configuration to initialize the database tables and set up the default organization preferences.

---

## 3. Configuring Events and Dynamic Registration Forms

Once the organization is active, the primary owner or an authorized administrator can set up events and configure registration questionnaires.

```
       Step 1                      Step 2                      Step 3
+------------------+        +------------------+        +------------------+
| Create Event     | -----> | Build Form       | -----> | Add Custom Fields|
|  - Define dates  |        |  - Define locales|        |  - Map translations|
|  - Set URL slug  |        |  - Set UI style  |        |  - Set validation|
+------------------+        +------------------+        +------------------+
```

### 3.1 Step 1: Create the Event Configuration
1. Open the dashboard and select **Events** from the sidebar menu.
2. Click **Create Event**.
3. Enter the event's name (e.g., *2025 National Leaders Summit*), a clean URL slug (e.g., `leaders-2025`), the start and end dates, and an optional description.
4. Save the event details.

### 3.2 Step 2: Build the Registration Questionnaire
1. Select **Forms** from the navigation menu and click **Create Registration Form**.
2. Associate the form with your newly created event.
3. Select the supported language translations (e.g. *English*, *Amharic*, *Oromo*, *Tigrinya*) to enable translation options for participant-facing fields.

### 3.3 Step 3: Add Custom Input Fields
For each piece of information you want to gather from participants:
1. Click **Add Field to Form**.
2. Select the input type (e.g., *Text*, *Dropdown Select*, *Phone Number*, *File Upload*).
3. Enter the database key identifier (e.g., `church_name`) using lowercase letters and underscores.
4. Provide the localized translations for labels and placeholders across all active languages:
   * **English (Default):** `Church Name`
   * **Amharic (አማርኛ):** `የቤተ ክርስቲያን ስም`
   * **Oromo (Afaan Oromoo):** `Maqaa Waldaa`
   * **Tigrinya (ትግርኛ):** `ስም ቤተ ክርስቲያን`
5. Toggle the **Required Field** switch if the field is mandatory for submission.
6. Click **Save Form Layout**. The registration form is now live and accessible at the public endpoint (e.g., `/org/gcme-aa/leaders-2025/register`).

---

## 4. Team Onboarding and Access Management

Administrators can add staff members and configure access permissions to secure event data.

```
+---------------------------+
|  Admin sends invitation   |
|   with roles & overrides  |
+---------------------------+
              |
              v
+---------------------------+
|  Staff receives email &   |
|  completes registration   |
+---------------------------+
              |
              v
+---------------------------+
| Session loaded with active|
| organization permissions  |
+---------------------------+
```

### Steps to Add Team Members:
1. Open the **User Management** section in the dashboard side panel.
2. Click **Invite Staff Member**.
3. Enter the invitee's email address and assign a base role:
   * **Admin:** For team members who need to manage event details, forms, and financial reports.
   * **Staff:** For operational staff who only need check-in and badge printing capabilities.
4. Adjust individual permission overrides if you want to grant specific access (e.g. allowing a staff member to view financial reports).
5. Click **Send Invitation Link**. The system will send an invitation link to the staff member's email address.
6. Staff members can monitor active invitations and manage access permissions under the **Invitations** and **User Settings** tabs.

---

## 5. Event Launch Checklist

Complete the following configuration steps before opening registrations to the public:

### 5.1 Ticket Number Prefix Batches
Configure prefix batches to categorize ticket numbers and separate registration streams:
1. Select **Batches** from the sidebar menu and click **Create Batch**.
2. Set up ranges for each target registration group:
   * **Students:** Prefix `10000` (tickets will be numbered 10001, 10002, etc.).
   * **Leaders:** Prefix `20000` (tickets will be numbered 20001, 20002, etc.).
   * **Professionals:** Prefix `30000` (tickets will be numbered 30001, 30002, etc.).
   * **Staff:** Prefix `40000` (tickets will be numbered 40001, 40002, etc.).
3. Map target roles to their corresponding batches to automate the ticket assignment process.

### 5.2 Catering Vendor Assignments
Configure vendor limits to distribute attendee traffic across food tables and catering lines:
1. Select **Vendors** from the sidebar menu and click **Add Vendor**.
2. Enter the vendor's name (e.g., *Catering Line A*) and set the maximum capacity limit.
3. Save the vendor configuration. The check-in system will use these parameters to balance traffic at entry gates.

---

## 6. On-Site Check-In Setup

Configure your physical check-in desks to ensure smooth on-site operations:

```
+-----------------------+      Reads Matrix Barcode      +-----------------------+
| Handheld Scanner      | -----------------------------> | Staff Dashboard App   |
| (Keyboard Wedge Mode) |                                | (Blink Indicator Green|
+-----------------------+                                +-----------------------+
                                                                     |
                                                                     v
+-----------------------+      Prints Sticker Layout     +-----------------------+
| Label Thermal Printer | <----------------------------- | Browser Spooler       |
| (100mm x 150mm Label) |                                | (Auto Print Enabled)  |
+-----------------------+                                +-----------------------+
```

### Physical Setup Steps:
1. Connect physical label printers (e.g. Zebra or Brother thermal printers) to check-in laptops using USB or local network connections.
2. Load thermal label sticker stock (standard size: 100mm x 150mm).
3. Access the browser print properties and configure the page scale:
   * Set print orientation to **Portrait**.
   * Set page margins to **None**.
   * Set target layout dimensions to 100mm x 150mm.
4. Connect handheld USB barcode/QR scanners and set them to **Keyboard Wedge Mode** (scanned data will populate active text inputs automatically).
5. Open the dashboard check-in screen, enable the camera input or active keyboard scanner focus, and select the corresponding vendor line assignment.

---

## 7. Troubleshooting and Frequently Asked Questions

#### Q1: The check-in system displays a red warning. What should staff do?
* **Invalid Code Warning:** The ticket data is unrecognized. Verify that the participant is registered in the correct organization and that the ticket code is valid.
* **Duplicate Scan Warning:** This ticket has already checked in. Look up the registration record to see when and where the initial check-in occurred to prevent unauthorized duplicate entries.

#### Q2: A participant paid offline or by bank transfer. How can we approve their registration?
1. Open **All Registrations** and locate the pending record using the search bar.
2. Select the record and click **Edit Registration / Payment**.
3. Enter the transaction reference code, change the status to **Approved**, and click **Save Changes**. The system will update the record and email the confirmation ticket to the participant.

#### Q3: A label printer jammed or printed a corrupted badge. How do we reprint it?
1. Navigate to the **Badges** section in the sidebar menu.
2. Search for the participant's name or ticket number.
3. Click the **Reprint Badge** button to send a fresh print job to the label printer.
