# Enhanced Roles System - Proposal (Updated)

## Decisions Made

| Question | Decision |
|----------|----------|
| Super Admin Login | Same login page as all users |
| Staff Role Scope | Basic patient info only (no clinical notes) |
| Billing Role | Not needed - removed from scope |
| Impersonation | Required - Super admins can login as any user |
| Org Admin Count | Multiple org admins allowed per organization |
| **Dual Roles** | **Option A: Role switching within single account** |

## Additional Requirements

| Requirement | Details |
|-------------|---------|
| Role Naming | "Provider" renamed to "Doctor" |
| Patient Ownership | Patients belong to Org (not doctor) - any doctor in org can see all patients |
| Login with Org ID | All users specify Org ID at login (5-digit, starting at 1001) |
| MRN per Org | Each org has separate MRN sequence (6-digit numeric only, starting at 100001) |
| Org Shortname | Each org has unique 6-char alphanumeric shortname |
| **Org Backup** | **Org admins can export full organization data backup** |

---

## Role Clarity & Differentiation

### Key Principle
**Administrative roles and clinical roles are SEPARATE concerns.**

An org_admin is NOT automatically a doctor. They manage the organization but cannot see patient charts or record notes by default.

If someone needs BOTH administrative AND clinical access, they get a **dual role** with the ability to switch between views.

---

## Role Definitions & Permissions

### 1. Super Admin (Platform Level)
- **Purpose**: Manage the entire NotesMate platform
- **Home Screen**: Super Admin Console
- **Can do**:
  - Create/edit/deactivate organizations
  - View platform-wide statistics
  - Impersonate into any organization
  - View all organizations and their stats
- **Cannot do**: Clinical work (no patients, visits, notes)

### 2. Org Admin (Organization Administrative)
- **Purpose**: Manage their organization's operations and team
- **Home Screen**: Organization Admin Dashboard (NOT clinical dashboard)
- **Can do**:
  - Manage employees (add/edit/deactivate doctors, staff)
  - Edit organization profile (name, address, phone)
  - View organization statistics (patient counts, visit counts, employee counts)
  - View audit logs / compliance reports
  - Export organization data backup
  - Reset employee passwords
- **Cannot do**: Clinical work by default (no patient charts, no recording notes)
- **Exception**: If also has doctor role, can switch to clinical view

### 3. Doctor (Clinical Role)
- **Purpose**: Provide patient care and documentation
- **Home Screen**: Clinical Dashboard (patients/visits/notes)
- **Can do**:
  - View/add/edit patients
  - Create visits
  - Record audio notes, transcribe, edit notes
  - Export patient records (PDF)
  - View all patients in their organization
- **Cannot do**: Manage employees, org settings, or org-level exports

### 4. Staff (Support Role)
- **Purpose**: Administrative support for clinical operations
- **Home Screen**: Limited Clinical Dashboard
- **Can do**:
  - View patients (basic info: name, DOB, contact)
  - Create/schedule visits
  - View visit list (but not note contents)
- **Cannot do**: Record notes, view clinical notes, manage employees, org settings

---

## Dual Role System (Option A: Role Switching)

### When Someone Needs Both Roles

A practice owner or manager who is ALSO a practicing physician needs:
- **Org Admin role**: To manage employees and org settings
- **Doctor role**: To see patients and record notes

### Implementation

1. **Database**: Employee record stores multiple roles
   ```
   roles: ["org_admin", "doctor"]  // Array of roles
   ```

2. **Login**: User authenticates normally

3. **After Login**: 
   - System checks if user has multiple roles
   - If single role: Go directly to appropriate dashboard
   - If multiple roles: Show role selector OR default to primary role

4. **Role Switching UI**:
   - Header shows current active role: "Admin View" or "Clinical View"
   - Toggle/dropdown to switch between available roles
   - Example: "Switch to Clinical View" / "Switch to Admin View"

5. **Audit Trail**:
   - All actions logged with active role at time of action
   - Clear record of which "hat" user was wearing

### Role Switching Flow

