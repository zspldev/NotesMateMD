import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// AWS RDS PostgreSQL configuration (Mumbai ap-south-1 for DPDP Act compliance)
function getAwsRdsConfig() {
  const host = process.env.AWS_RDS_HOST;
  const port = process.env.AWS_RDS_PORT || '5432';
  const database = process.env.AWS_RDS_DATABASE;
  const user = process.env.AWS_RDS_USER;
  const password = process.env.AWS_RDS_PASSWORD;

  if (!host || !database || !user || !password) {
    throw new Error(
      "AWS RDS configuration missing. Required environment variables: AWS_RDS_HOST, AWS_RDS_DATABASE, AWS_RDS_USER, AWS_RDS_PASSWORD"
    );
  }

  return {
    host,
    port: parseInt(port, 10),
    database,
    user,
    password
  };
}

const config = getAwsRdsConfig();

export const pool = new Pool({ 
  host: config.host,
  port: config.port,
  database: config.database,
  user: config.user,
  password: config.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false }
});

export const db = drizzle(pool, { schema });
