import { 
  type Org, type InsertOrg,
  type Employee, type InsertEmployee,
  type Patient, type InsertPatient, type InsertPatientWithMRN,
  type Visit, type InsertVisit,
  type VisitNote, type InsertVisitNote,
  type BackupLog, type InsertBackupLog,
  orgs, employees, patients, visits, visit_notes, backup_logs
} from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { eq, desc, and, ilike, or, gte, lte, sql } from "drizzle-orm";
import { db } from "./db";

export interface IStorage {
  // Organization operations
  getOrgs(): Promise<Org[]>;
  getOrg(orgid: string): Promise<Org | undefined>;
  getOrgByOrgNumber(orgNumber: number): Promise<Org | undefined>;
  getOrgByShortname(shortname: string): Promise<Org | undefined>;
  getNextOrgNumber(): Promise<number>;
  createOrg(org: InsertOrg): Promise<Org>;
  updateOrg(orgid: string, updates: Partial<InsertOrg>): Promise<Org | undefined>;

  // Employee operations
  getEmployees(orgid: string): Promise<Employee[]>;
  getEmployee(empid: string): Promise<Employee | undefined>;
  getEmployeeByUsername(username: string): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  authenticateEmployee(username: string, password: string): Promise<Employee | null>;

  // Patient operations
  getPatients(orgid: string): Promise<Patient[]>;
  getPatient(patientid: string): Promise<Patient | undefined>;
  createPatient(patient: InsertPatientWithMRN): Promise<Patient>;
  updatePatient(patientid: string, updates: Partial<InsertPatient>): Promise<Patient | undefined>;
  deletePatient(patientid: string): Promise<boolean>;
  searchPatients(orgid: string, query: string): Promise<Patient[]>;

  // Visit operations
  getVisits(patientid: string): Promise<Visit[]>;
  getVisit(visitid: string): Promise<Visit | undefined>;
  createVisit(visit: InsertVisit): Promise<Visit>;

  // Visit Note operations
  getVisitNotes(visitid: string): Promise<VisitNote[]>;
  getVisitNote(noteid: string): Promise<VisitNote | undefined>;
  createVisitNote(note: InsertVisitNote): Promise<VisitNote>;
  updateVisitNote(noteid: string, updates: Partial<InsertVisitNote>): Promise<VisitNote | undefined>;
  
  // Export operations
  getPatientNotesByDateRange(patientid: string, startDate: string, endDate: string): Promise<{
    patient: Patient;
    org: Org;
    notes: Array<{
      note: VisitNote;
      visit: Visit;
      employee: Employee;
    }>;
  } | null>;
  
  // Platform stats (super admin)
  getPlatformStats(): Promise<{
    totalPatients: number;
    totalEmployees: number;
    totalVisits: number;
    activeOrgs: number;
    inactiveOrgs: number;
  }>;
  
  // Backup log operations
  createBackupLog(log: InsertBackupLog): Promise<BackupLog>;
  getBackupLogs(orgid?: string): Promise<BackupLog[]>;
  
  // Full org data export
  getOrgExportData(orgid: string): Promise<{
    organization: Org;
    patients: Patient[];
    visits: Visit[];
    notes: VisitNote[];
  } | null>;
}

export class MemStorage implements IStorage {
  private orgs: Map<string, Org> = new Map();
  private employees: Map<string, Employee> = new Map();
  private patients: Map<string, Patient> = new Map();
  private visits: Map<string, Visit> = new Map();
  private visitNotes: Map<string, VisitNote> = new Map();

  constructor() {
    this.seedData();
  }

