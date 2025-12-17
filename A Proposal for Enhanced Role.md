# Enhanced Roles System - Proposal (Updated)

## Decisions Made

| Question | Decision |
|----------|----------|
| Super Admin Login | Same login page as all users |
| Staff Role Scope | Basic patient info only (no clinical notes) |
| Billing Role | Not needed - removed from scope |
| Impersonation | Required - Super admins can login as any user |
| Org Admin Count | Multiple org admins allowed per organization |

## Additional Requirements

| Requirement | Details |
|-------------|---------|
| Role Naming | "Provider" renamed to "Doctor" |
| Patient Ownership | Patients belong to Org (not doctor) - any doctor in org can see all patients |
| Login with Org ID | All users specify Org ID at login (5-digit, starting at 1001) |
| MRN per Org | Each org has separate MRN sequence (6-digit numeric only, starting at 100001) |
| Org Shortname | Each org has unique 6-char alphanumeric shortname |

---

## Role Hierarchy (Updated)

```
┌─────────────────────────────────────────────────────────────────┐
│                        SUPER ADMIN                              │
│              (Zapurzaa Systems team)                            │
│                                                                 │
│   Can: See all orgs, create orgs, manage org admins,           │
│        view system analytics, impersonate any user              │
│   Login: No Org ID required (special case)                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  ORG A (1001) │   │  ORG B (1002) │   │  ORG C (1003) │
│  SHORT: CITYH │   │  SHORT: OAKCLC│   │  SHORT: SMTPRC│
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────────────────────────────────────────────────────┐
│                        ORG ADMIN                              │
│              (Can have multiple per org)                      │
│                                                               │
│   Can: Manage employees in their org, view all patients,      │
│        manage org settings, view org reports                  │
└───────────────────────────┬───────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
        ┌───────────────┐       ┌───────────────┐
        │    DOCTOR     │       │    STAFF      │
        │               │       │               │
        │ Doctors,      │       │ Front desk,   │
        │ Nurses, PAs   │       │ Assistants    │
        │               │       │               │
        │ Full clinical │       │ Basic patient │
        │ access to ALL │       │ info only     │
        │ org patients  │       │ (no notes)    │
        └───────────────┘       └───────────────┘
```

---

## Role Permissions Matrix (Updated)

| Permission | Super Admin | Org Admin | Doctor | Staff |
|------------|:-----------:|:---------:|:------:|:-----:|
| **System Level** |
| View all organizations | ✓ | - | - | - |
| Create/edit organizations | ✓ | - | - | - |
| View system analytics | ✓ | - | - | - |
| Impersonate any user | ✓ | - | - | - |
| **Organization Level** |
| Manage employees | ✓ | ✓ | - | - |
| Change org settings | ✓ | ✓ | - | - |
| View org reports | ✓ | ✓ | - | - |
| Export org data | ✓ | ✓ | - | - |
| **Patient Level** |
| Create patients | ✓ | ✓ | ✓ | ✓ |
| View all org patients | ✓ | ✓ | ✓ | ✓ (basic info only) |
| Edit patients | ✓ | ✓ | ✓ | - |
| Delete patients | ✓ | ✓ | - | - |
| **Clinical Level** |
| Create visits | ✓ | ✓ | ✓ | ✓ |
| Record/transcribe notes | ✓ | ✓ | ✓ | - |
| View clinical notes | ✓ | ✓ | ✓ | - |
| Edit notes | ✓ | ✓ | ✓ | - |
| Export PDF | ✓ | ✓ | ✓ | - |

**Key Change**: All doctors in an org can see ALL patients in that org and add notes. Patients belong to the organization, not individual doctors.

---

## Database Schema Changes (Updated)

### Organizations Table (Modified)

```typescript
export const orgs = pgTable("orgs", {
  orgid: uuid("orgid").primaryKey().default(sql`gen_random_uuid()`),
  org_number: integer("org_number").notNull().unique(), // 5-digit, starts at 1001
  org_shortname: varchar("org_shortname", { length: 6 }).notNull().unique(), // 6-char alphanumeric
  org_name: varchar("org_name", { length: 255 }).notNull(),
  org_type: varchar("org_type", { length: 50 }), // hospital, clinic, medical_office
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  mrn_sequence_current: integer("mrn_sequence_current").default(100001), // 6-digit MRN, starts at 100001
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").default(sql`now()`),
});
```

**New Fields:**
- `org_number`: 5-digit identifier for login (1001, 1002, 1003...)
- `org_shortname`: 6-character unique alphanumeric code (e.g., "CITYH1", "OAKCLC")
- `mrn_sequence_current`: Tracks current MRN number for this org (each org starts at 100001)
- `is_active`: For deactivating orgs without deleting

