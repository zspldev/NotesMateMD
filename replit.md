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

### Known Technical Considerations
- **Security Enhancement Opportunity**: Currently, the backend accepts orgid from client request body. Future improvement should derive orgid from authenticated session to prevent potential tampering.
- **MRN Sequence Management**: The `mrn_sequence` must exist in all deployment environments. Monitor logs for MRN creation errors to catch misconfigured sequences early.