  private seedData() {
    // Generate UUIDs for consistent seeding
    const org1Id = "550e8400-e29b-41d4-a716-446655440000";
    const org2Id = "550e8400-e29b-41d4-a716-446655440001";
    const emp1Id = "660e8400-e29b-41d4-a716-446655440000";
    const emp2Id = "660e8400-e29b-41d4-a716-446655440001";

    // Seed organizations
    const org1: Org = {
      orgid: org1Id,
      org_number: 1002,
      org_shortname: "METMED",
      org_name: "Metropolitan Medical Center",
      org_type: "hospital",
      address: "123 Medical Plaza, Healthcare City, HC 12345",
      phone: "(555) 100-2000",
      mrn_sequence_current: 100001,
      is_active: true,
      created_at: new Date()
    };
    this.orgs.set(org1.orgid, org1);

    const org2: Org = {
      orgid: org2Id, 
      org_number: 1003,
      org_shortname: "FAMHLC",
      org_name: "Family Health Clinic",
      org_type: "clinic",
      address: "456 Wellness Ave, Healthtown, HT 67890",
      phone: "(555) 200-3000",
      mrn_sequence_current: 100001,
      is_active: true,
      created_at: new Date()
    };
    this.orgs.set(org2.orgid, org2);

    // Pre-computed bcrypt hash for password "simple123" (eliminates async race condition)
    const hashedPassword = "$2b$10$vaDX.cWdVYoAdNbwlurpQ.7kzcIjmfei3n.Jy/aL0bvzwkDgYfKrG";
    
    const emp1: Employee = {
      empid: emp1Id,
      orgid: org1Id,
      username: "dr.smith",
      password_hash: hashedPassword,
      first_name: "Dr. John",
      last_name: "Smith",
      title: "Primary Care Physician",
      role: "doctor",
      secondary_role: null,
      is_active: true,
      created_at: new Date()
    };
    this.employees.set(emp1.empid, emp1);

    const emp2: Employee = {
      empid: emp2Id,
      orgid: org1Id, 
      username: "dr.wilson",
      password_hash: hashedPassword,
      first_name: "Dr. Sarah",
      last_name: "Wilson",
      title: "Cardiologist",
      role: "doctor",
      secondary_role: null,
      is_active: true,
      created_at: new Date()
    };
    this.employees.set(emp2.empid, emp2);

    // Seed patients
    const patient1: Patient = {
      patientid: "MRN001234",
      orgid: org1Id,
      mrn: "001234",
      first_name: "Sarah",
      last_name: "Johnson",
      date_of_birth: "1985-03-15",
      gender: "Female",
      contact_info: "Phone: (555) 123-4567, Email: sarah.j@email.com",
      created_at: new Date()
    };
    this.patients.set(patient1.patientid, patient1);

    const patient2: Patient = {
      patientid: "MRN005678",
      orgid: org1Id,
      mrn: "005678",
      first_name: "Michael", 
      last_name: "Chen",
      date_of_birth: "1979-11-22",
      gender: "Male",
      contact_info: "Phone: (555) 987-6543",
      created_at: new Date()
    };
    this.patients.set(patient2.patientid, patient2);

    const patient3: Patient = {
      patientid: "MRN009876",
      orgid: org1Id,
      mrn: "009876",
      first_name: "Emma",
      last_name: "Davis", 
      date_of_birth: "1992-07-03",
      gender: "Female",
      contact_info: "Phone: (555) 456-7890, Email: e.davis@email.com",
      created_at: new Date()
    };
    this.patients.set(patient3.patientid, patient3);

    // Generate UUIDs for visits and notes
    const visit1Id = "770e8400-e29b-41d4-a716-446655440000";
    const visit2Id = "770e8400-e29b-41d4-a716-446655440001";
    const note1Id = "880e8400-e29b-41d4-a716-446655440000";
    const note2Id = "880e8400-e29b-41d4-a716-446655440001";

    // Seed visits
    const visit1: Visit = {
      visitid: visit1Id,
      patientid: "MRN001234", 
      empid: emp1Id,
      visit_date: "2024-09-10",
      visit_purpose: "Annual physical exam and blood pressure check",
      created_at: new Date()
    };
    this.visits.set(visit1.visitid, visit1);

    const visit2: Visit = {
      visitid: visit2Id,
      patientid: "MRN001234",
      empid: emp1Id, 
      visit_date: "2024-08-15",
      visit_purpose: "Follow-up for hypertension medication adjustment",
      created_at: new Date()
    };
    this.visits.set(visit2.visitid, visit2);

    // Seed visit notes
    const note1: VisitNote = {
      noteid: note1Id,
      visitid: visit1Id,
      audio_file: null,
      audio_filename: "note_20240910_143022.wav",
      audio_mimetype: null,
      audio_duration_seconds: 180,
      transcription_text: "Patient presents for routine annual physical. Blood pressure 120/80, within normal limits. Patient reports feeling well with no acute concerns. Discussed importance of maintaining healthy diet and exercise routine. No changes to current medications recommended.",
      is_transcription_edited: false,
      ai_transcribed: true,
      session_id: null,
      device_type: null,
      browser_name: null,
      ip_address: null,
      user_agent: null,
      created_at: new Date("2024-09-10T14:30:22Z"),
      updated_at: new Date("2024-09-10T14:30:22Z")
    };
    this.visitNotes.set(note1.noteid, note1);

    const note2: VisitNote = {
      noteid: note2Id, 
      visitid: visit2Id,
      audio_file: null,
      audio_filename: "note_20240815_100530.wav",
      audio_mimetype: null,
      audio_duration_seconds: 95,
      transcription_text: "Follow-up visit for blood pressure management. Current medication lisinopril 10mg daily showing good response. Patient reports no side effects. Blood pressure today 125/82, improved from last visit. Continue current regimen.",
      is_transcription_edited: true,
      ai_transcribed: false,
      session_id: null,
      device_type: null,
      browser_name: null,
      ip_address: null,
      user_agent: null,
      created_at: new Date("2024-08-15T10:05:30Z"),
      updated_at: new Date("2024-08-15T10:05:30Z")
    };
    this.visitNotes.set(note2.noteid, note2);
  }

