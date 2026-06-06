import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_URL || path.join(__dirname, "../data/sqlite.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

console.log("=== Migration: add nutrition_logs and nutrition_goals tables ===");
console.log(`Database: ${dbPath}`);

function tableExists(name: string): boolean {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name);
  return !!row;
}

const migrate = db.transaction(() => {
  if (tableExists("nutrition_logs")) {
    console.log("✓ nutrition_logs already exists — skipping");
  } else {
    console.log("→ Creating nutrition_logs...");
    db.exec(`
      CREATE TABLE nutrition_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id),
        date INTEGER NOT NULL,
        food_name TEXT NOT NULL,
        brand_name TEXT,
        serving_size REAL NOT NULL DEFAULT 1,
        serving_unit TEXT NOT NULL DEFAULT 'serving',
        calories REAL NOT NULL DEFAULT 0,
        protein REAL NOT NULL DEFAULT 0,
        carbs REAL NOT NULL DEFAULT 0,
        fat REAL NOT NULL DEFAULT 0
      )
    `);
    console.log("✓ nutrition_logs created");
  }

  if (tableExists("nutrition_goals")) {
    console.log("✓ nutrition_goals already exists — skipping");
  } else {
    console.log("→ Creating nutrition_goals...");
    db.exec(`
      CREATE TABLE nutrition_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
        calories REAL NOT NULL DEFAULT 2000,
        protein REAL NOT NULL DEFAULT 150,
        carbs REAL NOT NULL DEFAULT 200,
        fat REAL NOT NULL DEFAULT 65
      )
    `);
    console.log("✓ nutrition_goals created");
  }
});

try {
  migrate();
  console.log("\n✅ Migration complete");
} catch (err) {
  console.error("\n❌ Migration failed:", err);
  process.exit(1);
} finally {
  db.close();
}
