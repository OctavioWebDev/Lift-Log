import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./server/db";
import Database from "better-sqlite3";

async function runMigrations() {
  try {
    const sqlite = new Database(process.env.DATABASE_URL?.replace('file:', '') || './data/sqlite.db');
    
    migrate(db, { migrationsFolder: "./drizzle" });
    sqlite.close();
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

runMigrations();