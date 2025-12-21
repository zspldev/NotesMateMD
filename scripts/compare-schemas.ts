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

async function getTableColumns(pool: Pool, tableName: string): Promise<string[]> {
  const result = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = $1 
    ORDER BY ordinal_position
  `, [tableName]);
  return result.rows.map(r => r.column_name);
}

async function compareSchemas() {
  const tables = ['orgs', 'employees', 'patients', 'visits', 'visit_notes', 'backup_logs', 'visit_documents'];
  
  console.log('Comparing schemas between Neon and AWS RDS:\n');
  
  for (const table of tables) {
    const neonCols = await getTableColumns(neonPool, table);
    const awsCols = await getTableColumns(awsPool, table);
    
    const missingInAws = neonCols.filter(c => !awsCols.includes(c));
    const extraInAws = awsCols.filter(c => !neonCols.includes(c));
    
    console.log(`\n=== ${table.toUpperCase()} ===`);
    console.log(`Neon columns: ${neonCols.join(', ')}`);
    console.log(`AWS columns: ${awsCols.join(', ')}`);
    
    if (missingInAws.length > 0) {
      console.log(`❌ MISSING in AWS: ${missingInAws.join(', ')}`);
    }
    if (extraInAws.length > 0) {
      console.log(`⚠️ EXTRA in AWS: ${extraInAws.join(', ')}`);
    }
    if (missingInAws.length === 0 && extraInAws.length === 0) {
      console.log(`✅ Schemas match`);
    }
  }
  
  await neonPool.end();
  await awsPool.end();
}

compareSchemas();
