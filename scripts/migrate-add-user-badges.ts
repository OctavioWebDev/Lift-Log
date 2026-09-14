import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_URL || path.join(__dirname, "../data/sqlite.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

console.log("=== Migration: add user_badges table ===");
console.log(`Database: ${dbPath}`);

// Not run through `drizzle-kit push` — see the other scripts/migrate-*.ts
// files for why: this database predates drizzle-kit for its earliest
// tables and `db:push` re-diffs the entire schema, tripping over that old
// drift. Plain CREATE TABLE avoids the table-recreate path.

function tableExists(name: string): boolean {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name);
  return !!row;
}

const migrate = db.transaction(() => {
  if (tableExists("user_badges")) {
    console.log("✓ user_badges already exists — skipping");
    return;
  }
  console.log("→ Creating user_badges...");
  db.exec(`
    CREATE TABLE user_badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      badge_id TEXT NOT NULL,
      earned_at INTEGER NOT NULL
    )
  `);
  db.exec(`CREATE UNIQUE INDEX user_badges_user_badge_unique ON user_badges (user_id, badge_id)`);
  console.log("✓ user_badges created");
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
