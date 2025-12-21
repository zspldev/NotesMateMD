import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const pool = new Pool({
  host: process.env.AWS_RDS_HOST,
  port: parseInt(process.env.AWS_RDS_PORT || '5432'),
  database: process.env.AWS_RDS_DATABASE,
  user: process.env.AWS_RDS_USER,
  password: process.env.AWS_RDS_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function seedData() {
  const client = await pool.connect();
  try {
    const hashedPassword = await bcrypt.hash('simple123', 10);
    
    console.log('Checking existing data...');
    const existingOrgs = await client.query('SELECT COUNT(*) FROM orgs');
    
    if (parseInt(existingOrgs.rows[0].count) > 0) {
      console.log('Data already exists. Skipping seed.');
      const orgs = await client.query('SELECT org_number, org_name FROM orgs');
      console.log('Existing orgs:', orgs.rows);
      return;
    }

    console.log('Seeding organizations...');
    
    const org1Id = '550e8400-e29b-41d4-a716-446655440000';
    const org2Id = '550e8400-e29b-41d4-a716-446655440001';
    const superAdminOrgId = '550e8400-e29b-41d4-a716-446655441001';
    
    await client.query(`
      INSERT INTO orgs (orgid, org_number, org_shortname, org_name, org_type, address, phone, mrn_sequence_current, is_active)
      VALUES 
        ($1, 1001, 'SYSTEM', 'System Administration', 'system', 'N/A', 'N/A', 100001, true),
        ($2, 1002, 'METMED', 'Metropolitan Medical Center', 'hospital', '123 Medical Plaza, Healthcare City, HC 12345', '(555) 100-2000', 100001, true),
        ($3, 1003, 'FAMHLC', 'Family Health Clinic', 'clinic', '456 Wellness Ave, Healthtown, HT 67890', '(555) 200-3000', 100001, true)
    `, [superAdminOrgId, org1Id, org2Id]);

    console.log('Seeding employees...');
    
    const superAdminId = '660e8400-e29b-41d4-a716-446655441001';
    const emp1Id = '660e8400-e29b-41d4-a716-446655440000';
    const emp2Id = '660e8400-e29b-41d4-a716-446655440001';
    
    await client.query(`
      INSERT INTO employees (empid, orgid, username, password_hash, first_name, last_name, title, role, secondary_role, is_active)
      VALUES 
        ($1, $2, 'super.admin', $7, 'Super', 'Admin', 'System Administrator', 'super_admin', NULL, true),
        ($3, $4, 'dr.smith', $7, 'Dr. John', 'Smith', 'Primary Care Physician', 'org_admin', 'doctor', true),
        ($5, $6, 'dr.wilson', $7, 'Dr. Sarah', 'Wilson', 'Cardiologist', 'doctor', NULL, true)
    `, [superAdminId, superAdminOrgId, emp1Id, org1Id, emp2Id, org1Id, hashedPassword]);

    console.log('Seeding patients...');
    
    await client.query(`
      INSERT INTO patients (patientid, orgid, mrn, first_name, last_name, date_of_birth, gender, contact_info)
      VALUES 
        ('MRN001234', $1, '001234', 'Sarah', 'Johnson', '1985-03-15', 'Female', 'Phone: (555) 123-4567, Email: sarah.j@email.com'),
        ('MRN005678', $1, '005678', 'Michael', 'Chen', '1979-11-22', 'Male', 'Phone: (555) 987-6543'),
        ('MRN009876', $1, '009876', 'Emma', 'Davis', '1992-07-03', 'Female', 'Phone: (555) 456-7890, Email: e.davis@email.com')
    `, [org1Id]);

    console.log('Seeding visits...');
    
    const visit1Id = '770e8400-e29b-41d4-a716-446655440000';
    const visit2Id = '770e8400-e29b-41d4-a716-446655440001';
    
    await client.query(`
      INSERT INTO visits (visitid, patientid, empid, visit_date, visit_purpose)
      VALUES 
        ($1, 'MRN001234', $3, '2024-09-10', 'Annual physical exam and blood pressure check'),
        ($2, 'MRN001234', $3, '2024-08-15', 'Follow-up for hypertension medication adjustment')
    `, [visit1Id, visit2Id, emp1Id]);

    console.log('Seeding visit notes...');
    
    await client.query(`
      INSERT INTO visit_notes (visitid, transcription_text, is_transcription_edited, ai_transcribed, device_type, browser_name)
      VALUES 
        ($1, 'Patient presents for routine annual physical. Blood pressure 120/80, within normal limits. Patient reports feeling well with no acute concerns. Discussed importance of maintaining healthy diet and exercise routine. No changes to current medications recommended.', false, true, 'Desktop', 'Chrome'),
        ($2, 'Follow-up visit for blood pressure management. Current medication lisinopril 10mg daily showing good response. Patient reports no side effects. Blood pressure today 125/82, improved from last visit. Continue current regimen.', true, false, 'Desktop', 'Chrome')
    `, [visit1Id, visit2Id]);

    console.log('Data seeded successfully!');
    console.log('');
    console.log('Demo Credentials:');
    console.log('  Super Admin: super.admin / simple123');
    console.log('  Org Admin (Org 1002): dr.smith / simple123');
    
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

seedData();
