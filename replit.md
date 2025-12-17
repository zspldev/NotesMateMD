# NotesMate - Medical Audio Notes Application

## Overview
NotesMate is a HIPAA-compliant medical note-taking application for healthcare professionals. It enables audio recording, transcription, and secure management of patient visit notes. The application features a modern UI inspired by Epic MyChart, Notion, and Linear, providing a clean and professional interface tailored for medical workflows. The project aims to streamline clinical documentation, enhance medical record accuracy, and improve the efficiency of healthcare providers.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript (SPA)
- **Build System**: Vite
- **UI Components**: Radix UI primitives with shadcn/ui
- **Styling**: Tailwind CSS with medical-themed color palette
- **State Management**: TanStack Query (server state), local component state (UI)
- **Routing**: Wouter
- **Theme System**: Custom light/dark mode with medical blue color schemes

### Backend
- **Runtime**: Node.js with Express.js REST API
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints (`/api/*`) returning structured JSON
- **File Handling**: Multer for audio uploads (50MB limit, audio MIME validation)
- **Error Handling**: Centralized middleware with structured responses

### Data Storage
- **Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM (type-safe schemas, migrations)
- **Schema Design**: Medical domain modeling (organizations, employees, patients, visits, visit notes)
- **Data Validation**: Zod schemas
- **Storage Strategy**: Interface-based design for production database with in-memory development option

### Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL session store
- **Password Security**: bcrypt hashing
- **Access Control**: Organization-based multi-tenancy with employee role-based access (super_admin, org_admin, doctor, staff)
- **Session Persistence**: Secure HTTP-only cookies
- **Token-Based Auth**: HMAC-signed access tokens for API authorization (24-hour expiration) with role and organization info.
- **Login Flow**: Requires organization code for regular users; super admins can bypass.
- **Super Admin Console**: Dashboard for managing organizations and impersonating organization contexts.

### Key Features
- **Medical Editor**: Supports SOAP Note, H&P, Progress Note, Procedure Note templates.
- **AI Auto-Format**: Integrates OpenAI for reorganizing transcribed text into selected templates.
- **Quick Insert & Abbreviation Expansion**: For common medical phrases and terms.
- **Patient Management**: Create, edit, delete patients; auto-assigned Medical Record Numbers (MRN).
- **PDF Export**: Export clinical notes with date range selection and professional formatting.
- **Audio Playback Fix**: Byte-level audio format detection for cross-platform (especially iOS) compatibility.
- **Audit Trail**: Tracks device, browser, IP address, and user agent for note creation.

### Medical Domain Model
- **Organizations**: Multi-tenant support with unique `org_number` and `org_shortname`.
- **Employees**: Roles (Doctor, Nurse, PA) and organizational association.
- **Patients**: MRN-based identification, demographics.
- **Visits**: Patient encounters with purpose tracking.
- **Visit Notes**: Audio recordings, transcriptions, and editing capabilities.

## External Dependencies
- **Audio Processing**: Browser Web Audio API (MediaRecorder)
- **UI Framework**: Radix UI
- **Form Handling**: React Hook Form with Hookform resolvers
- **Development Tools**: ESBuild, TSX
- **Deployment**: Replit-optimized
- **AI Integration**: Replit AI Integrations (for OpenAI access)