  // Organization methods
  async getOrgs(): Promise<Org[]> {
    return Array.from(this.orgs.values());
  }

  async getOrg(orgid: string): Promise<Org | undefined> {
    return this.orgs.get(orgid);
  }

  async getOrgByOrgNumber(orgNumber: number): Promise<Org | undefined> {
    return Array.from(this.orgs.values()).find(org => org.org_number === orgNumber);
  }

  async getOrgByShortname(shortname: string): Promise<Org | undefined> {
    return Array.from(this.orgs.values()).find(org => org.org_shortname?.toUpperCase() === shortname.toUpperCase());
  }

  async getNextOrgNumber(): Promise<number> {
    const allOrgs = Array.from(this.orgs.values());
    const maxOrgNumber = allOrgs.reduce((max, org) => {
      return (org.org_number && org.org_number > max) ? org.org_number : max;
    }, 1000);
    return maxOrgNumber + 1;
  }

  async createOrg(insertOrg: InsertOrg): Promise<Org> {
    const orgid = randomUUID();
    const org: Org = { 
      ...insertOrg, 
      orgid, 
      org_number: insertOrg.org_number ?? null,
      org_shortname: insertOrg.org_shortname ?? null,
      org_type: insertOrg.org_type || null,
      address: insertOrg.address || null,
      phone: insertOrg.phone || null,
      mrn_sequence_current: insertOrg.mrn_sequence_current ?? 100001,
      is_active: insertOrg.is_active ?? true,
      created_at: new Date() 
    };
    this.orgs.set(orgid, org);
    return org;
  }

  async updateOrg(orgid: string, updates: Partial<InsertOrg>): Promise<Org | undefined> {
    const org = this.orgs.get(orgid);
    if (!org) return undefined;
    
    const updatedOrg: Org = { ...org, ...updates };
    this.orgs.set(orgid, updatedOrg);
    return updatedOrg;
  }

  // Employee methods
  async getEmployees(orgid: string): Promise<Employee[]> {
    return Array.from(this.employees.values()).filter(emp => emp.orgid === orgid);
  }

