import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_URL || path.join(__dirname, "../data/sqlite.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

console.log("=== Migration: add client_id + updated_at (offline sync) ===");
console.log(`Database: ${dbPath}`);

// Not run through `drizzle-kit push`: this database has years of
// hand-patched columns (e.g. workout_sets.user_id was retrofitted without a
// NOT NULL/FK constraint), and drizzle-kit's SQLite table-recreate strategy
// errors out trying to reconcile that drift together with these new columns.
// Plain ALTER TABLE ADD COLUMN avoids the table-recreate path entirely.
//
// SQLite also requires ADD COLUMN's default to be a literal constant (not a
// function call like unixepoch()), so updated_at is backfilled with 0 here
// and then updated to a real timestamp for pre-existing rows only. New rows
// always get a real Date from schema.ts's $defaultFn — see the comment on
// updatedAt in shared/schema.ts for why there's no SQL-level default there.

function hasColumn(table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some((r) => r.name === column);
}

function indexExists(name: string): boolean {
  const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name=?`).get(name);
  return !!row;
}

const tablesWithClientId = ["workout_sets", "goals", "nutrition_logs"];
const tablesWithUpdatedAtOnly = ["nutrition_goals"];
const now = Math.floor(Date.now() / 1000);

const migrate = db.transaction(() => {
  for (const table of tablesWithClientId) {
    if (hasColumn(table, "client_id")) {
      console.log(`✓ ${table}.client_id already exists — skipping`);
    } else {
      console.log(`→ Adding ${table}.client_id...`);
      db.exec(`ALTER TABLE ${table} ADD COLUMN client_id text`);
      console.log(`✓ ${table}.client_id added`);
    }

    const uniqueIndexName = `${table}_client_id_unique`;
    if (indexExists(uniqueIndexName)) {
      console.log(`✓ ${uniqueIndexName} already exists — skipping`);
    } else {
      console.log(`→ Creating ${uniqueIndexName}...`);
      db.exec(`CREATE UNIQUE INDEX ${uniqueIndexName} ON ${table} (client_id)`);
      console.log(`✓ ${uniqueIndexName} created`);
    }
  }

  for (const table of [...tablesWithClientId, ...tablesWithUpdatedAtOnly]) {
    if (hasColumn(table, "updated_at")) {
      console.log(`✓ ${table}.updated_at already exists — skipping`);
    } else {
      console.log(`→ Adding ${table}.updated_at...`);
      db.exec(`ALTER TABLE ${table} ADD COLUMN updated_at integer NOT NULL DEFAULT 0`);
      const { changes } = db.prepare(`UPDATE ${table} SET updated_at = ? WHERE updated_at = 0`).run(now);
      console.log(`✓ ${table}.updated_at added, backfilled ${changes} existing row(s)`);
    }
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