### Employees Table (Modified)

```typescript
export const employees = pgTable("employees", {
  empid: uuid("empid").primaryKey().default(sql`gen_random_uuid()`),
  orgid: uuid("orgid").references(() => orgs.orgid), // NULL for super_admin only
  username: varchar("username", { length: 100 }).notNull().unique(),
  password_hash: text("password_hash").notNull(),
  first_name: varchar("first_name", { length: 100 }).notNull(),
  last_name: varchar("last_name", { length: 100 }).notNull(),
  title: varchar("title", { length: 100 }), // Doctor, Nurse, PA, Receptionist, etc.
  role: varchar("role", { length: 20 }).notNull().default("doctor"), 
  // Values: super_admin, org_admin, doctor, staff
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").default(sql`now()`),
});
```

**Role Values:**
- `super_admin` - Zapurzaa Systems team (orgid = NULL)
- `org_admin` - Organization administrators (can have multiple per org)
- `doctor` - Clinical staff (doctors, nurses, PAs) with full patient access
- `staff` - Non-clinical staff (front desk, assistants) with basic patient info only

### Patients Table (Modified)

```typescript
export const patients = pgTable("patients", {
  patientid: varchar("patientid", { length: 50 }).primaryKey(), // MRN: 6-digit numeric (100001, 100002...)
  orgid: uuid("orgid").references(() => orgs.orgid).notNull(),
  // ... rest unchanged
});
```

**MRN Format**: 6-digit numeric only (no org prefix)
- Each org has its own sequence starting at 100001
- Example for Org A: 100001, 100002, 100003...
- Example for Org B: 100001, 100002, 100003... (same numbers, different org)
- MRN is unique within an org, but not globally unique
- Patient lookup requires both orgid + MRN

---

## Login Flow (Updated)

### Standard User Login (Doctor, Staff, Org Admin)

