import * as SQLite from "expo-sqlite";
import type { EntityType, LocalRecord, LocalStore, OutboxOp } from "./types";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync("chirholifts-offline.db").then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS local_records (
          entityType TEXT NOT NULL,
          clientId TEXT NOT NULL,
          userId TEXT NOT NULL,
          serverId INTEGER,
          data TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          dirty INTEGER NOT NULL DEFAULT 0,
          deleted INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (entityType, clientId)
        );
        CREATE TABLE IF NOT EXISTS outbox (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entityType TEXT NOT NULL,
          clientId TEXT NOT NULL,
          opType TEXT NOT NULL,
          payload TEXT,
          createdAt TEXT NOT NULL
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

interface RecordRow {
  entityType: EntityType;
  clientId: string;
  userId: string;
  serverId: number | null;
  data: string;
  updatedAt: string;
  dirty: number;
  deleted: number;
}

function rowToRecord(row: RecordRow): LocalRecord {
  return {
    entityType: row.entityType,
    clientId: row.clientId,
    userId: row.userId,
    serverId: row.serverId,
    data: JSON.parse(row.data),
    updatedAt: row.updatedAt,
    dirty: !!row.dirty,
    deleted: !!row.deleted,
  };
}

export const sqliteStore: LocalStore = {
  async listRecords(entityType, userId) {
    const db = await getDb();
    const rows = await db.getAllAsync<RecordRow>(
      "SELECT * FROM local_records WHERE entityType = ? AND userId = ?",
      entityType,
      userId
    );
    return rows.map(rowToRecord);
  },

  async getRecord(entityType, clientId) {
    const db = await getDb();
    const row = await db.getFirstAsync<RecordRow>(
      "SELECT * FROM local_records WHERE entityType = ? AND clientId = ?",
      entityType,
      clientId
    );
    return row ? rowToRecord(row) : undefined;
  },

  async upsertRecord(record) {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO local_records (entityType, clientId, userId, serverId, data, updatedAt, dirty, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(entityType, clientId) DO UPDATE SET
         userId = excluded.userId,
         serverId = excluded.serverId,
         data = excluded.data,
         updatedAt = excluded.updatedAt,
         dirty = excluded.dirty,
         deleted = excluded.deleted`,
      record.entityType,
      record.clientId,
      record.userId,
      record.serverId,
      JSON.stringify(record.data),
      record.updatedAt,
      record.dirty ? 1 : 0,
      record.deleted ? 1 : 0
    );
  },

  async deleteRecord(entityType, clientId) {
    const db = await getDb();
    await db.runAsync("DELETE FROM local_records WHERE entityType = ? AND clientId = ?", entityType, clientId);
  },

  async enqueueOp(op) {
    const db = await getDb();
    await db.runAsync(
      "INSERT INTO outbox (entityType, clientId, opType, payload, createdAt) VALUES (?, ?, ?, ?, ?)",
      op.entityType,
      op.clientId,
      op.opType,
      op.payload == null ? null : JSON.stringify(op.payload),
      op.createdAt
    );
  },

  async listOps() {
    const db = await getDb();
    const rows = await db.getAllAsync<{
      id: number;
      entityType: EntityType;
      clientId: string;
      opType: OutboxOp["opType"];
      payload: string | null;
      createdAt: string;
    }>("SELECT * FROM outbox ORDER BY id ASC");
    return rows.map((r) => ({ ...r, payload: r.payload == null ? null : JSON.parse(r.payload) }));
  },

  async removeOp(id) {
    const db = await getDb();
    await db.runAsync("DELETE FROM outbox WHERE id = ?", id);
  },

  async removeOpsForClientId(entityType, clientId) {
    const db = await getDb();
    await db.runAsync("DELETE FROM outbox WHERE entityType = ? AND clientId = ?", entityType, clientId);
  },
};