  async getEmployee(empid: string): Promise<Employee | undefined> {
    return this.employees.get(empid);
  }

  async getEmployeeByUsername(username: string): Promise<Employee | undefined> {
    return Array.from(this.employees.values()).find(emp => emp.username === username);
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const empid = randomUUID();
    const employee: Employee = { 
      ...insertEmployee, 
      empid, 
      orgid: insertEmployee.orgid ?? null,
      title: insertEmployee.title || null,
      role: insertEmployee.role ?? 'doctor',
      secondary_role: insertEmployee.secondary_role ?? null,
      is_active: insertEmployee.is_active ?? true,
      created_at: new Date() 
    };
    this.employees.set(empid, employee);
    return employee;
  }

  async authenticateEmployee(username: string, password: string): Promise<Employee | null> {
    const employee = await this.getEmployeeByUsername(username);
    if (!employee) return null;
    
    const isValid = await bcrypt.compare(password, employee.password_hash);
    return isValid ? employee : null;
  }

  // Patient methods
  async getPatients(orgid: string): Promise<Patient[]> {
    return Array.from(this.patients.values()).filter(patient => patient.orgid === orgid);
  }

  async getPatient(patientid: string): Promise<Patient | undefined> {
    return this.patients.get(patientid);
  }

  async createPatient(insertPatient: InsertPatientWithMRN): Promise<Patient> {
    const patient: Patient = { 
      ...insertPatient, 
      mrn: insertPatient.mrn ?? null,
      gender: insertPatient.gender || null,
      contact_info: insertPatient.contact_info || null,
      created_at: new Date() 
    };
    this.patients.set(patient.patientid, patient);
    return patient;
  }

  async updatePatient(patientid: string, updates: Partial<InsertPatient>): Promise<Patient | undefined> {
    const patient = this.patients.get(patientid);
    if (!patient) return undefined;
    
    const updatedPatient: Patient = { ...patient, ...updates };
    this.patients.set(patientid, updatedPatient);
    return updatedPatient;
  }

  async deletePatient(patientid: string): Promise<boolean> {
    const patient = this.patients.get(patientid);
    if (!patient) return false;
    
    // Delete all visit notes for all visits of this patient
    const patientVisits = Array.from(this.visits.values()).filter(v => v.patientid === patientid);
    for (const visit of patientVisits) {
      const visitNotes = Array.from(this.visitNotes.values()).filter(n => n.visitid === visit.visitid);
      for (const note of visitNotes) {
        this.visitNotes.delete(note.noteid);
      }
      this.visits.delete(visit.visitid);
    }
    
    // Delete the patient
    this.patients.delete(patientid);
    return true;
  }

  async searchPatients(orgid: string, query: string): Promise<Patient[]> {
    const patients = await this.getPatients(orgid);
    if (!query) return patients;
    
    const lowerQuery = query.toLowerCase();
    return patients.filter(patient => 
      patient.first_name.toLowerCase().includes(lowerQuery) ||
      patient.last_name.toLowerCase().includes(lowerQuery) ||
      patient.patientid.toLowerCase().includes(lowerQuery)
    );
  }

