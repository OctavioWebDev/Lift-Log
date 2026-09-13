import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_URL || path.join(__dirname, "../data/sqlite.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

console.log("=== Migration: add users.must_change_password ===");
console.log(`Database: ${dbPath}`);

// Not run through `drizzle-kit push` — see the other scripts/migrate-*.ts
// files for why: this database predates drizzle-kit for its earliest
// tables and `db:push` re-diffs the entire schema, tripping over that old
// drift. Plain ALTER TABLE ADD COLUMN avoids the table-recreate path.

function hasColumn(table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

const migrate = db.transaction(() => {
  if (hasColumn("users", "must_change_password")) {
    console.log("✓ users.must_change_password already exists — skipping");
    return;
  }

  console.log("→ Adding users.must_change_password...");
  db.exec(`ALTER TABLE users ADD COLUMN must_change_password integer NOT NULL DEFAULT 0`);
  console.log("✓ users.must_change_password added");
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
