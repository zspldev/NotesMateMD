# Enhanced Roles System - Proposal

## Role Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                        SUPER ADMIN                              │
│              (You / Zapurzaa Systems team)                      │
│                                                                 │
│   Can: See all orgs, create orgs, manage org admins,           │
│        view system analytics, impersonate users                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│    ORG A      │   │    ORG B      │   │    ORG C      │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────────────────────────────────────────────────────┐
│                        ORG ADMIN                              │
│                                                               │
│   Can: Manage employees in their org, view all patients,      │
│        manage org settings, view org reports                  │
└───────────────────────────┬───────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   PROVIDER    │   │    STAFF      │   │   BILLING     │
│               │   │               │   │               │
│ Doctors,      │   │ Front desk,   │   │ View billing  │
│ Nurses, PAs   │   │ Assistants    │   │ info only     │
│               │   │               │   │               │
│ Full clinical │   │ View patients │   │ Limited       │
│ access        │   │ Schedule      │   │ patient view  │
└───────────────┘   └───────────────┘   └───────────────┘
```

---

## Role Permissions Matrix

| Permission | Super Admin | Org Admin | Provider | Staff | Billing |
|------------|:-----------:|:---------:|:--------:|:-----:|:-------:|
| **System Level** |
| View all organizations | ✓ | - | - | - | - |
| Create/edit organizations | ✓ | - | - | - | - |
| View system analytics | ✓ | - | - | - | - |
| Impersonate users | ✓ | - | - | - | - |
| **Organization Level** |
| Manage employees | ✓ | ✓ | - | - | - |
| Change org settings | ✓ | ✓ | - | - | - |
| View org reports | ✓ | ✓ | - | - | - |
| Export org data | ✓ | ✓ | - | - | - |
| **Patient Level** |
| Create patients | ✓ | ✓ | ✓ | ✓ | - |
| View all patients | ✓ | ✓ | ✓ | ✓ | Limited |
| Edit patients | ✓ | ✓ | ✓ | - | - |
| Delete patients | ✓ | ✓ | - | - | - |
| **Clinical Level** |
| Create visits | ✓ | ✓ | ✓ | ✓ | - |
| Record/transcribe notes | ✓ | ✓ | ✓ | - | - |
| View clinical notes | ✓ | ✓ | ✓ | - | - |
| Edit notes | ✓ | ✓ | ✓ | - | - |
| Export PDF | ✓ | ✓ | ✓ | - | - |

---

## Database Schema Changes

### Option A: Add `role` column to employees table (Simpler) - RECOMMENDED

```typescript
// Modified employees table
export const employees = pgTable("employees", {
  empid: uuid("empid").primaryKey().default(sql`gen_random_uuid()`),
  orgid: uuid("orgid").references(() => orgs.orgid), // NULL for super_admin
  username: varchar("username", { length: 100 }).notNull().unique(),
  password_hash: text("password_hash").notNull(),
  first_name: varchar("first_name", { length: 100 }).notNull(),
  last_name: varchar("last_name", { length: 100 }).notNull(),
  title: varchar("title", { length: 100 }), // Doctor, Nurse, PA, etc.
  role: varchar("role", { length: 20 }).notNull().default("provider"), 
  // Values: super_admin, org_admin, provider, staff, billing
  is_active: boolean("is_active").default(true), // For deactivating without deleting
  created_at: timestamp("created_at").default(sql`now()`),
});
```

**Super Admin Special Case:**
- `orgid = NULL` indicates a super admin (not tied to any org)
- Or we can use a special system org

### Option B: Separate `super_admins` table (More Isolated)

```typescript
// New super_admins table (completely separate from org employees)
export const superAdmins = pgTable("super_admins", {
  adminid: uuid("adminid").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 100 }).notNull().unique(),
  password_hash: text("password_hash").notNull(),
  first_name: varchar("first_name", { length: 100 }).notNull(),
  last_name: varchar("last_name", { length: 100 }).notNull(),
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").default(sql`now()`),
});
```

**Recommendation: Option A** - Simpler, single login system, easier to maintain.

---

## UI Changes Required

### 1. Login Screen
- No change needed (same login for all)
- After login, redirect based on role:
  - Super Admin → Super Admin Dashboard
  - Others → Org Dashboard (current behavior)

### 2. New: Super Admin Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│  🏥 NotesMate MD - Super Admin                    [Logout]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Organizations Overview                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Org Name        │ Type    │ Employees │ Patients   │   │
│  ├─────────────────┼─────────┼───────────┼────────────┤   │
│  │ City Hospital   │ Hospital│    12     │    450     │   │
│  │ Oak Clinic      │ Clinic  │     4     │    120     │   │
│  │ Smith Practice  │ Office  │     2     │     45     │   │
│  └─────────────────┴─────────┴───────────┴────────────┘   │
│                                                             │
│  [+ Add Organization]                                       │
│                                                             │
│  Quick Stats                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ 3 Orgs   │ │ 18 Users │ │ 615 Pts  │ │ 2.1k Notes│     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. New: Organization Management (Super Admin)
- Create new organizations
- Assign first org admin to each organization
- View/edit organization details
- Deactivate organizations

### 4. New: Employee Management (Org Admin)
```
┌─────────────────────────────────────────────────────────────┐
│  Team Members                              [+ Add Employee] │
├─────────────────────────────────────────────────────────────┤
│  Name           │ Title    │ Role      │ Status │ Actions  │
│  Dr. Smith      │ Doctor   │ Provider  │ Active │ Edit     │
│  Jane Doe       │ Nurse    │ Provider  │ Active │ Edit     │
│  John Admin     │ Manager  │ Org Admin │ Active │ Edit     │
│  Mary Front     │ Recept.  │ Staff     │ Active │ Edit     │
└─────────────────────────────────────────────────────────────┘
```

### 5. Modified: Current Dashboard
- Add sidebar navigation for org admins to access "Team" section
- Show/hide features based on role:
  - **Staff**: Can't access "Record Notes" or see clinical note content
  - **Billing**: Limited patient view (no clinical notes)
  - **Provider**: Full access to their patients (current behavior)
  - **Org Admin**: Full access + team management

### 6. New: Settings Page (Role-based visibility)
- Org Admin sees: Team management, org settings
- Provider sees: Personal settings only
- Staff/Billing sees: Personal settings only

---

## Navigation Structure

### For Super Admin:
```
Sidebar:
├── Dashboard (org overview)
├── Organizations
│   ├── All Organizations
│   └── Add New
├── System Reports
└── My Account
```

### For Org Admin:
```
Sidebar:
├── Dashboard (patients)
├── Team Members
├── Org Settings
└── My Account
```

### For Provider/Staff/Billing:
```
Sidebar:
├── Dashboard (patients)
└── My Account
```

---

## Implementation Phases

### Phase 1: Database & Backend (Foundation)
1. Add `role` and `is_active` columns to employees table
2. Create super admin account (you)
3. Update authentication to include role in session
4. Add role-checking middleware for API routes

### Phase 2: Super Admin UI
1. Create Super Admin Dashboard page
2. Create Organization management (CRUD)
3. Create "first org admin" assignment flow

### Phase 3: Org Admin UI
1. Create Team Management page
2. Add/Edit/Deactivate employees
3. Role assignment UI

### Phase 4: Role-Based Access Control
1. Hide/show UI elements based on role
2. Protect API routes based on role
3. Restrict features per role matrix above

---

## Questions for Decision

Before implementation, please confirm:

1. **Super Admin Isolation**: Should super admins use the same login page as regular users, or a separate `/admin` login?

2. **Staff Role Scope**: Should staff be able to see patient visit history (without clinical notes), or just basic patient info?

3. **Billing Role**: Do you need this role now, or can we add it later?

4. **Impersonation**: Should super admins be able to "login as" any user to troubleshoot issues?

5. **Org Admin Count**: Can an org have multiple org admins, or just one?

---

## Estimated Effort

| Phase | Estimated Time |
|-------|----------------|
| Phase 1: Database & Backend | 3-4 hours |
| Phase 2: Super Admin UI | 4-5 hours |
| Phase 3: Org Admin UI | 3-4 hours |
| Phase 4: Role-Based Access Control | 2-3 hours |
| **Total** | **12-16 hours** |

---

*Document created: December 16, 2025*
*Status: Awaiting Review*