  // Visit methods
  async getVisits(patientid: string): Promise<Visit[]> {
    return Array.from(this.visits.values())
      .filter(visit => visit.patientid === patientid)
      .sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());
  }

  async getVisit(visitid: string): Promise<Visit | undefined> {
    return this.visits.get(visitid);
  }

  async createVisit(insertVisit: InsertVisit): Promise<Visit> {
    const visitid = randomUUID();
    const visit: Visit = { 
      ...insertVisit, 
      visitid, 
      visit_purpose: insertVisit.visit_purpose || null,
      created_at: new Date() 
    };
    this.visits.set(visitid, visit);
    return visit;
  }

  // Visit Note methods
  async getVisitNotes(visitid: string): Promise<VisitNote[]> {
    return Array.from(this.visitNotes.values())
      .filter(note => note.visitid === visitid)
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }

  async getVisitNote(noteid: string): Promise<VisitNote | undefined> {
    return this.visitNotes.get(noteid);
  }

  async createVisitNote(insertNote: InsertVisitNote): Promise<VisitNote> {
    const noteid = randomUUID();
    const note: VisitNote = { 
      ...insertNote, 
      noteid, 
      audio_file: insertNote.audio_file || null,
      audio_filename: insertNote.audio_filename || null,
      audio_mimetype: insertNote.audio_mimetype || null,
      audio_duration_seconds: insertNote.audio_duration_seconds || null,
      transcription_text: insertNote.transcription_text || null,
      is_transcription_edited: insertNote.is_transcription_edited ?? false,
      ai_transcribed: insertNote.ai_transcribed ?? false,
      session_id: insertNote.session_id || null,
      device_type: insertNote.device_type || null,
      browser_name: insertNote.browser_name || null,
      ip_address: insertNote.ip_address || null,
      user_agent: insertNote.user_agent || null,
      created_at: new Date(), 
      updated_at: new Date() 
    };
    this.visitNotes.set(noteid, note);
    return note;
  }

  async updateVisitNote(noteid: string, updates: Partial<InsertVisitNote>): Promise<VisitNote | undefined> {
    const note = this.visitNotes.get(noteid);
    if (!note) return undefined;
    
    const updatedNote: VisitNote = { 
      ...note, 
      ...updates, 
      updated_at: new Date() 
    };
    this.visitNotes.set(noteid, updatedNote);
    return updatedNote;
  }

  async getPatientNotesByDateRange(patientid: string, startDate: string, endDate: string): Promise<{
    patient: Patient;
    org: Org;
    notes: Array<{
      note: VisitNote;
      visit: Visit;
      employee: Employee;
    }>;
  } | null> {
    const patient = this.patients.get(patientid);
    if (!patient) return null;
    
    const org = this.orgs.get(patient.orgid);
    if (!org) return null;
    
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    const patientVisits = Array.from(this.visits.values()).filter(v => v.patientid === patientid);
    const notesWithContext: Array<{ note: VisitNote; visit: Visit; employee: Employee }> = [];
    
    for (const visit of patientVisits) {
      const employee = this.employees.get(visit.empid);
      if (!employee) continue;
      
      const visitNotes = Array.from(this.visitNotes.values()).filter(n => {
        if (n.visitid !== visit.visitid) return false;
        const noteDate = new Date(n.created_at || 0);
        return noteDate >= start && noteDate <= end;
      });
      
      for (const note of visitNotes) {
        notesWithContext.push({ note, visit, employee });
      }
    }
    
    notesWithContext.sort((a, b) => 
      new Date(b.note.created_at || 0).getTime() - new Date(a.note.created_at || 0).getTime()
    );
    
    return { patient, org, notes: notesWithContext };
  }

  async getPlatformStats(): Promise<{
    totalPatients: number;
    totalEmployees: number;
    totalVisits: number;
    activeOrgs: number;
    inactiveOrgs: number;
  }> {
    const allOrgs = Array.from(this.orgs.values());
    const activeOrgs = allOrgs.filter(o => o.is_active && o.org_number !== 1001).length;
    const inactiveOrgs = allOrgs.filter(o => !o.is_active && o.org_number !== 1001).length;
    const totalEmployees = Array.from(this.employees.values()).filter(e => e.role !== 'super_admin').length;
    const totalPatients = this.patients.size;
    const totalVisits = this.visits.size;
    
    return { totalPatients, totalEmployees, totalVisits, activeOrgs, inactiveOrgs };
  }
  
  // Backup log operations (MemStorage - simplified)
  private backupLogs: Map<string, BackupLog> = new Map();
  
  async createBackupLog(log: InsertBackupLog): Promise<BackupLog> {
    const backup_id = randomUUID();
    const backupLog: BackupLog = {
      ...log,
      backup_id,
      backup_type: log.backup_type || 'full_export',
      status: log.status || 'completed',
      file_size_bytes: log.file_size_bytes ?? null,
      patient_count: log.patient_count ?? null,
      visit_count: log.visit_count ?? null,
      note_count: log.note_count ?? null,
      error_message: log.error_message ?? null,
      created_at: new Date()
    };
    this.backupLogs.set(backup_id, backupLog);
    return backupLog;
  }
  
  async getBackupLogs(orgid?: string): Promise<BackupLog[]> {
    const logs = Array.from(this.backupLogs.values());
    if (orgid) {
      return logs.filter(l => l.orgid === orgid).sort((a, b) => 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
    }
    return logs.sort((a, b) => 
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );
  }
  
  async getOrgExportData(orgid: string): Promise<{
    organization: Org;
    patients: Patient[];
    visits: Visit[];
    notes: VisitNote[];
  } | null> {
    const org = this.orgs.get(orgid);
    if (!org) return null;
    
    const orgPatients = Array.from(this.patients.values()).filter(p => p.orgid === orgid);
    const patientIds = new Set(orgPatients.map(p => p.patientid));
    const orgVisits = Array.from(this.visits.values()).filter(v => patientIds.has(v.patientid));
    const visitIds = new Set(orgVisits.map(v => v.visitid));
    const orgNotes = Array.from(this.visitNotes.values()).filter(n => visitIds.has(n.visitid));
    
    return { organization: org, patients: orgPatients, visits: orgVisits, notes: orgNotes };
  }
}

