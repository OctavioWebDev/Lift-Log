import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_URL || path.join(__dirname, "../data/sqlite.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

console.log("=== Migration: add food_cache table ===");
console.log(`Database: ${dbPath}`);

// Not run through `drizzle-kit push`: this database predates drizzle-kit for
// its earliest tables (e.g. users.username is an inline UNIQUE column,
// producing an unnamed sqlite_autoindex_users_1 instead of the named index
// drizzle-kit expects), and `db:push` re-diffs the ENTIRE schema on every
// run — so even a change as small as adding one new, unrelated table trips
// over that old drift and fails. Plain CREATE TABLE avoids touching
// anything else in the database.

function tableExists(name: string): boolean {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name);
  return !!row;
}

const migrate = db.transaction(() => {
  if (tableExists("food_cache")) {
    console.log("✓ food_cache already exists — skipping");
    return;
  }

  console.log("→ Creating food_cache...");
  db.exec(`
    CREATE TABLE food_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      fdc_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      brand TEXT,
      serving_size REAL NOT NULL,
      serving_unit TEXT NOT NULL DEFAULT 'g',
      calories REAL NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fat REAL NOT NULL,
      search_hits INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  db.exec(`CREATE UNIQUE INDEX food_cache_fdc_id_unique ON food_cache (fdc_id)`);
  console.log("✓ food_cache created");
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
