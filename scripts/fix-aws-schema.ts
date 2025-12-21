import { Pool } from 'pg';

const awsPool = new Pool({
  host: process.env.AWS_RDS_HOST,
  port: parseInt(process.env.AWS_RDS_PORT || '5432'),
  database: process.env.AWS_RDS_DATABASE,
  user: process.env.AWS_RDS_USER,
  password: process.env.AWS_RDS_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function fixSchema() {
  const client = await awsPool.connect();
  try {
    console.log('Adding missing columns to visit_notes table...');
    
    // Add missing columns if they don't exist
    const alterStatements = [
      "ALTER TABLE visit_notes ADD COLUMN IF NOT EXISTS browser_version VARCHAR(50)",
      "ALTER TABLE visit_notes ADD COLUMN IF NOT EXISTS os_name VARCHAR(50)",
      "ALTER TABLE visit_notes ADD COLUMN IF NOT EXISTS os_version VARCHAR(50)",
    ];
    
    for (const stmt of alterStatements) {
      await client.query(stmt);
      console.log(`  Executed: ${stmt.substring(0, 60)}...`);
    }
    
    console.log('Schema updated successfully!');
  } finally {
    client.release();
    await awsPool.end();
  }
}

fixSchema();