export class DatabaseStorage implements IStorage {
  // Organization methods
  async getOrgs(): Promise<Org[]> {
    return await db.select().from(orgs);
  }

  async getOrg(orgid: string): Promise<Org | undefined> {
    const result = await db.select().from(orgs).where(eq(orgs.orgid, orgid));
    return result[0];
  }

  async getOrgByOrgNumber(orgNumber: number): Promise<Org | undefined> {
    const result = await db.select().from(orgs).where(eq(orgs.org_number, orgNumber));
    return result[0];
  }

  async getOrgByShortname(shortname: string): Promise<Org | undefined> {
    const result = await db.select().from(orgs).where(
      sql`UPPER(${orgs.org_shortname}) = UPPER(${shortname})`
    );
    return result[0];
  }

  async getNextOrgNumber(): Promise<number> {
    const result = await db.select({ maxNum: sql<number>`COALESCE(MAX(${orgs.org_number}), 1000)` }).from(orgs);
    return (result[0]?.maxNum || 1000) + 1;
  }

  async createOrg(insertOrg: InsertOrg): Promise<Org> {
    const result = await db.insert(orgs).values(insertOrg).returning();
    return result[0];
  }

  async updateOrg(orgid: string, updates: Partial<InsertOrg>): Promise<Org | undefined> {
    const result = await db.update(orgs)
      .set(updates)
      .where(eq(orgs.orgid, orgid))
      .returning();
    return result[0];
  }

  // Employee methods
  async getEmployees(orgid: string): Promise<Employee[]> {
    return await db.select().from(employees).where(eq(employees.orgid, orgid));
  }

  async getEmployee(empid: string): Promise<Employee | undefined> {
    const result = await db.select().from(employees).where(eq(employees.empid, empid));
    return result[0];
  }

  async getEmployeeByUsername(username: string): Promise<Employee | undefined> {
    const result = await db.select().from(employees).where(eq(employees.username, username));
    return result[0];
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const result = await db.insert(employees).values(employee).returning();
    return result[0];
  }

  async authenticateEmployee(username: string, password: string): Promise<Employee | null> {
    const employee = await this.getEmployeeByUsername(username);
    if (!employee) return null;
    
    const isValid = await bcrypt.compare(password, employee.password_hash);
    return isValid ? employee : null;
  }

  // Patient methods
  async getPatients(orgid: string): Promise<Patient[]> {
    return await db.select().from(patients).where(eq(patients.orgid, orgid));
  }

  async getPatient(patientid: string): Promise<Patient | undefined> {
    const result = await db.select().from(patients).where(eq(patients.patientid, patientid));
    return result[0];
  }

