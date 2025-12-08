import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertEmployeeSchema,
  insertPatientSchema,
  insertVisitSchema,
  insertVisitNoteSchema,
  type InsertPatientWithMRN
} from "@shared/schema";
import multer from "multer";
import { transcriptionService, type TranscriptionResult, type TranscriptionError } from "./transcription";
import { 
  formatTranscriptionToTemplate, 
  getEmptyTemplate, 
  NOTE_TEMPLATES, 
  MEDICAL_ABBREVIATIONS, 
  QUICK_INSERT_PHRASES,
  type NoteTemplate 
} from "./openai";
import { generatePatientNotesPDF, generatePatientNotesFilename } from "./pdf-service";
import { db } from "./db";
import { sql } from "drizzle-orm";

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for audio files
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

// Helper function to detect database connection errors
function isDatabaseConnectionError(error: any): boolean {
  const errorMessage = error?.message?.toLowerCase() || '';
  return (
    errorMessage.includes('endpoint') ||
    errorMessage.includes('disabled') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('neon') ||
    error?.code === 'ECONNREFUSED'
  );
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      // Try a simple database query
      await db.execute(sql`SELECT 1`);
      res.json({ status: "healthy", database: "connected" });
    } catch (error: any) {
      console.error('Health check failed:', error);
      res.status(503).json({ 
        status: "unhealthy", 
        database: "disconnected",
        message: "Database is temporarily unavailable. Please try again in a moment."
      });
    }
  });

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const employee = await storage.authenticateEmployee(username, password);
      if (!employee) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Get organization info
      const org = await storage.getOrg(employee.orgid);
      
      // Return employee info without password hash
      const { password_hash, ...employeeData } = employee;
      res.json({
        employee: employeeData,
        organization: org
      });
    } catch (error: any) {
      console.error('Login error:', error);
      if (isDatabaseConnectionError(error)) {
        res.status(503).json({ error: "Database is temporarily unavailable. Please try again in a moment." });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // Organization routes
  app.get("/api/organizations", async (req, res) => {
    try {
      const orgs = await storage.getOrgs();
      res.json(orgs);
    } catch (error) {
      console.error('Get organizations error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/organizations/:orgid", async (req, res) => {
    try {
      const { orgid } = req.params;
      const org = await storage.getOrg(orgid);
      
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      res.json(org);
    } catch (error) {
      console.error('Get organization error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Patient routes
  app.get("/api/patients", async (req, res) => {
    try {
      const { orgid, search } = req.query;
      
      if (!orgid) {
        return res.status(400).json({ error: "Organization ID is required" });
      }

      let patients;
      if (search && typeof search === 'string') {
        patients = await storage.searchPatients(orgid as string, search);
      } else {
        patients = await storage.getPatients(orgid as string);
      }

      // Add last visit date for each patient
      const patientsWithVisits = await Promise.all(
        patients.map(async (patient) => {
          const visits = await storage.getVisits(patient.patientid);
          const lastVisit = visits.length > 0 ? visits[0].visit_date : null;
          return { ...patient, lastVisit };
        })
      );

      res.json(patientsWithVisits);
    } catch (error) {
      console.error('Get patients error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/patients/:patientid", async (req, res) => {
    try {
      const { patientid } = req.params;
      const patient = await storage.getPatient(patientid);
      
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      
      res.json(patient);
    } catch (error) {
      console.error('Get patient error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/patients", async (req, res) => {
    try {
      const validatedData = insertPatientSchema.parse(req.body);
      
      // Auto-generate MRN using database sequence
      const result = await db.execute(sql`SELECT nextval('mrn_sequence')`);
      const mrnNumber = result.rows[0].nextval;
      const patientid = `MRN${mrnNumber}`;
      
      // Create patient with auto-generated MRN
      const patientWithMRN: InsertPatientWithMRN = {
        patientid,
        ...validatedData,
      };
      
      const patient = await storage.createPatient(patientWithMRN);
      
      res.status(201).json(patient);
    } catch (error) {
      console.error('Create patient error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid patient data" });
    }
  });

  app.put("/api/patients/:patientid", async (req, res) => {
    try {
      const { patientid } = req.params;
      const updates = insertPatientSchema.partial().parse(req.body);
      
      const updatedPatient = await storage.updatePatient(patientid, updates);
      if (!updatedPatient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      
      res.json(updatedPatient);
    } catch (error) {
      console.error('Update patient error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid patient data" });
    }
  });

  app.delete("/api/patients/:patientid", async (req, res) => {
    try {
      const { patientid } = req.params;
      
      // Check if patient exists first
      const patient = await storage.getPatient(patientid);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      
      // Delete patient and all associated records (visits, notes)
      const deleted = await storage.deletePatient(patientid);
      if (!deleted) {
        return res.status(500).json({ error: "Failed to delete patient" });
      }
      
      res.json({ success: true, message: "Patient and all associated records deleted successfully" });
    } catch (error) {
      console.error('Delete patient error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PDF Export route
  app.get("/api/patients/:patientid/notes/export", async (req, res) => {
    try {
      const { patientid } = req.params;
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "Start date and end date are required" });
      }
      
      const data = await storage.getPatientNotesByDateRange(
        patientid, 
        startDate as string, 
        endDate as string
      );
      
      if (!data) {
        return res.status(404).json({ error: "Patient not found" });
      }
      
      const filename = generatePatientNotesFilename(patientid, startDate as string, endDate as string);
      
      // Generate PDF
      const doc = generatePatientNotesPDF({
        ...data,
        startDate: startDate as string,
        endDate: endDate as string
      });
      
      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Pipe PDF to response
      doc.pipe(res);
      doc.end();
    } catch (error) {
      console.error('PDF export error:', error);
      res.status(500).json({ error: "Failed to generate PDF export" });
    }
  });

  // Visit routes
  app.get("/api/patients/:patientid/visits", async (req, res) => {
    try {
      const { patientid } = req.params;
      
      // Check if patient exists
      const patient = await storage.getPatient(patientid);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const visits = await storage.getVisits(patientid);
      
      // Get employee info and visit notes for each visit
      const visitsWithDetails = await Promise.all(
        visits.map(async (visit) => {
          const employee = await storage.getEmployee(visit.empid);
          const notes = await storage.getVisitNotes(visit.visitid);
          
          return {
            ...visit,
            employeeName: employee ? `${employee.first_name} ${employee.last_name}` : 'Unknown',
            employeeTitle: employee?.title || 'Unknown',
            notes
          };
        })
      );

      res.json(visitsWithDetails);
    } catch (error) {
      console.error('Get visits error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/visits/:visitid", async (req, res) => {
    try {
      const { visitid } = req.params;
      const visit = await storage.getVisit(visitid);
      
      if (!visit) {
        return res.status(404).json({ error: "Visit not found" });
      }
      
      // Get additional details
      const employee = await storage.getEmployee(visit.empid);
      const patient = await storage.getPatient(visit.patientid);
      const notes = await storage.getVisitNotes(visitid);
      
      res.json({
        ...visit,
        employee,
        patient,
        notes
      });
    } catch (error) {
      console.error('Get visit error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/visits", async (req, res) => {
    try {
      const validatedData = insertVisitSchema.parse(req.body);
      const visit = await storage.createVisit(validatedData);
      res.status(201).json(visit);
    } catch (error) {
      console.error('Create visit error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid visit data" });
    }
  });

  // Visit Notes routes
  app.get("/api/visits/:visitid/notes", async (req, res) => {
    try {
      const { visitid } = req.params;
      const notes = await storage.getVisitNotes(visitid);
      res.json(notes);
    } catch (error) {
      console.error('Get visit notes error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/notes/:noteid", async (req, res) => {
    try {
      const { noteid } = req.params;
      const note = await storage.getVisitNote(noteid);
      
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      
      res.json(note);
    } catch (error) {
      console.error('Get note error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/notes", upload.single('audio'), async (req, res) => {
    try {
      // Check if manual transcription was provided (must be non-empty after trimming)
      const rawTranscription = req.body.transcription_text;
      const trimmedTranscription = rawTranscription?.trim() || '';
      const hasManualTranscription = trimmedTranscription.length > 0;
      
      const noteData: any = {
        visitid: req.body.visitid,
        transcription_text: hasManualTranscription ? trimmedTranscription : null,
        is_transcription_edited: hasManualTranscription // Mark as edited if manually provided
      };
      
      console.log('POST /api/notes received:', {
        hasAudio: !!req.file,
        audioSize: req.file?.buffer?.length || 0,
        audioMimeType: req.file?.mimetype || 'none',
        rawTranscription: rawTranscription ? `"${rawTranscription.substring(0, 50)}..."` : 'undefined',
        hasManualTranscription: hasManualTranscription,
        transcriptionLength: noteData.transcription_text?.length || 0
      });

      // Handle audio file if provided
      if (req.file) {
        noteData.audio_file = req.file.buffer.toString('base64');
        noteData.audio_filename = req.file.originalname;
        noteData.audio_mimetype = req.body.audio_mimetype || req.file.mimetype || 'audio/wav';
        noteData.audio_duration_seconds = parseInt(req.body.audio_duration_seconds) || null;

        // Automatically transcribe audio using Deepgram if no manual transcription provided AND audio has content
        const shouldTranscribe = !noteData.transcription_text && req.file.buffer && req.file.buffer.length > 1000;
        console.log('Transcription check:', {
          hasTranscriptionText: !!noteData.transcription_text,
          hasBuffer: !!req.file.buffer,
          bufferLength: req.file.buffer?.length || 0,
          shouldTranscribe: shouldTranscribe
        });

        if (shouldTranscribe) {
          console.log('Starting Deepgram transcription for audio file:', noteData.audio_filename, 'size:', req.file.buffer.length, 'bytes');
          
          try {
            const transcriptionResult = await transcriptionService.transcribeAudio(
              req.file.buffer,
              req.file.mimetype
            );

            if ('error' in transcriptionResult) {
              console.error('Deepgram transcription failed:', transcriptionResult.error, transcriptionResult.details);
              // Continue without transcription rather than failing the entire request
              noteData.transcription_text = `[Transcription failed: ${transcriptionResult.error}]`;
            } else {
              noteData.transcription_text = transcriptionResult.text;
              noteData.is_transcription_edited = false; // Auto-generated, not manually edited
              noteData.ai_transcribed = true; // Mark that AI transcription was used
              console.log(`Deepgram transcription completed: ${transcriptionResult.text.length} characters, confidence: ${transcriptionResult.confidence}`);
            }
          } catch (transcriptionError) {
            console.error('Deepgram service error:', transcriptionError);
            noteData.transcription_text = '[Automatic transcription unavailable]';
          }
        } else if (!noteData.transcription_text) {
          console.log('Skipping transcription - audio buffer too small or empty');
        }
      }

      const validatedData = insertVisitNoteSchema.parse(noteData);
      const note = await storage.createVisitNote(validatedData);
      
      console.log('Note created and returning:', {
        noteid: note.noteid,
        ai_transcribed: note.ai_transcribed,
        is_transcription_edited: note.is_transcription_edited,
        transcriptionLength: note.transcription_text?.length || 0
      });
      
      res.status(201).json(note);
    } catch (error) {
      console.error('Create note error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid note data" });
    }
  });

  app.put("/api/notes/:noteid", async (req, res) => {
    try {
      const { noteid } = req.params;
      const updates = insertVisitNoteSchema.partial().parse(req.body);
      
      const updatedNote = await storage.updateVisitNote(noteid, updates);
      if (!updatedNote) {
        return res.status(404).json({ error: "Note not found" });
      }
      
      res.json(updatedNote);
    } catch (error) {
      console.error('Update note error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid note data" });
    }
  });

  // Audio file download route
  app.get("/api/notes/:noteid/audio", async (req, res) => {
    try {
      const { noteid } = req.params;
      const note = await storage.getVisitNote(noteid);
      
      if (!note || !note.audio_file) {
        return res.status(404).json({ error: "Audio file not found" });
      }

      const audioBuffer = Buffer.from(note.audio_file, 'base64');
      const filename = note.audio_filename || `audio_${noteid}.wav`;
      const mimeType = note.audio_mimetype || 'audio/wav';
      
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(audioBuffer);
    } catch (error) {
      console.error('Download audio error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Transcription-only endpoint (doesn't save to database)
  app.post("/api/transcribe", upload.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }

      if (req.file.buffer.length < 1000) {
        return res.status(400).json({ error: "Audio file too small to transcribe" });
      }

      console.log('Transcription-only request received:', {
        audioSize: req.file.buffer.length,
        mimeType: req.file.mimetype
      });

      const transcriptionResult = await transcriptionService.transcribeAudio(
        req.file.buffer,
        req.file.mimetype
      );

      if ('error' in transcriptionResult) {
        console.error('Deepgram transcription failed:', transcriptionResult.error, transcriptionResult.details);
        return res.status(500).json({ 
          error: "Transcription failed", 
          details: transcriptionResult.details 
        });
      }

      console.log('Transcription-only completed:', transcriptionResult.text.length, 'characters');
      
      res.json({
        text: transcriptionResult.text,
        confidence: transcriptionResult.confidence,
        duration: transcriptionResult.duration
      });
    } catch (error) {
      console.error('Transcription error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Employee routes
  app.get("/api/employees/:empid", async (req, res) => {
    try {
      const { empid } = req.params;
      const employee = await storage.getEmployee(empid);
      
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }
      
      // Don't return password hash
      const { password_hash, ...employeeData } = employee;
      res.json(employeeData);
    } catch (error) {
      console.error('Get employee error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Medical Editor API routes
  
  // Get available note templates
  app.get("/api/medical/templates", (req, res) => {
    const templates = Object.entries(NOTE_TEMPLATES).map(([id, def]) => ({
      id,
      name: def.name,
      sections: def.sections,
      description: def.description
    }));
    res.json(templates);
  });

  // Get empty template structure
  app.get("/api/medical/templates/:templateId/empty", (req, res) => {
    const { templateId } = req.params;
    if (!NOTE_TEMPLATES[templateId as NoteTemplate]) {
      return res.status(404).json({ error: "Template not found" });
    }
    const emptyTemplate = getEmptyTemplate(templateId as NoteTemplate);
    res.json({ template: emptyTemplate });
  });

  // Get medical abbreviations
  app.get("/api/medical/abbreviations", (req, res) => {
    res.json(MEDICAL_ABBREVIATIONS);
  });

  // Get quick insert phrases
  app.get("/api/medical/quick-phrases", (req, res) => {
    res.json(QUICK_INSERT_PHRASES);
  });

  // AI-powered auto-format transcription to template
  app.post("/api/medical/format", async (req, res) => {
    try {
      const { transcription, template } = req.body;
      
      if (!transcription || !template) {
        return res.status(400).json({ error: "Transcription and template are required" });
      }
      
      if (!NOTE_TEMPLATES[template as NoteTemplate]) {
        return res.status(400).json({ error: "Invalid template type" });
      }
      
      console.log(`Formatting transcription to ${template} template...`);
      const formattedNote = await formatTranscriptionToTemplate(transcription, template as NoteTemplate);
      console.log(`Formatting complete: ${formattedNote.length} characters`);
      
      res.json({ formattedNote });
    } catch (error) {
      console.error('Format transcription error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to format transcription" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