```
┌─────────────────────────────────────────────────────────────┐
│  NotesMate MD           [Dr. Vinita] Admin View ▼  [Logout] │
│                         ┌────────────────────────┐          │
│                         │ ✓ Admin View           │          │
│                         │   Clinical View        │          │
│                         └────────────────────────┘          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Organization Admin Dashboard                               │
│  (Employee management, org settings, reports)               │
│                                                             │
└─────────────────────────────────────────────────────────────┘

         ↓ Clicks "Clinical View" ↓

┌─────────────────────────────────────────────────────────────┐
│  NotesMate MD        [Dr. Vinita] Clinical View ▼  [Logout] │
│                         ┌────────────────────────┐          │
│                         │   Admin View           │          │
│                         │ ✓ Clinical View        │          │
│                         └────────────────────────┘          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Clinical Dashboard                                         │
│  (Patients, visits, notes, recordings)                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Updated Role Permissions Matrix

| Permission | Super Admin | Org Admin | Doctor | Staff |
|------------|:-----------:|:---------:|:------:|:-----:|
| **System Level** |
| View all organizations | ✓ | - | - | - |
| Create/edit organizations | ✓ | - | - | - |
| View platform analytics | ✓ | - | - | - |
| Impersonate into org | ✓ | - | - | - |
| **Organization Level** |
| Manage employees | ✓ | ✓ | - | - |
| Change org settings | ✓ | ✓ | - | - |
| View org reports/stats | ✓ | ✓ | - | - |
| Export org backup | ✓ | ✓ | - | - |
| **Patient Level** |
| Create patients | - | - | ✓ | ✓ |
| View patient list | - | - | ✓ | ✓ (basic info) |
| Edit patient details | - | - | ✓ | - |
| Delete patients | - | - | ✓ | - |
| **Clinical Level** |
| Create visits | - | - | ✓ | ✓ |
| Record/transcribe notes | - | - | ✓ | - |
| View clinical notes | - | - | ✓ | - |
| Edit notes | - | - | ✓ | - |
| Export patient PDF | - | - | ✓ | - |

**Note**: Org Admin CANNOT do clinical work unless they ALSO have the Doctor role (dual role).

---

## Organization Backup Feature

### Purpose
Allow org admins to export a complete backup of their organization's data for:
- Compliance/record-keeping
- Migration to another system
- Disaster recovery
- Legal/audit requirements

### What's Included in Backup

1. **Organization Info**
   - Org name, type, address, phone
   - Settings and configuration

2. **Employee List**
   - Names, titles, roles (no passwords)
   - Active/inactive status

3. **Patient Records**
   - Demographics
   - MRN assignments

4. **Visit History**
   - All visits with dates, purposes
   - Provider assignments

5. **Clinical Notes**
   - All transcriptions
   - Edit history
   - Timestamps
   - (Audio files optional - large)

### Backup Format Options
- **JSON**: Complete structured data
- **CSV**: Spreadsheet-compatible tables
- **ZIP**: All files bundled together

### Security Considerations
- Backup contains PHI - must be encrypted
- Audit log entry when backup is created
- Consider password-protecting the download
- Rate limit backup requests (e.g., 1 per day)

### Backup UI (Org Admin Dashboard)

```
┌─────────────────────────────────────────────────────────────┐
│  Organization Settings                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Data Backup                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Export your organization's data for backup or       │   │
│  │ compliance purposes.                                 │   │
│  │                                                      │   │
│  │ Include:                                             │   │
│  │ [✓] Patient Records                                  │   │
│  │ [✓] Visit History                                    │   │
│  │ [✓] Clinical Notes                                   │   │
│  │ [ ] Audio Files (large download)                     │   │
│  │                                                      │   │
│  │ Format: [JSON ▼]                                     │   │
│  │                                                      │   │
│  │ [ Download Backup ]                                  │   │
│  │                                                      │   │
│  │ Last backup: December 15, 2024 at 3:42 PM           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema Updates

### Employees Table (Updated for Dual Roles)

```typescript
export const employees = pgTable("employees", {
  empid: uuid("empid").primaryKey().default(sql`gen_random_uuid()`),
  orgid: uuid("orgid").references(() => orgs.orgid),
  username: varchar("username", { length: 100 }).notNull().unique(),
  password_hash: text("password_hash").notNull(),
  first_name: varchar("first_name", { length: 100 }).notNull(),
  last_name: varchar("last_name", { length: 100 }).notNull(),
  title: varchar("title", { length: 100 }),
  
  // UPDATED: Support multiple roles
  role: varchar("role", { length: 20 }).notNull().default("doctor"), // Primary role
  secondary_role: varchar("secondary_role", { length: 20 }), // Optional second role
  
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").default(sql`now()`),
});
```

**Alternative**: Use array for roles
```typescript
roles: text("roles").array().notNull().default(["doctor"]),
```

---

## Post-Login Flow (Updated)

```
User logs in
    │
    ▼
Check user roles
    │
    ├── Single role only ──────────────────────────────┐
    │                                                   │
    │   super_admin → Super Admin Console              │
    │   org_admin   → Org Admin Dashboard              │
    │   doctor      → Clinical Dashboard               │
    │   staff       → Limited Clinical Dashboard       │
    │                                                   │
    ├── Multiple roles (e.g., org_admin + doctor) ─────┤
    │                                                   │
    │   Default to primary role (org_admin)            │
    │   Show role switcher in header                   │
    │   User can toggle to secondary role              │
    │                                                   │
    └───────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase A: Role Separation
1. Create Org Admin Dashboard (separate from Clinical Dashboard)
2. Update post-login routing based on role
3. Remove clinical features from org_admin permissions

### Phase B: Dual Role Support
1. Add secondary_role field to employees table
2. Implement role switcher UI in header
3. Update session/token to track active role
4. Route to appropriate dashboard based on active role

### Phase C: Org Backup Feature
1. Create backup API endpoint
2. Build backup UI in Org Admin Dashboard
3. Implement JSON/CSV export logic
4. Add audit logging for backup actions

### Phase D: Employee Management
1. Create employee list view for org admins
2. Add/Edit employee dialogs
3. Password reset functionality
4. Deactivate/reactivate employees

---

## Summary of Key Changes

| Before | After |
|--------|-------|
| Org admin sees clinical dashboard | Org admin sees admin dashboard only |
| Single role per user | Support for dual roles with switching |
| No org data export | Full org backup feature for admins |
| Admin can record notes | Admin cannot record notes (unless also doctor) |
| Role determines single view | Active role determines current view |