  async createPatient(patient: InsertPatientWithMRN): Promise<Patient> {
    const result = await db.insert(patients).values(patient).returning();
    return result[0];
  }

  async updatePatient(patientid: string, updates: Partial<InsertPatient>): Promise<Patient | undefined> {
    const result = await db.update(patients)
      .set(updates)
      .where(eq(patients.patientid, patientid))
      .returning();
    return result[0];
  }

  async deletePatient(patientid: string): Promise<boolean> {
    // First check if patient exists
    const patient = await this.getPatient(patientid);
    if (!patient) return false;
    
    // Get all visits for this patient
    const patientVisits = await this.getVisits(patientid);
    
    // Delete all visit notes for each visit
    for (const visit of patientVisits) {
      await db.delete(visit_notes).where(eq(visit_notes.visitid, visit.visitid));
    }
    
    // Delete all visits for this patient
    await db.delete(visits).where(eq(visits.patientid, patientid));
    
    // Delete the patient
    await db.delete(patients).where(eq(patients.patientid, patientid));
    
    return true;
  }

  async searchPatients(orgid: string, query: string): Promise<Patient[]> {
    if (!query) {
      return await this.getPatients(orgid);
    }
    
    return await db.select()
      .from(patients)
      .where(
        and(
          eq(patients.orgid, orgid),
          or(
            ilike(patients.first_name, `%${query}%`),
            ilike(patients.last_name, `%${query}%`),
            ilike(patients.patientid, `%${query}%`)
          )
        )
      );
  }

  // Visit methods
  async getVisits(patientid: string): Promise<Visit[]> {
    return await db.select()
      .from(visits)
      .where(eq(visits.patientid, patientid))
      .orderBy(desc(visits.visit_date));
  }

  async getVisit(visitid: string): Promise<Visit | undefined> {
    const result = await db.select().from(visits).where(eq(visits.visitid, visitid));
    return result[0];
  }

  async createVisit(visit: InsertVisit): Promise<Visit> {
    const result = await db.insert(visits).values(visit).returning();
    return result[0];
  }

  // Visit Note methods
  async getVisitNotes(visitid: string): Promise<VisitNote[]> {
    return await db.select()
      .from(visit_notes)
      .where(eq(visit_notes.visitid, visitid))
      .orderBy(desc(visit_notes.created_at));
  }

  async getVisitNote(noteid: string): Promise<VisitNote | undefined> {
    const result = await db.select().from(visit_notes).where(eq(visit_notes.noteid, noteid));
    return result[0];
  }

  async createVisitNote(note: InsertVisitNote): Promise<VisitNote> {
    const result = await db.insert(visit_notes).values(note).returning();
    return result[0];
  }

  async updateVisitNote(noteid: string, updates: Partial<InsertVisitNote>): Promise<VisitNote | undefined> {
    const result = await db.update(visit_notes)
      .set({
        ...updates,
        updated_at: new Date()
      })
      .where(eq(visit_notes.noteid, noteid))
      .returning();
    return result[0];
  }

  async getPatientNotesByDateRange(patientid: string, startDate: string, endDate: string): Promise<{
    patient: Patient;
    org: Org;
    notes: Array<{
      note: VisitNote;
      visit: Visit;
      employee: Employee;
    }>;
  } | null> {
    const patient = await this.getPatient(patientid);
    if (!patient) return null;
    
    const org = await this.getOrg(patient.orgid);
    if (!org) return null;
    
    // Build date range for filtering
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    // Get all visits for this patient
    const patientVisits = await this.getVisits(patientid);
    
    // Collect notes with context
    const notesWithContext: Array<{ note: VisitNote; visit: Visit; employee: Employee }> = [];
    
    for (const visit of patientVisits) {
      const employee = await this.getEmployee(visit.empid);
      if (!employee) continue;
      
      // Get notes for this visit within date range
      const visitNotes = await db.select()
        .from(visit_notes)
        .where(
          and(
            eq(visit_notes.visitid, visit.visitid),
            gte(visit_notes.created_at, start),
            lte(visit_notes.created_at, end)
          )
        )
        .orderBy(desc(visit_notes.created_at));
      
      for (const note of visitNotes) {
        notesWithContext.push({ note, visit, employee });
      }
    }
    
    // Sort all notes by created_at descending (newest first)
    notesWithContext.sort((a, b) => 
      new Date(b.note.created_at || 0).getTime() - new Date(a.note.created_at || 0).getTime()
    );
    
    return { patient, org, notes: notesWithContext };
  }