```
┌─────────────────────────────────────────────────────────────┐
│                    NotesMate MD Login                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Organization ID                                           │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ 1001                                                │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   Username                                                  │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ dr.smith                                            │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   Password                                                  │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ ••••••••                                            │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   [ ] Remember Org ID                                       │
│                                                             │
│              ┌─────────────────────┐                       │
│              │       Login         │                       │
│              └─────────────────────┘                       │
│                                                             │
│   Super Admin? Login without Org ID                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Super Admin Login

- Same page, but Org ID field is left empty (or shows "N/A")
- Backend recognizes super_admin role and bypasses org check
- Link/toggle: "Super Admin? Login without Org ID"

### After Login Redirect

| Role | Redirect To |
|------|-------------|
| Super Admin | Super Admin Dashboard (all orgs view) |
| Org Admin | Org Dashboard with Team tab visible |
| Doctor | Org Dashboard (patient list) |
| Staff | Org Dashboard (limited patient view) |

---

## Super Admin Impersonation Feature

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  Super Admin Dashboard                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Organizations                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ #    │ Short  │ Name           │ Employees │ Action │   │
│  ├──────┼────────┼────────────────┼───────────┼────────┤   │
│  │ 1001 │ CITYH1 │ City Hospital  │    12     │ View ▼ │   │
│  │      │        │                │           │        │   │
│  │      │        │ ┌────────────────────────┐ │        │   │
│  │      │        │ │ View Org Details       │ │        │   │
│  │      │        │ │ View Employees         │ │        │   │
│  │      │        │ │ ─────────────────────  │ │        │   │
│  │      │        │ │ Login as Dr. Smith     │ │        │   │
│  │      │        │ │ Login as Jane Nurse    │ │        │   │
│  │      │        │ │ Login as Admin John    │ │        │   │
│  │      │        │ └────────────────────────┘ │        │   │
│  └──────┴────────┴────────────────────────────┴────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Impersonation Session

When super admin impersonates a user:
1. Session stores `impersonated_by: super_admin_empid`
2. Banner appears at top: "You are logged in as Dr. Smith (City Hospital) - [Return to Super Admin]"
3. All actions are logged with impersonation flag
4. Super admin sees exactly what that user sees
5. Click "Return to Super Admin" to exit impersonation

---

## UI Changes Required (Updated)

### 1. Login Screen (Modified)
- Add "Organization ID" field (5-digit number)
- Add "Remember Org ID" checkbox
- Add "Super Admin? Login without Org ID" link/toggle
- Validate org_number exists before attempting login

### 2. Super Admin Dashboard (New)
```
┌─────────────────────────────────────────────────────────────┐
│  NotesMate MD - Super Admin                       [Logout]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Quick Stats                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ 3 Orgs   │ │ 18 Users │ │ 615 Pts  │ │ 2.1k Notes│      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                             │
│  Organizations                          [+ Add Organization]│
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ID   │ Short  │ Name           │ Type    │ Users   │   │
│  ├──────┼────────┼────────────────┼─────────┼─────────┤   │
│  │ 1001 │ CITYH1 │ City Hospital  │ Hospital│   12    │   │
│  │ 1002 │ OAKCLC │ Oak Clinic     │ Clinic  │    4    │   │
│  │ 1003 │ SMTPRC │ Smith Practice │ Office  │    2    │   │
│  └──────┴────────┴────────────────┴─────────┴─────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. Add Organization Dialog (New - Super Admin)
```
┌─────────────────────────────────────────────────────────────┐
│  Add New Organization                                    X  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Organization ID (auto-generated)                          │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ 1004                                    (read-only) │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   Short Name (6 characters, alphanumeric, unique) *         │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ NEWORG                                              │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   Organization Name *                                       │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ New Medical Center                                  │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   Type                                                      │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ Hospital ▼                                          │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   ── First Org Admin ──                                     │
│                                                             │
│   Admin Username *          Admin First Name *              │
│   ┌─────────────────────┐  ┌─────────────────────┐         │
│   │ admin.neworg        │  │ John                │         │
│   └─────────────────────┘  └─────────────────────┘         │
│                                                             │
│   Admin Last Name *         Temporary Password *            │
│   ┌─────────────────────┐  ┌─────────────────────┐         │
│   │ Administrator       │  │ ••••••••           │         │
│   └─────────────────────┘  └─────────────────────┘         │
│                                                             │
│              ┌─────────┐  ┌─────────────────┐              │
│              │ Cancel  │  │ Create Org      │              │
│              └─────────┘  └─────────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4. Team Management (Org Admin) (New)
```
┌─────────────────────────────────────────────────────────────┐
│  Team Members                             [+ Add Employee]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Name         │ Username  │ Title   │ Role     │ Act │   │
│  ├──────────────┼───────────┼─────────┼──────────┼─────┤   │
│  │ Dr. Smith    │ dr.smith  │ Doctor  │ Doctor   │ ✏️  │   │
│  │ Jane Doe     │ jane.doe  │ Nurse   │ Doctor   │ ✏️  │   │
│  │ John Admin   │ john.adm  │ Manager │ Org Admin│ ✏️  │   │
│  │ Mary Front   │ mary.f    │ Recept. │ Staff    │ ✏️  │   │
│  │ Bob Inactive │ bob.i     │ Doctor  │ Doctor   │ 🔴  │   │
│  └──────────────┴───────────┴─────────┴──────────┴─────┘   │
│                                                             │
│  🔴 = Inactive/Deactivated                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5. Add/Edit Employee Dialog (Org Admin) (New)
```
┌─────────────────────────────────────────────────────────────┐
│  Add New Employee                                        X  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Username *                                                │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ new.employee                                        │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   First Name *              Last Name *                     │
│   ┌─────────────────────┐  ┌─────────────────────┐         │
│   │ New                 │  │ Employee            │         │
│   └─────────────────────┘  └─────────────────────┘         │
│                                                             │
│   Title                     Role *                          │
│   ┌─────────────────────┐  ┌─────────────────────┐         │
│   │ Physician           │  │ Doctor ▼            │         │
│   └─────────────────────┘  │ ┌─────────────────┐ │         │
│                            │ │ Org Admin       │ │         │
│   Temporary Password *     │ │ Doctor          │ │         │
│   ┌─────────────────────┐  │ │ Staff           │ │         │
│   │ ••••••••           │  │ └─────────────────┘ │         │
│   └─────────────────────┘  └─────────────────────┘         │
│                                                             │
│              ┌─────────┐  ┌─────────────────┐              │
│              │ Cancel  │  │ Add Employee    │              │
│              └─────────┘  └─────────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6. Modified Dashboard (Patient View)
- **For Doctors**: Full access to ALL patients in org, can create visits and notes
- **For Staff**: Can see patient list (name, DOB, MRN) but cannot view clinical notes
- **For Org Admin**: Same as Doctor + "Team" tab in navigation

### 7. Navigation Updates

**Super Admin Sidebar:**
```
├── Dashboard (org overview)
├── Organizations
│   ├── All Organizations
│   └── Add New
├── System Reports
└── My Account
```

**Org Admin Sidebar:**
```
├── Dashboard (patients)
├── Team Members
├── Org Settings
└── My Account
```

**Doctor Sidebar:**
```
├── Dashboard (patients)
└── My Account
```

**Staff Sidebar:**
```
├── Dashboard (patients - limited view)
└── My Account
```

---

## MRN Generation Logic (Updated)

### Per-Organization MRN Sequence

```typescript
// When creating a new patient in Org A (orgid = "abc-123"):
1. Get org.mrn_sequence_current (e.g., 100001)
2. Generate MRN: "100001" (6-digit numeric only)
3. Increment org.mrn_sequence_current to 100002
4. Save patient with patientid = "100001", orgid = "abc-123"

