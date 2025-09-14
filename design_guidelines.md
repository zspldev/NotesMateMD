# NotesMate Design Guidelines

## Design Approach
**Reference-Based Approach**: Drawing inspiration from modern healthcare and productivity applications like Epic MyChart, Notion, and Linear for clean, professional medical interfaces.

## Core Design Elements

### A. Color Palette
**Primary Colors:**
- Light Mode: Medical blue (210 85% 45%) for trust and professionalism
- Dark Mode: Softer medical blue (210 60% 55%) 
- Background: Clean whites (0 0% 98%) and dark grays (220 15% 12%)

**Accent Colors:**
- Success green (145 70% 45%) for completed transcriptions
- Warning amber (45 90% 55%) for pending audio processing
- Error red (0 75% 55%) for system alerts

### B. Typography
**Font Stack:** Inter via Google Fonts CDN
- Headers: 600-700 weight for clear hierarchy
- Body text: 400-500 weight for readability
- Medical data: 500 weight for emphasis
- Sizes: text-sm to text-2xl range for responsive scaling

### C. Layout System
**Spacing Primitives:** Tailwind units of 2, 4, and 8 (p-2, h-8, m-4)
- Consistent 32px (8 units) section spacing
- 16px (4 units) for component internal spacing
- 8px (2 units) for tight element groupings

### D. Component Library

**Navigation:**
- Clean sidebar with medical iconography
- Breadcrumb navigation for patient/visit context
- Search bar prominently placed for patient lookup

**Forms:**
- Large, accessible input fields suitable for clinical environments
- Clear labels with medical terminology
- Grouped fieldsets for patient demographics and visit details

**Audio Components:**
- Prominent record button with visual feedback
- Waveform visualization during recording
- Playback controls with scrubbing capability
- Transcription display with edit capabilities

**Data Displays:**
- Patient cards with essential demographics
- Visit history timeline
- Tabular format for multiple patient management
- Status indicators for transcription progress

**Medical-Specific Elements:**
- Patient banner with critical info (name, MRN, DOB)
- Visit context header (date, purpose)
- Audio note cards with timestamps
- Transcription editor with medical formatting

### E. Professional Medical Aesthetic

**Visual Treatment:**
- Clean, clinical whites and soft grays
- Subtle borders and shadows for depth
- Generous whitespace for focus and clarity
- Medical-appropriate iconography throughout

**Layout Approach:**
- Dashboard-style main interface
- Detail views for patient/visit management
- Modal workflows for critical actions
- Responsive design for various clinical settings

**Key Design Principles:**
1. **Trust & Professionalism** - Medical-grade visual quality
2. **Efficiency** - Quick access to patient data and recording functions
3. **Clarity** - Clear information hierarchy for clinical decision-making
4. **Accessibility** - WCAG compliance for healthcare environments

**Interaction Patterns:**
- Single-click patient selection
- One-tap audio recording start/stop
- Inline editing for transcriptions
- Keyboard shortcuts for power users

This design system ensures NotesMate feels professional, trustworthy, and efficient for healthcare professionals while maintaining modern web application standards.