import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_URL || path.join(__dirname, "../data/sqlite.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

console.log("=== Migration: add meet_preps table + workout_sets.meet_prep_id ===");
console.log(`Database: ${dbPath}`);

// Not run through `drizzle-kit push` — see the other scripts/migrate-*.ts
// files for why: this database predates drizzle-kit for its earliest
// tables and `db:push` re-diffs the entire schema, tripping over that old
// drift. Plain CREATE TABLE / ALTER TABLE ADD COLUMN avoids the
// table-recreate path.

function tableExists(name: string): boolean {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name);
  return !!row;
}

function hasColumn(table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

const migrate = db.transaction(() => {
  if (tableExists("meet_preps")) {
    console.log("✓ meet_preps already exists — skipping");
  } else {
    console.log("→ Creating meet_preps...");
    db.exec(`
      CREATE TABLE meet_preps (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        plan_type TEXT NOT NULL,
        start_date INTEGER NOT NULL,
        end_date INTEGER NOT NULL,
        weeks INTEGER NOT NULL,
        training_days TEXT NOT NULL,
        squat_max INTEGER,
        bench_max INTEGER,
        deadlift_max INTEGER,
        rep_scheme TEXT,
        created_at INTEGER NOT NULL
      )
    `);
    console.log("✓ meet_preps created");
  }

  if (hasColumn("workout_sets", "meet_prep_id")) {
    console.log("✓ workout_sets.meet_prep_id already exists — skipping");
  } else {
    console.log("→ Adding workout_sets.meet_prep_id...");
    db.exec(`ALTER TABLE workout_sets ADD COLUMN meet_prep_id integer REFERENCES meet_preps(id)`);
    console.log("✓ workout_sets.meet_prep_id added");
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
