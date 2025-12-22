# NotesMate - Feature Roadmap

## Current Version: v1.0 (December 2024)
- HIPAA-compliant medical note-taking
- Audio recording with Deepgram transcription
- Multi-tenant organization support
- Role-based access control (super_admin, org_admin, doctor, staff)
- Patient management with MRN sequences
- Visit tracking and document uploads
- Medical editor with AI auto-formatting (SOAP, H&P, Progress, Procedure notes)
- PDF export with date range selection
- Dual-role support for org_admin + doctor
- Organization-level backup capabilities
- AWS infrastructure (RDS + S3 in Mumbai) for DPDP Act compliance

---

## Planned Features

### v1.1 - PWA Support
- [ ] Progressive Web App capabilities
- [ ] Install on mobile/desktop devices
- [ ] App-like experience without browser UI
- [ ] Faster loading with cached assets
- [ ] Update notifications for new versions
- [ ] Add email IDs and Phone numbers at org-level/employee-level
- [ ] when a dual-role user logs in, show the clinical view
- [ ] Add a founder dashboard showing daily changes
- [ ] Send mass emails to all orgs/doctors
- [ ] Simple help feature
- [ ] Add T&C and Provacy Policy
- [ ] Integrate with a landing page website
- [ ] 

### v1.2 - Future Ideas
- [ ] Offline mode for viewing cached notes
- [ ] Push notifications for visit reminders
- [ ] Voice commands for hands-free operation
- [ ] Template customization per organization
- [ ] Batch audio transcription
- [ ] Integration with EHR systems (Epic, Cerner)
- [ ] Patient portal for viewing notes
- [ ] Appointment scheduling
- [ ] Billing integration
- [ ] Analytics dashboard for org admins

### v2.0 - Advanced Features
- [ ] Real-time collaboration on notes
- [ ] Video visit support
- [ ] AI-powered clinical decision support
- [ ] Multi-language transcription
- [ ] Custom AI models per specialty
- [ ] Mobile native app (iOS/Android)

---

## Completed Features
- [x] AWS RDS migration (December 2024)
- [x] AWS S3 document storage (December 2024)
- [x] Data migration from Neon (December 2024)

---

## How to Use This File
1. Add new ideas under the appropriate version section
2. Move completed features to the "Completed Features" section with date
3. Push to GitHub to keep it synced: `git add . && git commit -m "Update roadmap" && git push`
