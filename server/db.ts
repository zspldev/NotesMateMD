import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

function buildConnectionConfig(): { connectionString?: string; host?: string; port?: number; database?: string; user?: string; password?: string; useAwsRds: boolean } {
  const host = process.env.AWS_RDS_HOST;
  const port = process.env.AWS_RDS_PORT || '5432';
  const database = process.env.AWS_RDS_DATABASE;
  const user = process.env.AWS_RDS_USER;
  const password = process.env.AWS_RDS_PASSWORD;

  if (host && database && user && password) {
    return {
      host,
      port: parseInt(port, 10),
      database,
      user,
      password,
      useAwsRds: true
    };
  }

  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      useAwsRds: false
    };
  }

  throw new Error(
    "Database configuration missing. Set AWS_RDS_* variables or DATABASE_URL.",
  );
}

const config = buildConnectionConfig();

export const pool = new Pool({ 
  ...(config.connectionString 
    ? { connectionString: config.connectionString }
    : {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
      }
  ),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: config.useAwsRds ? { rejectUnauthorized: false } : undefined
});

export const db = drizzle(pool, { schema });
