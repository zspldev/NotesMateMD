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