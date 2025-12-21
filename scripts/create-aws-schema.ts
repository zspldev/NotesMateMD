import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.AWS_RDS_HOST,
  port: parseInt(process.env.AWS_RDS_PORT || '5432'),
  database: process.env.AWS_RDS_DATABASE,
  user: process.env.AWS_RDS_USER,
  password: process.env.AWS_RDS_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function createSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      -- Organizations table
      CREATE TABLE IF NOT EXISTS orgs (
        orgid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_number INTEGER UNIQUE,
        org_shortname VARCHAR(6) UNIQUE,
        org_name VARCHAR(255) NOT NULL,
        org_type VARCHAR(50),
        address TEXT,
        phone VARCHAR(20),
        mrn_sequence_current INTEGER DEFAULT 100001,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT now()
      );

      -- Employees table
      CREATE TABLE IF NOT EXISTS employees (
        empid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        orgid UUID REFERENCES orgs(orgid),
        username VARCHAR(100) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        title VARCHAR(100),
        role VARCHAR(20) DEFAULT 'doctor',
        secondary_role VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT now()
      );

      -- Patients table
      CREATE TABLE IF NOT EXISTS patients (
        patientid VARCHAR(50) PRIMARY KEY,
        orgid UUID REFERENCES orgs(orgid) NOT NULL,
        mrn VARCHAR(10),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        date_of_birth DATE NOT NULL,
        gender VARCHAR(20),
        contact_info TEXT,
        created_at TIMESTAMP DEFAULT now()
      );

      -- Visits table
      CREATE TABLE IF NOT EXISTS visits (
        visitid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patientid VARCHAR(50) REFERENCES patients(patientid) NOT NULL,
        empid UUID REFERENCES employees(empid) NOT NULL,
        visit_date DATE NOT NULL,
        visit_purpose TEXT,
        created_at TIMESTAMP DEFAULT now()
      );

      -- Visit notes table
      CREATE TABLE IF NOT EXISTS visit_notes (
        noteid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        visitid UUID REFERENCES visits(visitid) NOT NULL,
        audio_file TEXT,
        audio_filename VARCHAR(255),
        audio_mimetype VARCHAR(100),
        audio_duration_seconds INTEGER,
        transcription_text TEXT,
        is_transcription_edited BOOLEAN DEFAULT false,
        ai_transcribed BOOLEAN DEFAULT false,
        session_id VARCHAR(100),
        device_type VARCHAR(20),
        browser_name VARCHAR(100),
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT now(),
        updated_at TIMESTAMP DEFAULT now()
      );

      -- Backup logs table
      CREATE TABLE IF NOT EXISTS backup_logs (
        backup_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        orgid UUID REFERENCES orgs(orgid) NOT NULL,
        created_by_empid UUID REFERENCES employees(empid) NOT NULL,
        backup_type VARCHAR(50) DEFAULT 'full_export',
        file_size_bytes INTEGER,
        patient_count INTEGER,
        visit_count INTEGER,
        note_count INTEGER,
        status VARCHAR(20) DEFAULT 'completed',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT now()
      );

      -- Visit documents table
      CREATE TABLE IF NOT EXISTS visit_documents (
        document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        visitid UUID REFERENCES visits(visitid) NOT NULL,
        orgid UUID REFERENCES orgs(orgid) NOT NULL,
        uploaded_by_empid UUID REFERENCES employees(empid) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        storage_key TEXT NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        description TEXT,
        is_deleted BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT now()
      );

      -- Legacy users table
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS employees_username_idx ON employees(username);
      CREATE INDEX IF NOT EXISTS employees_orgid_idx ON employees(orgid);
      CREATE INDEX IF NOT EXISTS patients_orgid_idx ON patients(orgid);
      CREATE INDEX IF NOT EXISTS visits_patientid_idx ON visits(patientid);
      CREATE INDEX IF NOT EXISTS visits_empid_idx ON visits(empid);
      CREATE INDEX IF NOT EXISTS visit_notes_visitid_idx ON visit_notes(visitid);
      CREATE INDEX IF NOT EXISTS backup_logs_orgid_idx ON backup_logs(orgid);
      CREATE INDEX IF NOT EXISTS backup_logs_created_by_idx ON backup_logs(created_by_empid);
      CREATE INDEX IF NOT EXISTS visit_documents_visitid_idx ON visit_documents(visitid);
      CREATE INDEX IF NOT EXISTS visit_documents_orgid_idx ON visit_documents(orgid);
    `);
    
    console.log('Schema created successfully!');
    
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables:', result.rows.map(r => r.table_name));
  } catch (error) {
    console.error('Error creating schema:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

createSchema();
