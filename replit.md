# NotesMate - Medical Audio Notes Application

## Overview

NotesMate is a HIPAA-compliant medical note-taking application designed for healthcare professionals. The system enables audio recording, transcription, and management of patient visit notes in a secure healthcare environment. The application follows modern healthcare UI patterns inspired by Epic MyChart, Notion, and Linear, providing a clean and professional interface for medical workflows.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript in a single-page application (SPA) architecture
- **Build System**: Vite for fast development and optimized production builds
- **UI Components**: Radix UI primitives with shadcn/ui component library for accessible, healthcare-grade interfaces
- **Styling**: Tailwind CSS with custom medical-themed color palette and design tokens
- **State Management**: TanStack Query for server state management with local component state for UI interactions
- **Routing**: Wouter for lightweight client-side routing
- **Theme System**: Custom light/dark mode implementation with medical blue color schemes

### Backend Architecture
- **Runtime**: Node.js with Express.js REST API server
- **Language**: TypeScript with ES modules for type safety and modern JavaScript features
- **API Design**: RESTful endpoints following `/api/*` convention with structured JSON responses
- **File Handling**: Multer middleware for audio file uploads with 50MB limit and audio MIME type validation
- **Error Handling**: Centralized error middleware with structured error responses
- **Development**: Hot module replacement via Vite integration in development mode

### Data Storage Solutions
- **Database**: PostgreSQL with Neon serverless driver for scalable cloud deployment
- **ORM**: Drizzle ORM with type-safe schema definitions and migrations
- **Schema Design**: Medical domain modeling with organizations, employees, patients, visits, and visit notes
- **Data Validation**: Zod schemas for runtime type checking and API validation
- **Storage Strategy**: In-memory storage implementation for development with interface-based design for production database switching

### Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL session store (connect-pg-simple)
- **Password Security**: bcrypt for password hashing with salt rounds
- **Access Control**: Organization-based multi-tenancy with employee role-based access
- **Session Persistence**: Secure HTTP-only cookies with configurable expiration

### External Dependencies
- **Audio Processing**: Browser Web Audio API for recording with MediaRecorder interface
- **UI Framework**: Radix UI for accessible component primitives
- **Form Handling**: React Hook Form with Hookform resolvers for validation
- **Development Tools**: ESBuild for server bundling, TSX for TypeScript execution
- **Deployment**: Replit-optimized with runtime error overlay and cartographer integration

### Medical Domain Model
- **Organizations**: Multi-tenant support for hospitals, clinics, and medical offices
- **Employees**: Healthcare professionals with roles (Doctor, Nurse, PA) and organizational association
- **Patients**: Medical record number-based identification with demographics and contact information
- **Visits**: Individual patient encounters with purpose tracking and employee assignment
- **Visit Notes**: Audio recordings with transcription capabilities and edit tracking for clinical documentation

### Security and Compliance Considerations
- **HIPAA Compliance**: Designed for healthcare environments with proper data handling patterns
- **Audit Trail**: Visit and note creation timestamps for compliance tracking
- **Data Isolation**: Organization-based data segregation for multi-tenant security
- **File Security**: Audio file validation and controlled upload mechanisms

## Recent Changes

### November 2025
- **Auto-Incrementing MRN System**: Implemented automatic Medical Record Number generation
  - Created PostgreSQL sequence `mrn_sequence` for sequential MRN generation starting at 1002
  - Backend auto-generates MRN in format `MRN{sequence_number}` (e.g., MRN1002, MRN1003)
  - Implemented type-safe separation between client input (InsertPatient) and storage layer (InsertPatientWithMRN)
  - Removed MRN input field from NewPatientDialog form
  - Added informational message: "Medical Record Number (MRN) will be automatically assigned"
  - Prevents duplicate MRN errors through database-backed sequence generation
  - Sequence-based approach ensures uniqueness even under concurrent patient creation
  - Full end-to-end testing verified sequential MRN assignment (MRN1002, MRN1003)
