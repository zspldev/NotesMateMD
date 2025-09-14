import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertEmployeeSchema,
  insertPatientSchema,
  insertVisitSchema,
  insertVisitNoteSchema 
} from "@shared/schema";
import multer from "multer";
import { transcriptionService, type TranscriptionResult, type TranscriptionError } from "./transcription";

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

export async function registerRoutes(app: Express): Promise<Server> {
  
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
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: "Internal server error" });
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
      const patient = await storage.createPatient(validatedData);
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
      
      // Check if visit exists
      const visit = await storage.getVisit(visitid);
      if (!visit) {
        return res.status(404).json({ error: "Visit not found" });
      }

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
      const noteData: any = {
        visitid: req.body.visitid,
        transcription_text: req.body.transcription_text || null,
        is_transcription_edited: req.body.is_transcription_edited === 'true'
      };

      // Handle audio file if provided
      if (req.file) {
        noteData.audio_file = req.file.buffer.toString('base64');
        noteData.audio_filename = req.file.originalname;
        noteData.audio_mimetype = req.body.audio_mimetype || req.file.mimetype || 'audio/wav';
        noteData.audio_duration_seconds = parseInt(req.body.audio_duration_seconds) || null;

        // Automatically transcribe audio using Deepgram if no manual transcription provided
        if (!noteData.transcription_text) {
          console.log('Starting Deepgram transcription for audio file:', noteData.audio_filename);
          
          try {
            const transcriptionResult = await transcriptionService.transcribeAudio(
              req.file.buffer,
              req.file.mimetype
            );

            if ('error' in transcriptionResult) {
              console.error('Deepgram transcription failed:', transcriptionResult.error);
              // Continue without transcription rather than failing the entire request
              noteData.transcription_text = `[Transcription failed: ${transcriptionResult.error}]`;
            } else {
              noteData.transcription_text = transcriptionResult.text;
              noteData.is_transcription_edited = false; // Mark as auto-generated
              noteData.ai_transcribed = true; // Mark that AI transcription was used
              console.log(`Deepgram transcription completed: ${transcriptionResult.text.length} characters, confidence: ${transcriptionResult.confidence}`);
            }
          } catch (transcriptionError) {
            console.error('Deepgram service error:', transcriptionError);
            noteData.transcription_text = '[Automatic transcription unavailable]';
          }
        }
      }

      const validatedData = insertVisitNoteSchema.parse(noteData);
      const note = await storage.createVisitNote(validatedData);
      
      // Add ai_transcribed flag to response if it was set
      const response = {
        ...note,
        ai_transcribed: noteData.ai_transcribed || false
      };
      
      res.status(201).json(response);
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

  const httpServer = createServer(app);

  return httpServer;
}
