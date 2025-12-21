import { Pool } from 'pg';

const neonPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const awsPool = new Pool({
  host: process.env.AWS_RDS_HOST,
  port: parseInt(process.env.AWS_RDS_PORT || '5432'),
  database: process.env.AWS_RDS_DATABASE,
  user: process.env.AWS_RDS_USER,
  password: process.env.AWS_RDS_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const neonClient = await neonPool.connect();
  const awsClient = await awsPool.connect();
  
  try {
    console.log('Starting migration from Neon to AWS RDS...\n');
    
    // Fetch all data from Neon
    console.log('Fetching data from Neon...');
    
    const orgs = await neonClient.query('SELECT * FROM orgs');
    console.log(`  - Organizations: ${orgs.rows.length}`);
    
    const employees = await neonClient.query('SELECT * FROM employees');
    console.log(`  - Employees: ${employees.rows.length}`);
    
    const patients = await neonClient.query('SELECT * FROM patients');
    console.log(`  - Patients: ${patients.rows.length}`);
    
    const visits = await neonClient.query('SELECT * FROM visits');
    console.log(`  - Visits: ${visits.rows.length}`);
    
    const visitNotes = await neonClient.query('SELECT * FROM visit_notes');
    console.log(`  - Visit Notes: ${visitNotes.rows.length}`);
    
    const backupLogs = await neonClient.query('SELECT * FROM backup_logs');
    console.log(`  - Backup Logs: ${backupLogs.rows.length}`);
    
    let visitDocuments = { rows: [] as any[] };
    try {
      visitDocuments = await neonClient.query('SELECT * FROM visit_documents');
      console.log(`  - Visit Documents: ${visitDocuments.rows.length}`);
    } catch (e) {
      console.log('  - Visit Documents: table not found (skipping)');
    }
    
    // Clear AWS RDS tables (in reverse order of dependencies)
    console.log('\nClearing AWS RDS tables...');
    await awsClient.query('BEGIN');
    
    try {
      await awsClient.query('DELETE FROM visit_documents');
      await awsClient.query('DELETE FROM backup_logs');
      await awsClient.query('DELETE FROM visit_notes');
      await awsClient.query('DELETE FROM visits');
      await awsClient.query('DELETE FROM patients');
      await awsClient.query('DELETE FROM employees');
      await awsClient.query('DELETE FROM orgs');
      console.log('  - Tables cleared successfully');
      
      // Insert organizations
      console.log('\nInserting data into AWS RDS...');
      for (const org of orgs.rows) {
        await awsClient.query(`
          INSERT INTO orgs (orgid, org_number, org_shortname, org_name, org_type, address, phone, mrn_sequence_current, is_active, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [org.orgid, org.org_number, org.org_shortname, org.org_name, org.org_type, org.address, org.phone, org.mrn_sequence_current, org.is_active, org.created_at]);
      }
      console.log(`  - Organizations: ${orgs.rows.length} inserted`);
      
      // Insert employees
      for (const emp of employees.rows) {
        await awsClient.query(`
          INSERT INTO employees (empid, orgid, username, password_hash, first_name, last_name, title, role, secondary_role, is_active, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [emp.empid, emp.orgid, emp.username, emp.password_hash, emp.first_name, emp.last_name, emp.title, emp.role, emp.secondary_role, emp.is_active, emp.created_at]);
      }
      console.log(`  - Employees: ${employees.rows.length} inserted`);
      
      // Insert patients
      for (const patient of patients.rows) {
        await awsClient.query(`
          INSERT INTO patients (patientid, orgid, mrn, first_name, last_name, date_of_birth, gender, contact_info, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [patient.patientid, patient.orgid, patient.mrn, patient.first_name, patient.last_name, patient.date_of_birth, patient.gender, patient.contact_info, patient.created_at]);
      }
      console.log(`  - Patients: ${patients.rows.length} inserted`);
      
      // Insert visits
      for (const visit of visits.rows) {
        await awsClient.query(`
          INSERT INTO visits (visitid, patientid, empid, visit_date, visit_purpose, created_at)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [visit.visitid, visit.patientid, visit.empid, visit.visit_date, visit.visit_purpose, visit.created_at]);
      }
      console.log(`  - Visits: ${visits.rows.length} inserted`);
      
      // Insert visit notes (using columns that exist in both Neon and AWS)
      for (const note of visitNotes.rows) {
        await awsClient.query(`
          INSERT INTO visit_notes (noteid, visitid, audio_file, audio_filename, audio_mimetype, audio_duration_seconds, 
            transcription_text, is_transcription_edited, ai_transcribed, session_id, device_type, browser_name, 
            ip_address, user_agent, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `, [note.noteid, note.visitid, note.audio_file, note.audio_filename, note.audio_mimetype, note.audio_duration_seconds,
            note.transcription_text, note.is_transcription_edited, note.ai_transcribed, note.session_id, note.device_type, 
            note.browser_name, note.ip_address, note.user_agent, note.created_at, note.updated_at]);
      }
      console.log(`  - Visit Notes: ${visitNotes.rows.length} inserted`);
      
      // Insert backup logs
      for (const log of backupLogs.rows) {
        await awsClient.query(`
          INSERT INTO backup_logs (backup_id, orgid, created_by_empid, backup_type, file_size_bytes, patient_count, visit_count, note_count, status, error_message, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [log.backup_id, log.orgid, log.created_by_empid, log.backup_type, log.file_size_bytes, log.patient_count, log.visit_count, log.note_count, log.status, log.error_message, log.created_at]);
      }
      console.log(`  - Backup Logs: ${backupLogs.rows.length} inserted`);
      
      // Insert visit documents
      for (const doc of visitDocuments.rows) {
        await awsClient.query(`
          INSERT INTO visit_documents (document_id, visitid, orgid, uploaded_by_empid, original_filename, storage_key, mime_type, file_size_bytes, description, is_deleted, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [doc.document_id, doc.visitid, doc.orgid, doc.uploaded_by_empid, doc.original_filename, doc.storage_key, doc.mime_type, doc.file_size_bytes, doc.description, doc.is_deleted, doc.created_at]);
      }
      console.log(`  - Visit Documents: ${visitDocuments.rows.length} inserted`);
      
      await awsClient.query('COMMIT');
      console.log('\n✅ Migration completed successfully!');
      
      // Verify counts
      console.log('\nVerification - AWS RDS now has:');
      const awsOrgs = await awsClient.query('SELECT COUNT(*) FROM orgs');
      const awsEmps = await awsClient.query('SELECT COUNT(*) FROM employees');
      const awsPats = await awsClient.query('SELECT COUNT(*) FROM patients');
      const awsVisits = await awsClient.query('SELECT COUNT(*) FROM visits');
      const awsNotes = await awsClient.query('SELECT COUNT(*) FROM visit_notes');
      console.log(`  - Organizations: ${awsOrgs.rows[0].count}`);
      console.log(`  - Employees: ${awsEmps.rows[0].count}`);
      console.log(`  - Patients: ${awsPats.rows[0].count}`);
      console.log(`  - Visits: ${awsVisits.rows[0].count}`);
      console.log(`  - Visit Notes: ${awsNotes.rows[0].count}`);
      
    } catch (error) {
      await awsClient.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    neonClient.release();
    awsClient.release();
    await neonPool.end();
    await awsPool.end();
  }
}

migrate();
