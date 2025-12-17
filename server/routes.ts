import type { Express, Request, Response, NextFunction } from "express";
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
import bcrypt from "bcrypt";
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
import { createAccessToken, verifyAccessToken, type AuthContext } from "./auth";

// Role-based access control definitions
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ORG_ADMIN: 'org_admin',
  DOCTOR: 'doctor',
  STAFF: 'staff'
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// Permissions by role
export const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: [
    'view_all_orgs', 'manage_orgs', 'impersonate',
    'view_all_employees', 'manage_employees',
    'view_patients', 'manage_patients',
    'view_visits', 'create_visits', 'manage_visits',
    'view_notes', 'create_notes', 'manage_notes',
    'export_data', 'view_audit_logs'
  ],
  [ROLES.ORG_ADMIN]: [
    'view_org_settings', 'manage_org_settings',
    'view_all_employees', 'manage_employees',
    'view_patients', 'manage_patients',
    'view_visits', 'create_visits', 'manage_visits',
    'view_notes', 'create_notes', 'manage_notes',
    'export_data', 'view_audit_logs'
  ],
  [ROLES.DOCTOR]: [
    'view_patients', 'manage_patients',
    'view_visits', 'create_visits', 'manage_visits',
    'view_notes', 'create_notes', 'manage_notes',
    'export_data'
  ],
  [ROLES.STAFF]: [
    'view_patients'  // Staff can view patient list (basic info only enforced at UI level)
  ]
} as const;

// Helper function to check if a role has a specific permission
export function hasPermission(role: string | null, permission: string): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role as Role] as readonly string[] | undefined;
  if (!permissions) return false;
  return permissions.includes(permission);
}

// Helper function to check if role can access clinical notes
export function canAccessClinicalNotes(role: string | null): boolean {
  return hasPermission(role, 'view_notes');
}

// Helper function to check if role can manage patients
export function canManagePatients(role: string | null): boolean {
  return hasPermission(role, 'manage_patients');
}

// Extend Express Request type to include auth context
declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
    }
  }
}

