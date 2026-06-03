import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_URL || path.join(__dirname, "../db.sqlite");
const db = new Database(dbPath);

// Enable WAL mode for safer writes
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = OFF"); // OFF during migration, re-enable after

console.log("=== Lift-Log Migration: add user_id to workout_sets and goals ===");
console.log(`Database: ${dbPath}`);

function columnExists(table: string, column: string): boolean {
  const cols = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
  return cols.some((c) => c.name === column);
}

const migrate = db.transaction(() => {
  // ── users table: add missing columns FIRST (required before querying them) ─
  const missingUserCols: Array<{ col: string; sql: string }> = [
    { col: "email", sql: "ALTER TABLE users ADD COLUMN email TEXT" },
    { col: "password_hash", sql: "ALTER TABLE users ADD COLUMN password_hash TEXT" },
    { col: "is_admin", sql: "ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0" },
    { col: "created_at", sql: "ALTER TABLE users ADD COLUMN created_at INTEGER" },
    { col: "trial_ends_at", sql: "ALTER TABLE users ADD COLUMN trial_ends_at INTEGER" },
    { col: "subscription_status", sql: "ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'trial'" },
    { col: "subscription_interval", sql: "ALTER TABLE users ADD COLUMN subscription_interval TEXT" },
    { col: "stripe_customer_id", sql: "ALTER TABLE users ADD COLUMN stripe_customer_id TEXT" },
    { col: "stripe_subscription_id", sql: "ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT" },
    { col: "current_period_ends_at", sql: "ALTER TABLE users ADD COLUMN current_period_ends_at INTEGER" },
  ];

  for (const { col, sql } of missingUserCols) {
    if (!columnExists("users", col)) {
      console.log(`→ Adding users.${col}...`);
      db.exec(sql);
      console.log(`✓ users.${col} added`);
    }
  }

  // ── workout_sets ──────────────────────────────────────────────────────────
  if (columnExists("workout_sets", "user_id")) {
    console.log("✓ workout_sets.user_id already exists — skipping");
  } else {
    console.log("→ Adding user_id to workout_sets...");
    db.exec(`ALTER TABLE workout_sets ADD COLUMN user_id TEXT`);

    // Assign existing rows to the first admin user, or the first user if none
    const adminUser = db
      .prepare(`SELECT id FROM users WHERE is_admin = 1 ORDER BY created_at ASC LIMIT 1`)
      .get() as { id: string } | undefined;
    const fallbackUser = db
      .prepare(`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`)
      .get() as { id: string } | undefined;
    const ownerId = adminUser?.id ?? fallbackUser?.id;

    if (ownerId) {
      const result = db
        .prepare(`UPDATE workout_sets SET user_id = ? WHERE user_id IS NULL`)
        .run(ownerId);
      console.log(`  ✓ Assigned ${result.changes} existing workout rows to user ${ownerId}`);
    } else {
      console.log("  ⚠ No users found — existing workout rows left with NULL user_id");
      console.log("    (safe: they will be invisible until a user claims them)");
    }
    console.log("✓ workout_sets.user_id added");
  }

  // ── goals ─────────────────────────────────────────────────────────────────
  if (columnExists("goals", "user_id")) {
    console.log("✓ goals.user_id already exists — skipping");
  } else {
    console.log("→ Adding user_id to goals...");
    db.exec(`ALTER TABLE goals ADD COLUMN user_id TEXT`);

    const adminUser = db
      .prepare(`SELECT id FROM users WHERE is_admin = 1 ORDER BY created_at ASC LIMIT 1`)
      .get() as { id: string } | undefined;
    const fallbackUser = db
      .prepare(`SELECT id FROM users ORDER BY created_at ASC LIMIT 1`)
      .get() as { id: string } | undefined;
    const ownerId = adminUser?.id ?? fallbackUser?.id;

    if (ownerId) {
      const result = db
        .prepare(`UPDATE goals SET user_id = ? WHERE user_id IS NULL`)
        .run(ownerId);
      console.log(`  ✓ Assigned ${result.changes} existing goal rows to user ${ownerId}`);
    } else {
      console.log("  ⚠ No users found — existing goal rows left with NULL user_id");
    }
    console.log("✓ goals.user_id added");
  }

  // ── unique index on goals ─────────────────────────────────────────────────
  // Old index was (exercise) — new one should be (user_id, exercise)
  const indexes = db.pragma("index_list(goals)") as Array<{ name: string }>;
  const hasOldIndex = indexes.some((i) => i.name === "goals_exercise_unique");
  const hasNewIndex = indexes.some((i) => i.name === "goals_user_exercise_unique");

  if (hasOldIndex && !hasNewIndex) {
    console.log("→ Replacing goals_exercise_unique with goals_user_exercise_unique...");
    db.exec(`DROP INDEX IF EXISTS goals_exercise_unique`);
    db.exec(`CREATE UNIQUE INDEX goals_user_exercise_unique ON goals (user_id, exercise)`);
    console.log("✓ goals index updated");
  } else if (hasNewIndex) {
    console.log("✓ goals_user_exercise_unique already exists — skipping");
  }

});

try {
  migrate();
  db.pragma("foreign_keys = ON");
  console.log("\n✅ Migration complete");
} catch (err) {
  console.error("\n❌ Migration failed:", err);
  process.exit(1);
} finally {
  db.close();
}
