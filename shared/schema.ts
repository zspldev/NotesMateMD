import { sql } from "drizzle-orm";
import { pgTable, text, varchar, uuid, date, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Organizations table
export const orgs = pgTable("orgs", {
  orgid: uuid("orgid").primaryKey().default(sql`gen_random_uuid()`),
  org_name: varchar("org_name", { length: 255 }).notNull(),
  org_type: varchar("org_type", { length: 50 }), // hospital, clinic, medical_office
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  created_at: timestamp("created_at").default(sql`now()`),
});

// Employees table
export const employees = pgTable("employees", {
  empid: uuid("empid").primaryKey().default(sql`gen_random_uuid()`),
  orgid: uuid("orgid").references(() => orgs.orgid).notNull(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  password_hash: text("password_hash").notNull(),
  first_name: varchar("first_name", { length: 100 }).notNull(),
  last_name: varchar("last_name", { length: 100 }).notNull(),
  title: varchar("title", { length: 100 }), // Doctor, Nurse, PA, etc.
  created_at: timestamp("created_at").default(sql`now()`),
});

// Patients table
export const patients = pgTable("patients", {
  patientid: varchar("patientid", { length: 50 }).primaryKey(), // Medical Record Number
  orgid: uuid("orgid").references(() => orgs.orgid).notNull(),
  first_name: varchar("first_name", { length: 100 }).notNull(),
  last_name: varchar("last_name", { length: 100 }).notNull(),
  date_of_birth: date("date_of_birth").notNull(),
  gender: varchar("gender", { length: 20 }),
  contact_info: text("contact_info"), // Optional contact information
  created_at: timestamp("created_at").default(sql`now()`),
});

// Visits table
export const visits = pgTable("visits", {
  visitid: uuid("visitid").primaryKey().default(sql`gen_random_uuid()`),
  patientid: varchar("patientid", { length: 50 }).references(() => patients.patientid).notNull(),
  empid: uuid("empid").references(() => employees.empid).notNull(),
  visit_date: date("visit_date").notNull(),
  visit_purpose: text("visit_purpose"), // Free text field
  created_at: timestamp("created_at").default(sql`now()`),
});

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
  created_at: timestamp("created_at").default(sql`now()`),
  updated_at: timestamp("updated_at").default(sql`now()`),
});

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
  created_at: true,
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