// Authentication middleware to verify access token and extract auth context
function requireAuth(permission?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.substring(7);
    const authContext = verifyAccessToken(token);
    
    if (!authContext) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    // Check permission if specified
    if (permission && !hasPermission(authContext.role, permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    req.authContext = authContext;
    next();
  };
}

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
      const { org_code, username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      // Authenticate the user first
      const employee = await storage.authenticateEmployee(username, password);
      if (!employee) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Check if employee is active
      if (employee.is_active === false) {
        return res.status(401).json({ error: "Account is deactivated. Please contact your administrator." });
      }

      // Super admin can login without org code
      if (employee.role === 'super_admin') {
        const { password_hash, ...employeeData } = employee;
        // If super admin provided an org_code, get that org for impersonation context
        let org = null;
        if (org_code) {
          const orgNumber = parseInt(org_code, 10);
          if (!isNaN(orgNumber)) {
            org = await storage.getOrgByOrgNumber(orgNumber);
          }
        }
        
        // Create access token for super admin
        const accessToken = createAccessToken({
          empid: employee.empid,
          orgid: employee.orgid,
          role: employee.role || 'doctor',
          secondaryRole: employee.secondary_role,
          activeRole: employee.role || 'super_admin',
          impersonatedOrgId: org?.orgid
        });
        
        return res.json({
          employee: employeeData,
          organization: org,
          accessToken
        });
      }

      // For non-super_admin, org_code is required
      if (!org_code) {
        return res.status(400).json({ error: "Organization code is required" });
      }

      // Parse org_code as number
      const orgNumber = parseInt(org_code, 10);
      if (isNaN(orgNumber)) {
        return res.status(400).json({ error: "Invalid organization code format" });
      }

      // Validate org exists and is active
      const org = await storage.getOrgByOrgNumber(orgNumber);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      if (org.is_active === false) {
        return res.status(403).json({ error: "Organization is not active" });
      }

      // Validate employee belongs to this org
      if (employee.orgid !== org.orgid) {
        return res.status(403).json({ error: "You are not a member of this organization" });
      }

      // Create access token for regular user
      // Default activeRole: org_admin goes to admin view, others go to clinical
      const defaultActiveRole = employee.role === 'org_admin' ? 'org_admin' : (employee.role || 'doctor');
      const accessToken = createAccessToken({
        empid: employee.empid,
        orgid: employee.orgid,
        role: employee.role || 'doctor',
        secondaryRole: employee.secondary_role,
        activeRole: defaultActiveRole
      });

      // Return employee info without password hash
      const { password_hash, ...employeeData } = employee;
      res.json({
        employee: employeeData,
        organization: org,
        accessToken
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

  // Switch organization (for super admin impersonation)
  app.post("/api/auth/switch-org", async (req, res) => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: "No authorization token provided" });
      }
      
      const token = authHeader.substring(7);
      const authContext = verifyAccessToken(token);
      
      if (!authContext) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      
      // Only super_admin can switch orgs
      if (authContext.role !== 'super_admin') {
        return res.status(403).json({ error: "Only super admins can switch organizations" });
      }
      
      const { org_number } = req.body;
      
      // Get target org
      const targetOrg = await storage.getOrgByOrgNumber(parseInt(org_number, 10));
      if (!targetOrg) {
        return res.status(404).json({ error: "Organization not found" });
      }
      if (targetOrg.is_active === false) {
        return res.status(403).json({ error: "Organization is not active" });
      }
      
      // Get the employee info
      const employee = await storage.getEmployee(authContext.empid);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }
      
      // Create new token with impersonated org context
      const newToken = createAccessToken({
        empid: authContext.empid,
        orgid: authContext.orgid, // Keep original orgid
        role: authContext.role,
        secondaryRole: authContext.secondaryRole,
        activeRole: authContext.activeRole,
        impersonatedOrgId: targetOrg.orgid
      });
      
      const { password_hash, ...employeeData } = employee;
      
      console.log(`Super admin ${employee.username} switched to org ${targetOrg.org_name} (${org_number})`);
      
      res.json({
        employee: employeeData,
        organization: targetOrg,
        accessToken: newToken
      });
    } catch (error) {
      console.error('Switch org error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Clear impersonation (return to super admin home view)
  app.post("/api/auth/clear-impersonation", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: "No authorization token provided" });
      }
      
      const token = authHeader.substring(7);
      const authContext = verifyAccessToken(token);
      
      if (!authContext) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      
      if (authContext.role !== 'super_admin') {
        return res.status(403).json({ error: "Only super admins can clear impersonation" });
      }
      
      // Get the employee info
      const employee = await storage.getEmployee(authContext.empid);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }
      
      // Create token without impersonation
      const newToken = createAccessToken({
        empid: authContext.empid,
        orgid: authContext.orgid,
        role: authContext.role,
        secondaryRole: authContext.secondaryRole,
        activeRole: authContext.activeRole
        // No impersonatedOrgId
      });
      
      const { password_hash, ...employeeData } = employee;
      
      console.log(`Super admin ${employee.username} cleared impersonation`);
      
      res.json({
        employee: employeeData,
        organization: null,
        accessToken: newToken
      });
    } catch (error) {
      console.error('Clear impersonation error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Switch role for dual-role users (e.g., org_admin with secondary_role=doctor)
  app.post("/api/auth/switch-role", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: "No authorization token provided" });
      }
      
      const token = authHeader.substring(7);
      const authContext = verifyAccessToken(token);
      
      if (!authContext) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      
      const { target_role } = req.body;
      if (!target_role) {
        return res.status(400).json({ error: "Target role is required" });
      }
      
      // Validate user can switch to target role
      const validRoles = [authContext.role, authContext.secondaryRole].filter(Boolean);
      if (!validRoles.includes(target_role)) {
        return res.status(403).json({ error: "You cannot switch to this role" });
      }
      
      // Get employee info
      const employee = await storage.getEmployee(authContext.empid);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }
      
      // Create new token with updated activeRole
      const newToken = createAccessToken({
        empid: authContext.empid,
        orgid: authContext.orgid,
        role: authContext.role,
        secondaryRole: authContext.secondaryRole,
        activeRole: target_role,
        impersonatedOrgId: authContext.impersonatedOrgId
      });
      
      const { password_hash, ...employeeData } = employee;
      
      // Get organization info if applicable
      let org = null;
      if (employee.orgid) {
        org = await storage.getOrg(employee.orgid);
      }
      
      console.log(`Employee ${employee.username} switched to role ${target_role}`);
      
      res.json({
        employee: employeeData,
        organization: org,
        accessToken: newToken,
        activeRole: target_role
      });
    } catch (error) {
      console.error('Switch role error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Organization routes (protected - super admin only)
  app.get("/api/organizations", requireAuth(), async (req, res) => {
    try {
      const authContext = req.authContext!;
      
      // Only super admins can list all organizations
      if (authContext.role !== 'super_admin') {
        return res.status(403).json({ error: "Only super admins can list organizations" });
      }
      
      const orgs = await storage.getOrgs();
      res.json(orgs);
    } catch (error) {
      console.error('Get organizations error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/organizations/:orgid", requireAuth(), async (req, res) => {
    try {
      const { orgid } = req.params;
      const authContext = req.authContext!;
      
      // Only super admins or employees of the org can view it
      if (authContext.role !== 'super_admin' && authContext.orgid !== orgid) {
        return res.status(403).json({ error: "Access denied" });
      }
      
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

  // Get next available org number (super admin only)
  app.get("/api/organizations-next-number", requireAuth(), async (req, res) => {
    try {
      const authContext = req.authContext!;
      
      if (authContext.role !== 'super_admin') {
        return res.status(403).json({ error: "Only super admins can access this" });
      }
      
      const nextNumber = await storage.getNextOrgNumber();
      res.json({ nextOrgNumber: nextNumber });
    } catch (error) {
      console.error('Get next org number error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get platform stats (super admin only)
  app.get("/api/platform-stats", requireAuth(), async (req, res) => {
    try {
      const authContext = req.authContext!;
      
      if (authContext.role !== 'super_admin') {
        return res.status(403).json({ error: "Only super admins can access platform stats" });
      }
      
      const stats = await storage.getPlatformStats();
      res.json(stats);
    } catch (error) {
      console.error('Get platform stats error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Org backup export (org_admin or super_admin only)
  app.get("/api/backups/export", requireAuth(), async (req, res) => {
    try {
      const authContext = req.authContext!;
      const activeRole = authContext.activeRole || authContext.role;
      
      // Only org_admin or super_admin can export
      if (activeRole !== 'org_admin' && authContext.role !== 'super_admin') {
        return res.status(403).json({ error: "Only organization admins can export data" });
      }
      
      // Determine which org to export
      let targetOrgId = authContext.impersonatedOrgId || authContext.orgid;
      
      // Super admin might pass orgid as query param
      if (authContext.role === 'super_admin' && req.query.orgid) {
        targetOrgId = req.query.orgid as string;
      }
      
      if (!targetOrgId) {
        return res.status(400).json({ error: "No organization specified for export" });
      }
      
      // Get all org data
      const exportData = await storage.getOrgExportData(targetOrgId);
      if (!exportData) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      // Prepare export payload
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        version: "1.0",
        organization: exportData.organization,
        patients: exportData.patients,
        visits: exportData.visits,
        notes: exportData.notes.map(n => ({
          ...n,
          audio_file: n.audio_file ? '[AUDIO_DATA_OMITTED]' : null // Don't include binary audio in export
        }))
      };
      
      const jsonString = JSON.stringify(exportPayload, null, 2);
      const fileSizeBytes = Buffer.byteLength(jsonString, 'utf8');
      
      // Log the backup
      await storage.createBackupLog({
        orgid: targetOrgId,
        created_by_empid: authContext.empid,
        backup_type: 'full_export',
        status: 'completed',
        file_size_bytes: fileSizeBytes,
        patient_count: exportData.patients.length,
        visit_count: exportData.visits.length,
        note_count: exportData.notes.length
      });
      
      // Set headers for file download
      const filename = `${exportData.organization.org_shortname}_backup_${new Date().toISOString().split('T')[0]}.json`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/json');
      res.send(jsonString);
      
      console.log(`Backup exported for org ${exportData.organization.org_shortname} by employee ${authContext.empid}`);
    } catch (error) {
      console.error('Backup export error:', error);
      res.status(500).json({ error: "Failed to export backup" });
    }
  });

  // Get backup logs (org_admin sees own org, super_admin sees all)
  app.get("/api/backups/logs", requireAuth(), async (req, res) => {
    try {
      const authContext = req.authContext!;
      const activeRole = authContext.activeRole || authContext.role;
      
      // Super admin can see all logs
      if (authContext.role === 'super_admin') {
        const orgid = req.query.orgid as string | undefined;
        const logs = await storage.getBackupLogs(orgid);
        return res.json(logs);
      }
      
      // Org admin can only see their org's logs
      if (activeRole !== 'org_admin') {
        return res.status(403).json({ error: "Only organization admins can view backup logs" });
      }
      
      const targetOrgId = authContext.impersonatedOrgId || authContext.orgid;
      if (!targetOrgId) {
        return res.status(400).json({ error: "No organization context" });
      }
      
      const logs = await storage.getBackupLogs(targetOrgId);
      res.json(logs);
    } catch (error) {
      console.error('Get backup logs error:', error);
      res.status(500).json({ error: "Failed to get backup logs" });
    }
  });

  // Create organization (super admin only)
  app.post("/api/organizations", requireAuth(), async (req, res) => {
    try {
      const authContext = req.authContext!;
      
      if (authContext.role !== 'super_admin') {
        return res.status(403).json({ error: "Only super admins can create organizations" });
      }
      
      const { org_shortname, org_name, org_type, address, phone, admin_username, admin_password, admin_first_name, admin_last_name } = req.body;
      
      // Validate required fields
      if (!org_shortname || !org_name) {
        return res.status(400).json({ error: "Organization shortname and name are required" });
      }
      
      // Validate shortname format (max 6 chars, alphanumeric)
      if (!/^[A-Z0-9]{1,6}$/i.test(org_shortname)) {
        return res.status(400).json({ error: "Shortname must be 1-6 alphanumeric characters" });
      }
      
      // Check if shortname already exists
      const existingOrg = await storage.getOrgByShortname(org_shortname);
      if (existingOrg) {
        return res.status(400).json({ error: "Organization shortname already exists" });
      }
      
      // Validate admin info before creating org (to avoid orphaned orgs)
      const hasAdminInfo = admin_username || admin_password || admin_first_name || admin_last_name;
      if (hasAdminInfo) {
        // Require all admin fields if any are provided
        if (!admin_username || !admin_password || !admin_first_name || !admin_last_name) {
          return res.status(400).json({ error: "All admin fields (username, password, first name, last name) are required" });
        }
        
        // Check if admin username already exists BEFORE creating org
        const existingEmployee = await storage.getEmployeeByUsername(admin_username);
        if (existingEmployee) {
          return res.status(400).json({ error: "Admin username already exists" });
        }
      }
      
      // Get next org number
      const nextOrgNumber = await storage.getNextOrgNumber();
      
      // Create the organization
      const newOrg = await storage.createOrg({
        org_number: nextOrgNumber,
        org_shortname: org_shortname.toUpperCase(),
        org_name,
        org_type: org_type || 'clinic',
        address: address || null,
        phone: phone || null,
        mrn_sequence_current: 100001,
        is_active: true
      });
      
      // If admin credentials provided, create the first org admin
      let firstAdmin = null;
      if (hasAdminInfo) {
        const passwordHash = await bcrypt.hash(admin_password, 10);
        firstAdmin = await storage.createEmployee({
          orgid: newOrg.orgid,
          username: admin_username,
          password_hash: passwordHash,
          first_name: admin_first_name,
          last_name: admin_last_name,
          title: 'Organization Administrator',
          role: 'org_admin',
          is_active: true
        });
        
        // Remove password_hash from response
        const { password_hash, ...adminData } = firstAdmin;
        firstAdmin = adminData;
      }
      
      console.log(`Super admin ${authContext.empid} created organization: ${newOrg.org_name} (${newOrg.org_number})`);
      
      res.status(201).json({ organization: newOrg, admin: firstAdmin });
    } catch (error) {
      console.error('Create organization error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update organization (super admin only)
  app.patch("/api/organizations/:orgid", requireAuth(), async (req, res) => {
    try {
      const { orgid } = req.params;
      const authContext = req.authContext!;
      
      if (authContext.role !== 'super_admin') {
        return res.status(403).json({ error: "Only super admins can update organizations" });
      }
      
      const existingOrg = await storage.getOrg(orgid);
      if (!existingOrg) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      const { org_name, org_type, address, phone, is_active } = req.body;
      
      // Build updates object with only provided fields
      const updates: Record<string, any> = {};
      if (org_name !== undefined) updates.org_name = org_name;
      if (org_type !== undefined) updates.org_type = org_type;
      if (address !== undefined) updates.address = address;
      if (phone !== undefined) updates.phone = phone;
      if (is_active !== undefined) updates.is_active = is_active;
      
      const updatedOrg = await storage.updateOrg(orgid, updates);
      
      console.log(`Super admin ${authContext.empid} updated organization: ${updatedOrg?.org_name} (${updatedOrg?.org_number})`);
      
      res.json(updatedOrg);
    } catch (error) {
      console.error('Update organization error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Patient routes (protected with requireAuth)
  app.get("/api/patients", requireAuth('view_patients'), async (req, res) => {
    try {
      const { search } = req.query;
      const authContext = req.authContext!;
      
      // Use orgid from token (super admin with impersonation, or user's org)
      const effectiveOrgId = authContext.impersonatedOrgId || authContext.orgid;
      
      if (!effectiveOrgId) {
        return res.status(400).json({ error: "No organization context. Super admins must login with an org code." });
      }

      let patients;
      if (search && typeof search === 'string') {
        patients = await storage.searchPatients(effectiveOrgId, search);
      } else {
        patients = await storage.getPatients(effectiveOrgId);
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

  app.get("/api/patients/:patientid", requireAuth('view_patients'), async (req, res) => {
    try {
      const { patientid } = req.params;
      const authContext = req.authContext!;
      const effectiveOrgId = authContext.impersonatedOrgId || authContext.orgid;
      
      const patient = await storage.getPatient(patientid);
      
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      
      // Verify patient belongs to user's org (cross-org protection)
      if (effectiveOrgId && patient.orgid !== effectiveOrgId) {
        return res.status(403).json({ error: "Access denied: patient not in your organization" });
      }
      
      res.json(patient);
    } catch (error) {
      console.error('Get patient error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/patients", requireAuth('manage_patients'), async (req, res) => {
    try {
      const authContext = req.authContext!;
      const effectiveOrgId = authContext.impersonatedOrgId || authContext.orgid;
      
      if (!effectiveOrgId) {
        return res.status(400).json({ error: "No organization context" });
      }
      
      const validatedData = insertPatientSchema.parse({
        ...req.body,
        orgid: effectiveOrgId  // Use org from token, not from request body
      });
      
      // Get org's current MRN sequence
      const org = await storage.getOrg(effectiveOrgId);
      if (!org) {
        return res.status(400).json({ error: "Organization not found" });
      }
      
      // Use org's MRN sequence (6-digit starting at 100001)
      const mrnNumber = org.mrn_sequence_current || 100001;
      const patientid = `MRN${mrnNumber}`;
      
      // Create patient with auto-generated MRN
      const patientWithMRN: InsertPatientWithMRN = {
        patientid,
        ...validatedData,
      };
      
      const patient = await storage.createPatient(patientWithMRN);
      
      // Increment org's MRN sequence for next patient
      await storage.updateOrg(effectiveOrgId, { mrn_sequence_current: mrnNumber + 1 });
      
      res.status(201).json(patient);
    } catch (error) {
      console.error('Create patient error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid patient data" });
    }
  });

  app.put("/api/patients/:patientid", requireAuth('manage_patients'), async (req, res) => {
    try {
      const { patientid } = req.params;
      const authContext = req.authContext!;
      const effectiveOrgId = authContext.impersonatedOrgId || authContext.orgid;
      
      // Verify patient belongs to user's org
      const existingPatient = await storage.getPatient(patientid);
      if (!existingPatient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      if (effectiveOrgId && existingPatient.orgid !== effectiveOrgId) {
        return res.status(403).json({ error: "Access denied: patient not in your organization" });
      }
      
      const updates = insertPatientSchema.partial().parse(req.body);
      const updatedPatient = await storage.updatePatient(patientid, updates);
      
      res.json(updatedPatient);
    } catch (error) {
      console.error('Update patient error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid patient data" });
    }
  });

  app.delete("/api/patients/:patientid", requireAuth('manage_patients'), async (req, res) => {
    try {
      const { patientid } = req.params;
      const authContext = req.authContext!;
      const effectiveOrgId = authContext.impersonatedOrgId || authContext.orgid;
      
      // Check if patient exists first
      const patient = await storage.getPatient(patientid);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      
      // Verify patient belongs to user's org
      if (effectiveOrgId && patient.orgid !== effectiveOrgId) {
        return res.status(403).json({ error: "Access denied: patient not in your organization" });
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
  app.get("/api/patients/:patientid/notes/export", requireAuth('view_notes'), async (req, res) => {
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

  // Visit routes (protected)
  app.get("/api/patients/:patientid/visits", requireAuth('view_notes'), async (req, res) => {
    try {
      const { patientid } = req.params;
      const authContext = req.authContext!;
      const effectiveOrgId = authContext.impersonatedOrgId || authContext.orgid;
      
      // Check if patient exists
      const patient = await storage.getPatient(patientid);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      
      // Verify patient belongs to user's org
      if (effectiveOrgId && patient.orgid !== effectiveOrgId) {
        return res.status(403).json({ error: "Access denied: patient not in your organization" });
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

  app.get("/api/visits/:visitid", requireAuth('view_notes'), async (req, res) => {
    try {
      const { visitid } = req.params;
      const authContext = req.authContext!;
      const effectiveOrgId = authContext.impersonatedOrgId || authContext.orgid;
      
      const visit = await storage.getVisit(visitid);
      
      if (!visit) {
        return res.status(404).json({ error: "Visit not found" });
      }
      
      // Get patient and verify org ownership
      const patient = await storage.getPatient(visit.patientid);
      if (effectiveOrgId && patient && patient.orgid !== effectiveOrgId) {
        return res.status(403).json({ error: "Access denied: visit not in your organization" });
      }
      
      // Get additional details
      const employee = await storage.getEmployee(visit.empid);
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

  app.post("/api/visits", requireAuth('create_visits'), async (req, res) => {
    try {
      const authContext = req.authContext!;
      const effectiveOrgId = authContext.impersonatedOrgId || authContext.orgid;
      
      // Verify patient belongs to user's org before creating visit
      const patientid = req.body.patientid;
      if (!patientid) {
        return res.status(400).json({ error: "Patient ID is required" });
      }
      
      const patient = await storage.getPatient(patientid);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      if (effectiveOrgId && patient.orgid !== effectiveOrgId) {
        return res.status(403).json({ error: "Access denied: cannot create visit for patient outside your organization" });
      }
      
      // Server-side override: use empid from token, not from client request
      const visitData = {
        ...req.body,
        empid: authContext.empid  // Always use authenticated employee's ID
      };
      
      const validatedData = insertVisitSchema.parse(visitData);
      const visit = await storage.createVisit(validatedData);
      res.status(201).json(visit);
    } catch (error) {
      console.error('Create visit error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid visit data" });
    }
  });

  // Visit Notes routes (protected with org-scoping)
  app.get("/api/visits/:visitid/notes", requireAuth('view_notes'), async (req, res) => {
    try {
      const { visitid } = req.params;
      const authContext = req.authContext!;
      const effectiveOrgId = authContext.impersonatedOrgId || authContext.orgid;
      
      // Verify visit's patient belongs to user's org
      const visit = await storage.getVisit(visitid);
      if (visit) {
        const patient = await storage.getPatient(visit.patientid);
        if (effectiveOrgId && patient && patient.orgid !== effectiveOrgId) {
          return res.status(403).json({ error: "Access denied: notes not in your organization" });
        }
      }
      
      const notes = await storage.getVisitNotes(visitid);
      res.json(notes);
    } catch (error) {
      console.error('Get visit notes error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/notes/:noteid", requireAuth('view_notes'), async (req, res) => {
    try {
      const { noteid } = req.params;
      const authContext = req.authContext!;
      const effectiveOrgId = authContext.impersonatedOrgId || authContext.orgid;
      
      const note = await storage.getVisitNote(noteid);
      
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      
      // Verify note's visit's patient belongs to user's org
      const visit = await storage.getVisit(note.visitid);
      if (visit) {
        const patient = await storage.getPatient(visit.patientid);
        if (effectiveOrgId && patient && patient.orgid !== effectiveOrgId) {
          return res.status(403).json({ error: "Access denied: note not in your organization" });
        }
      }
      
      res.json(note);
    } catch (error) {
      console.error('Get note error:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/notes", requireAuth('create_notes'), upload.single('audio'), async (req, res) => {
    try {
      const authContext = req.authContext!;
      const effectiveOrgId = authContext.impersonatedOrgId || authContext.orgid;
      
      // Verify visit belongs to user's org
      const visitid = req.body.visitid;
      if (visitid) {
        const visit = await storage.getVisit(visitid);
        if (visit) {
          const patient = await storage.getPatient(visit.patientid);
          if (effectiveOrgId && patient && patient.orgid !== effectiveOrgId) {
            return res.status(403).json({ error: "Access denied: cannot create note for visit outside your organization" });
          }
        }
      }
      
      // Check if manual transcription was provided (must be non-empty after trimming)
      const rawTranscription = req.body.transcription_text;
      const trimmedTranscription = rawTranscription?.trim() || '';
      const hasManualTranscription = trimmedTranscription.length > 0;
      
      // Capture IP address from request
      const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() 
        || req.socket.remoteAddress 
        || 'unknown';
      
      const noteData: any = {
        visitid: req.body.visitid,
        transcription_text: hasManualTranscription ? trimmedTranscription : null,
        is_transcription_edited: hasManualTranscription, // Mark as edited if manually provided
        // Device/Browser tracking fields from client
        session_id: req.body.session_id || null,
        device_type: req.body.device_type || null,
        browser_name: req.body.browser_name || null,
        ip_address: ipAddress,
        user_agent: req.body.user_agent || req.headers['user-agent'] || null,
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

  app.put("/api/notes/:noteid", requireAuth('manage_notes'), async (req, res) => {
    try {
      const { noteid } = req.params;
      const authContext = req.authContext!;
      const effectiveOrgId = authContext.impersonatedOrgId || authContext.orgid;
      
      const existingNote = await storage.getVisitNote(noteid);
      if (!existingNote) {
        return res.status(404).json({ error: "Note not found" });
      }
      
      // Verify note's visit's patient belongs to user's org
      const visit = await storage.getVisit(existingNote.visitid);
      if (visit) {
        const patient = await storage.getPatient(visit.patientid);
        if (effectiveOrgId && patient && patient.orgid !== effectiveOrgId) {
          return res.status(403).json({ error: "Access denied: note not in your organization" });
        }
      }
      
      const updates = insertVisitNoteSchema.partial().parse(req.body);
      const updatedNote = await storage.updateVisitNote(noteid, updates);
      
      res.json(updatedNote);
    } catch (error) {
      console.error('Update note error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid note data" });
    }
  });

  // Audio file download route (protected with org-scoping)
  app.get("/api/notes/:noteid/audio", requireAuth('view_notes'), async (req, res) => {
    try {
      const { noteid } = req.params;
      const authContext = req.authContext!;
      const effectiveOrgId = authContext.impersonatedOrgId || authContext.orgid;
      
      const note = await storage.getVisitNote(noteid);
      
      if (!note || !note.audio_file) {
        return res.status(404).json({ error: "Audio file not found" });
      }
      
      // Verify note's visit's patient belongs to user's org
      const visit = await storage.getVisit(note.visitid);
      if (visit) {
        const patient = await storage.getPatient(visit.patientid);
        if (effectiveOrgId && patient && patient.orgid !== effectiveOrgId) {
          return res.status(403).json({ error: "Access denied: audio not in your organization" });
        }
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

  // Transcription-only endpoint (requires auth for Deepgram usage billing)
  app.post("/api/transcribe", requireAuth('create_notes'), upload.single('audio'), async (req, res) => {
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
