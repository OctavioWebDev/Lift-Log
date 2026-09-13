import type { EntityType, LocalRecord, LocalStore, OutboxOp } from "./types";

// Plain in-memory implementation of LocalStore, used to unit-test the sync engine
// (sync.ts) without a real device/SQLite runtime. Not used by the app itself.
export function createMemoryStore(): LocalStore {
  const records = new Map<string, LocalRecord>();
  const ops: OutboxOp[] = [];
  let nextOpId = 1;

  const key = (entityType: EntityType, clientId: string) => `${entityType}:${clientId}`;

  return {
    async listRecords(entityType, userId) {
      return [...records.values()].filter((r) => r.entityType === entityType && r.userId === userId);
    },
    async getRecord(entityType, clientId) {
      return records.get(key(entityType, clientId));
    },
    async upsertRecord(record) {
      records.set(key(record.entityType, record.clientId), record);
    },
    async deleteRecord(entityType, clientId) {
      records.delete(key(entityType, clientId));
    },
    async enqueueOp(op) {
      ops.push({ ...op, id: nextOpId++ });
    },
    async listOps() {
      return [...ops];
    },
    async removeOp(id) {
      const idx = ops.findIndex((o) => o.id === id);
      if (idx !== -1) ops.splice(idx, 1);
    },
    async removeOpsForClientId(entityType, clientId) {
      for (let i = ops.length - 1; i >= 0; i--) {
        if (ops[i].entityType === entityType && ops[i].clientId === clientId) ops.splice(i, 1);
      }
    },
  };
}
