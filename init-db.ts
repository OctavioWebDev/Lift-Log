import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";

const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './data/sqlite.db';


const db = new Database(dbPath);

// Read and execute the migration SQL
const migrationSQL = readFileSync(join(process.cwd(), 'drizzle', '0000_initial.sql'), 'utf-8');

// Split by statement breakpoint and execute each statement
const statements = migrationSQL
  .split('--> statement-breakpoint')
  .map(s => s.trim())
  .filter(s => s.length > 0);

try {
  db.exec('BEGIN TRANSACTION');
  
  for (const statement of statements) {
    if (statement.startsWith('CREATE TABLE') || statement.startsWith('CREATE UNIQUE INDEX')) {
      db.exec(statement);
    }
  }
  
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}