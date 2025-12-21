import { Pool } from 'pg';

async function main() {
  const pool = new Pool({
    host: process.env.AWS_RDS_HOST,
    port: parseInt(process.env.AWS_RDS_PORT || '5432'),
    database: process.env.AWS_RDS_DATABASE,
    user: process.env.AWS_RDS_USER,
    password: process.env.AWS_RDS_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  const result = await pool.query('SELECT patientid, mrn, first_name, last_name, orgid FROM patients ORDER BY patientid');
  console.log('Patients in AWS RDS:');
  console.log(JSON.stringify(result.rows, null, 2));
  
  const visits = await pool.query('SELECT COUNT(*) as count FROM visits');
  console.log('\nTotal visits:', visits.rows[0].count);
  
  const notes = await pool.query('SELECT COUNT(*) as count FROM visit_notes');
  console.log('Total visit notes:', notes.rows[0].count);
  
  await pool.end();
}
main();
