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

  console.log('Visits in AWS RDS:');
  const visits = await pool.query(`
    SELECT v.visitid, v.patientid, v.visit_date, p.first_name, p.last_name
    FROM visits v
    JOIN patients p ON v.patientid = p.patientid
    ORDER BY v.visit_date DESC
  `);
  console.log(JSON.stringify(visits.rows, null, 2));
  
  console.log('\nVisit Notes in AWS RDS:');
  const notes = await pool.query(`
    SELECT vn.noteid, vn.visitid, SUBSTRING(vn.transcription_text, 1, 50) as note_preview
    FROM visit_notes vn
  `);
  console.log(JSON.stringify(notes.rows, null, 2));
  
  await pool.end();
}
main();
