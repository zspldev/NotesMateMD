import { sql } from "drizzle-orm";
import { pgTable, text, varchar, uuid, date, timestamp, boolean, integer, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Role types for employees
export const EMPLOYEE_ROLES = ['super_admin', 'org_admin', 'doctor', 'staff'] as const;
export type EmployeeRole = typeof EMPLOYEE_ROLES[number];

// Organizations table - Enhanced with new fields
export const orgs = pgTable("orgs", {
  orgid: uuid("orgid").primaryKey().default(sql`gen_random_uuid()`),
  org_number: integer("org_number").unique(), // 5-digit, starts at 1001 (nullable for migration)
  org_shortname: varchar("org_shortname", { length: 6 }).unique(), // 6-char alphanumeric (nullable for migration)
  org_name: varchar("org_name", { length: 255 }).notNull(),
  org_type: varchar("org_type", { length: 50 }), // hospital, clinic, medical_office
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  mrn_sequence_current: integer("mrn_sequence_current").default(100001), // 6-digit MRN per org, starts at 100001
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").default(sql`now()`),
});

// Employees table - Enhanced with role and is_active
export const employees = pgTable("employees", {
  empid: uuid("empid").primaryKey().default(sql`gen_random_uuid()`),
  orgid: uuid("orgid").references(() => orgs.orgid), // Can be NULL for super_admin
  username: varchar("username", { length: 100 }).notNull().unique(),
  password_hash: text("password_hash").notNull(),
  first_name: varchar("first_name", { length: 100 }).notNull(),
  last_name: varchar("last_name", { length: 100 }).notNull(),
  title: varchar("title", { length: 100 }), // Doctor, Nurse, PA, Receptionist, etc.
  role: varchar("role", { length: 20 }).default("doctor"), // super_admin, org_admin, doctor, staff
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").default(sql`now()`),
}, (table) => ({
  usernameIdx: index("employees_username_idx").on(table.username),
  orgidIdx: index("employees_orgid_idx").on(table.orgid),
}));

// Patients table - Keep existing varchar PK structure, add mrn field
// Note: patientid remains as varchar for backward compatibility
// mrn field added for new per-org MRN system
export const patients = pgTable("patients", {
  patientid: varchar("patientid", { length: 50 }).primaryKey(), // Keep existing structure
  orgid: uuid("orgid").references(() => orgs.orgid).notNull(),
  mrn: varchar("mrn", { length: 10 }), // New: 6-digit numeric string per org (nullable for migration)
  first_name: varchar("first_name", { length: 100 }).notNull(),
  last_name: varchar("last_name", { length: 100 }).notNull(),
  date_of_birth: date("date_of_birth").notNull(),
  gender: varchar("gender", { length: 20 }),
  contact_info: text("contact_info"), // Optional contact information
  created_at: timestamp("created_at").default(sql`now()`),
}, (table) => ({
  orgidIdx: index("patients_orgid_idx").on(table.orgid),
}));

// Visits table
export const visits = pgTable("visits", {
  visitid: uuid("visitid").primaryKey().default(sql`gen_random_uuid()`),
  patientid: varchar("patientid", { length: 50 }).references(() => patients.patientid).notNull(),
  empid: uuid("empid").references(() => employees.empid).notNull(),
  visit_date: date("visit_date").notNull(),
  visit_purpose: text("visit_purpose"), // Free text field
  created_at: timestamp("created_at").default(sql`now()`),
}, (table) => ({
  patientidIdx: index("visits_patientid_idx").on(table.patientid),
  empidIdx: index("visits_empid_idx").on(table.empid),
}));

// Visit Notes table
export const visit_notes = pgTable("visit_notes", {
  noteid: uuid("noteid").primaryKey().default(sql`gen_random_uuid()`),
  visitid: uuid("visitid").references(() => visits.visitid).notNull(),
  audio_file: text("audio_file"), // Base64 encoded audio data
  audio_filename: varchar("audio_filename", { length: 255 }),
  audio_mimetype: varchar("audio_mimetype", { length: 100 }), // Store original MIME type
  audio_duration_seconds: integer("audio_duration_seconds"),
  transcription_text: text("transcription_text"),
  is_transcription_edited: boolean("is_transcription_edited").default(false),
  ai_transcribed: boolean("ai_transcribed").default(false), // Track if transcription was AI-generated
  // Device/Browser tracking fields
  session_id: varchar("session_id", { length: 100 }), // Unique session identifier
  device_type: varchar("device_type", { length: 20 }), // Mobile, Tablet, Desktop
  browser_name: varchar("browser_name", { length: 100 }), // Chrome, Safari, Firefox, etc.
  ip_address: varchar("ip_address", { length: 45 }), // IPv4 or IPv6 address
  user_agent: text("user_agent"), // Full user agent string
  created_at: timestamp("created_at").default(sql`now()`),
  updated_at: timestamp("updated_at").default(sql`now()`),
}, (table) => ({
  visitidIdx: index("visit_notes_visitid_idx").on(table.visitid),
}));

// Insert schemas
export const insertOrgSchema = createInsertSchema(orgs).omit({
  orgid: true,
  created_at: true,
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  empid: true,
  created_at: true,
});

export const insertPatientSchema = createInsertSchema(patients).omit({
  patientid: true, // Auto-generated by backend
  mrn: true, // Auto-generated by backend using org's sequence
  created_at: true,
});

// Storage-level type that includes the backend-generated fields
export const insertPatientWithMRNSchema = insertPatientSchema.extend({
  patientid: z.string().min(1, "Patient ID is required"),
  mrn: z.string().optional(),
});

export const insertVisitSchema = createInsertSchema(visits).omit({
  visitid: true,
  created_at: true,
});

export const insertVisitNoteSchema = createInsertSchema(visit_notes).omit({
  noteid: true,
  created_at: true,
  updated_at: true,
} as const);

// Types
export type InsertOrg = z.infer<typeof insertOrgSchema>;
export type Org = typeof orgs.$inferSelect;

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type InsertPatientWithMRN = z.infer<typeof insertPatientWithMRNSchema>;
export type Patient = typeof patients.$inferSelect;

export type InsertVisit = z.infer<typeof insertVisitSchema>;
export type Visit = typeof visits.$inferSelect;

export type InsertVisitNote = z.infer<typeof insertVisitNoteSchema>;
export type VisitNote = typeof visit_notes.$inferSelect;

// Legacy user schema for compatibility
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
