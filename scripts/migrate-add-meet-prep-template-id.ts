import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_URL || path.join(__dirname, "../data/sqlite.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

console.log("=== Migration: add meet_preps.template_id ===");
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
  if (hasColumn("meet_preps", "template_id")) {
    console.log("✓ meet_preps.template_id already exists — skipping");
  } else {
    console.log("→ Adding meet_preps.template_id...");
    db.exec(`ALTER TABLE meet_preps ADD COLUMN template_id text`);
    console.log("✓ meet_preps.template_id added");
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