- **New Patient Functionality**: Implemented complete patient creation workflow
  - Created NewPatientDialog component with comprehensive form validation
  - Integrated dialog into Dashboard with proper state management
  - Added type-safe patient creation with InsertPatient schema
  - Automatic patient list refresh after creation
  - Success/error toast notifications for user feedback
  - **Fixed orgid submission**: Added hidden form field for orgid to ensure proper organization association
  - Updated form reset logic to preserve orgid across multiple patient creations
  - Full end-to-end testing verified (patient creation → selection → visit → notes)
- Successfully migrated from in-memory (MemStorage) to PostgreSQL database persistence
- Implemented DatabaseStorage class with full CRUD operations for all medical entities
- Created comprehensive seed data for testing (organizations, employees, patients, visits)
- Fixed AI badge display logic for visit notes
- Implemented branding update: replaced stethoscope logo with zapurzaa + NotesMateMD text
- Changed entire color scheme from blue to medical teal (#17a2b8)
- Verified three UX improvements:
  1. Transcription text displays on recording screen
  2. AI Generated badges show correctly for AI-transcribed notes
  3. Visit notes sorted newest-first

### December 2025
- **Medical Editor with AI Auto-Format**: Enhanced clinical note editing with intelligent features
  - **Template Selection**: SOAP Note, History & Physical, Progress Note, Procedure Note templates
  - **Auto-Format with AI**: Uses OpenAI (via Replit AI Integrations) to reorganize transcribed text into selected template format
  - **Quick Insert Phrases**: Common medical phrases like "Patient denies...", "No acute distress", "Within normal limits"
  - **Abbreviation Expansion**: Type medical abbreviations (e.g., "htn", "dm2", "sob") and press Tab to expand
  - **Word Count**: Real-time word count display
  - **Source Badges**: Shows whether note is AI-generated or manually entered
  - Files: `server/openai.ts`, `client/src/components/MedicalEditor.tsx`
  - API endpoints: `/api/medical/templates`, `/api/medical/format`, `/api/medical/abbreviations`, `/api/medical/quick-phrases`
- **Patient Management Enhancements**:
  - Edit patient dialog for updating patient information
  - Delete patient with cascade deletion (removes all visits and notes)
  - Confirmation dialog with warning about permanent data deletion
- **PDF Export Feature**: Export patient clinical notes as professional PDF documents
  - Date range selection with quick presets (Today, Last 7 Days, Last 30 Days, This Month, Last Month)
  - Custom date range selection via calendar date pickers
  - Professional medical document layout with organization header, patient information, and chronological notes
  - Includes AI-generated/edited badges, provider information, and audio duration
  - Page numbers and confidential footer on each page
  - Files: `server/pdf-service.ts`, `client/src/components/ExportPDFDialog.tsx`
  - API endpoint: `GET /api/patients/:patientid/notes/export?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

- **iOS Audio Playback Fix**: Resolved critical iOS Safari/Chrome audio playback issue
  - **Root Cause**: iOS MediaRecorder records audio as MP4/AAC but browser incorrectly reports MIME type as 'audio/wav'
  - **Solution**: Implemented byte-level audio format detection that inspects file signatures (ftyp for MP4, RIFF for WAV, etc.)
  - **Result**: Audio now plays correctly on all devices (iPhone, iPad, Android, Desktop)
  - Files: `client/src/components/AudioRecorder.tsx`, `client/src/components/VisitHistory.tsx`
  - Key function: `detectAudioFormat()` - inspects first bytes to determine actual format
  - Additional iOS fixes applied: DOM-appended audio elements, `<source>` tags, `playsinline` attributes

- **Device/Browser Tracking for Visit Notes**: Implemented audit trail tracking for note creation
  - **Database Schema**: Added new columns to visit_notes: `session_id`, `device_type`, `browser_name`, `ip_address`, `user_agent`
  - **Browser Detection**: Created `client/src/lib/deviceInfo.ts` utility that detects device type (Mobile/Tablet/Desktop), browser name+version, and generates session IDs stored in sessionStorage
  - **IP Address Capture**: Server extracts IP from `x-forwarded-for` header or socket remote address
  - **UI Display**: Shows device type icon (smartphone/tablet/monitor) and browser name in visit history (HIPAA-compliant: IP address and session ID stored but NOT displayed in UI to avoid PHI/PII exposure)
  - **Audit Purpose**: Tracking data stored in database for compliance auditing but only non-sensitive fields shown to clinical users
  - Files: `client/src/lib/deviceInfo.ts`, `server/routes.ts`, `client/src/components/VisitHistory.tsx`

- **Logo Branding Update**: Updated opening/login screen
  - Replaced text title with horizontal logo image + wordmark
  - Added "Created by" text with Zapurzaa Systems logo image
  - Responsive sizing for mobile devices

- **Enhanced Roles System (Phase 1 - Database Schema)**: Multi-organization role-based access control foundation
  - **Database Schema Updates**:
    - `orgs` table: Added `org_number` (unique 4-digit ID starting at 1001), `org_shortname` (6-char max), `mrn_sequence_current` (per-org MRN tracking starting at 100001), `is_active` (soft delete support)
    - `employees` table: Added `role` (super_admin/org_admin/doctor/staff), `is_active`, made `orgid` nullable for super_admin
    - `patients` table: Added separate `mrn` field (6-digit numeric extracted from patientid)
  - **Zapurzaa Systems Organization**: Created ZSPL org (org_number 1001) as system org for super admins
  - **Super Admin User**: Created `super.admin` account with role='super_admin' (password: simple123)
  - **Test Organizations**:
    - METMED (1002): Metropolitan Medical Center
    - FAMHLC (1003): Family Health Clinic
  - **Role Definitions** (see `A Proposal for Enhanced Role.md` for full details):
    - `super_admin`: Platform-wide access, org management, impersonation capability
    - `org_admin`: Organization settings, employee management, audit logs
    - `doctor`: Full clinical access, create visits, record notes, view all patients
    - `staff`: Basic patient info only, no clinical note access
  - Files: `shared/schema.ts`, `server/storage.ts`, `A Proposal for Enhanced Role.md`

- **Enhanced Roles System (Phase 2 - Login Flow & Token-Based Authorization)**: Org-based login and API protection
  - **Login Page Updates**:
    - Added Organization Code field (4-digit org_number, e.g., 1002)
    - Super admins can login without org code
    - Regular users require valid org code matching their organization
    - Updated demo credentials display to show org code
  - **Backend Authentication Updates**:
    - Login validates org_code against org_number in database
    - Checks employee.is_active and org.is_active before allowing login
    - Verifies employee belongs to the specified organization
    - Returns role and organization info in login response
  - **Access Token System** (NEW):
    - HMAC-signed access tokens generated on login (server/auth.ts)
    - Token contains: empid, orgid, role, impersonatedOrgId, expiration (24 hours)
    - Frontend stores token in sessionStorage and sends via Authorization header
    - `requireAuth(permission?)` middleware validates tokens and enforces permissions
  - **Protected API Routes**:
    - All patient routes protected with view_patients/manage_patients permissions
    - All visit routes protected with view_notes/create_visits permissions
    - All note routes protected with view_notes/create_notes permissions
    - Orgid derived from token (not client request) to prevent tampering
  - Files: `server/auth.ts`, `server/routes.ts`, `client/src/lib/api.ts`
  - **Security**: Unauthenticated requests return 401, insufficient permissions return 403

### Known Technical Considerations
- **Token-Based Auth**: API routes now use HMAC-signed tokens for authorization. Token secret uses SESSION_SECRET env var (defaults to dev secret if not set - change in production!).
- **MRN Sequence Management**: The `mrn_sequence` must exist in all deployment environments. Monitor logs for MRN creation errors to catch misconfigured sequences early.
- **AI Integration**: Uses Replit AI Integrations for OpenAI access (no separate API key required). Charges are billed to Replit credits.
- **iOS Audio Compatibility**: Uses byte-level format detection because iOS browsers lie about MediaRecorder MIME types. The `detectAudioFormat()` function must be used for all audio playback to ensure cross-platform compatibility.