  async getPlatformStats(): Promise<{
    totalPatients: number;
    totalEmployees: number;
    totalVisits: number;
    activeOrgs: number;
    inactiveOrgs: number;
  }> {
    // Count patients
    const patientResult = await db.select({ count: sql<number>`count(*)` }).from(patients);
    const totalPatients = patientResult[0]?.count || 0;
    
    // Count non-super-admin employees
    const employeeResult = await db.select({ count: sql<number>`count(*)` })
      .from(employees)
      .where(sql`${employees.role} != 'super_admin'`);
    const totalEmployees = employeeResult[0]?.count || 0;
    
    // Count visits
    const visitResult = await db.select({ count: sql<number>`count(*)` }).from(visits);
    const totalVisits = visitResult[0]?.count || 0;
    
    // Count active/inactive orgs (excluding system org 1001)
    const activeResult = await db.select({ count: sql<number>`count(*)` })
      .from(orgs)
      .where(and(eq(orgs.is_active, true), sql`${orgs.org_number} != 1001`));
    const activeOrgs = activeResult[0]?.count || 0;
    
    const inactiveResult = await db.select({ count: sql<number>`count(*)` })
      .from(orgs)
      .where(and(eq(orgs.is_active, false), sql`${orgs.org_number} != 1001`));
    const inactiveOrgs = inactiveResult[0]?.count || 0;
    
    return { totalPatients, totalEmployees, totalVisits, activeOrgs, inactiveOrgs };
  }
  
  // Backup log operations
  async createBackupLog(log: InsertBackupLog): Promise<BackupLog> {
    const result = await db.insert(backup_logs).values(log).returning();
    return result[0];
  }
  
  async getBackupLogs(orgid?: string): Promise<BackupLog[]> {
    if (orgid) {
      return await db.select()
        .from(backup_logs)
        .where(eq(backup_logs.orgid, orgid))
        .orderBy(desc(backup_logs.created_at));
    }
    return await db.select()
      .from(backup_logs)
      .orderBy(desc(backup_logs.created_at));
  }
  
  async getOrgExportData(orgid: string): Promise<{
    organization: Org;
    patients: Patient[];
    visits: Visit[];
    notes: VisitNote[];
  } | null> {
    // Get organization
    const org = await this.getOrg(orgid);
    if (!org) return null;
    
    // Get all patients for this org
    const orgPatients = await db.select()
      .from(patients)
      .where(eq(patients.orgid, orgid));
    
    if (orgPatients.length === 0) {
      return { organization: org, patients: [], visits: [], notes: [] };
    }
    
    // Get all visits for these patients
    const patientIds = orgPatients.map(p => p.patientid);
    const orgVisits = await db.select()
      .from(visits)
      .where(sql`${visits.patientid} = ANY(${patientIds})`);
    
    if (orgVisits.length === 0) {
      return { organization: org, patients: orgPatients, visits: [], notes: [] };
    }
    
    // Get all notes for these visits
    const visitIds = orgVisits.map(v => v.visitid);
    const orgNotes = await db.select()
      .from(visit_notes)
      .where(sql`${visit_notes.visitid} = ANY(${visitIds})`);
    
    return { organization: org, patients: orgPatients, visits: orgVisits, notes: orgNotes };
  }
}

// Use PostgreSQL database for persistent storage
export const storage = new DatabaseStorage();