// Next patient in same org:
MRN = "100002"

// Patient in different org B (orgid = "def-456"):
MRN = "100001" (each org has its own sequence, same numbers allowed)
```

### Database Sequence Management

```sql
-- Each org tracks its own MRN counter in the org record
-- No global sequence needed

-- When creating patient:
UPDATE orgs 
SET mrn_sequence_current = mrn_sequence_current + 1 
WHERE orgid = :orgid
RETURNING mrn_sequence_current - 1 as new_mrn_number;

-- Result: patientid = new_mrn_number (6-digit string)
```

### Primary Key Consideration

Since MRN is no longer globally unique (same MRN can exist in different orgs), we have two options:

**Option A: Composite Primary Key** (Recommended)
```typescript
export const patients = pgTable("patients", {
  mrn: varchar("mrn", { length: 10 }).notNull(), // 6-digit numeric string
  orgid: uuid("orgid").references(() => orgs.orgid).notNull(),
  // ... other fields
}, (table) => ({
  pk: primaryKey({ columns: [table.orgid, table.mrn] }), // Composite PK
}));
```

**Option B: Separate UUID Primary Key**
```typescript
export const patients = pgTable("patients", {
  patientid: uuid("patientid").primaryKey().default(sql`gen_random_uuid()`),
  mrn: varchar("mrn", { length: 10 }).notNull(), // 6-digit numeric string
  orgid: uuid("orgid").references(() => orgs.orgid).notNull(),
  // ... other fields
}, (table) => ({
  uniqueMrnPerOrg: unique().on(table.orgid, table.mrn), // Unique constraint
}));
```

**Recommendation**: Option B - Keeps a simple UUID primary key for foreign key references while ensuring MRN is unique within each org.

---

## Implementation Phases (Updated)

### Phase 1: Database & Backend (Foundation) - 4-5 hours
1. Modify `orgs` table: add org_number, org_shortname, mrn_sequence_current, is_active
2. Modify `employees` table: add role, is_active columns
3. Create database migration
4. Create org_number sequence (starting at 1001)
5. Update authentication to include role in session
6. Add role-checking middleware for API routes
7. Create super admin account

### Phase 2: Login Flow Update - 2-3 hours
1. Add Org ID field to login form
2. Validate org_number on login
3. Super admin bypass (no org ID required)
4. "Remember Org ID" functionality
5. Role-based redirect after login

### Phase 3: Super Admin UI - 4-5 hours
1. Create Super Admin Dashboard page
2. Organization list with stats
3. Add Organization dialog with first admin creation
4. Edit/Deactivate organization
5. Impersonation feature ("Login as" user)
6. Return from impersonation

### Phase 4: Org Admin UI - 3-4 hours
1. Create Team Management page
2. Add Employee dialog
3. Edit Employee dialog
4. Activate/Deactivate employees
5. Role assignment

### Phase 5: Role-Based Access Control - 2-3 hours
1. Hide/show UI elements based on role
2. Protect API routes by role
3. Staff: hide clinical notes, show basic patient info only
4. Doctor: full access to all org patients
5. Impersonation banner and session handling

### Phase 6: MRN Update - 1-2 hours
1. Update MRN generation to use org_shortname + sequence
2. Update patient creation flow
3. Migrate existing patients (if any) to new format

---

## Estimated Total Effort

| Phase | Estimated Time |
|-------|----------------|
| Phase 1: Database & Backend | 4-5 hours |
| Phase 2: Login Flow Update | 2-3 hours |
| Phase 3: Super Admin UI | 4-5 hours |
| Phase 4: Org Admin UI | 3-4 hours |
| Phase 5: Role-Based Access Control | 2-3 hours |
| Phase 6: MRN Update | 1-2 hours |
| **Total** | **16-22 hours** |

---

## Summary of Key Changes

1. **Roles**: super_admin, org_admin, doctor, staff (no billing role)
2. **Login**: Requires 5-digit Org ID (except super admin)
3. **Org ID**: Auto-generated, starts at 1001
4. **Org Shortname**: User-defined, 6-char alphanumeric, unique
5. **MRN Format**: 6-digit numeric only (e.g., 100001, 100002) - unique per org, not globally
6. **Patient Access**: All doctors in org see ALL patients (org-based, not doctor-based)
7. **Multiple Org Admins**: Allowed per organization
8. **Impersonation**: Super admins can login as any user

---

*Document updated: December 17, 2025*
*Status: Awaiting Final Review*
