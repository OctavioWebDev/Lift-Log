// Generic offline-first storage: every syncable entity (workout sets, goals,
// nutrition logs) is stored as one row keyed by (entityType, clientId) rather than
// getting its own typed SQL table — the dataset is small (one user's data) and this
// keeps the sync engine below entirely entity-agnostic.

export type EntityType = "workoutSets" | "goals" | "nutritionLogs";
export type OpType = "create" | "update" | "delete";

export interface LocalRecord<T = any> {
  entityType: EntityType;
  clientId: string;
  userId: string;
  // Null until the create op has been pushed and the server has assigned a row.
  serverId: number | null;
  data: T;
  updatedAt: string; // ISO string — drives last-write-wins conflict resolution on pull
  dirty: boolean; // has local changes not yet confirmed synced
  deleted: boolean; // tombstoned locally, pending a delete push
}

export interface OutboxOp {
  id: number;
  entityType: EntityType;
  clientId: string;
  opType: OpType;
  payload: any;
  createdAt: string;
}

// Storage backend contract. Implemented for real by SQLite (sqlite-store.ts) and,
// for fast/deterministic tests of the sync algorithm, by an in-memory fake
// (memory-store.ts) — sync.ts only ever talks to this interface.
export interface LocalStore {
  listRecords(entityType: EntityType, userId: string): Promise<LocalRecord[]>;
  getRecord(entityType: EntityType, clientId: string): Promise<LocalRecord | undefined>;
  upsertRecord(record: LocalRecord): Promise<void>;
  deleteRecord(entityType: EntityType, clientId: string): Promise<void>;
  enqueueOp(op: Omit<OutboxOp, "id">): Promise<void>;
  listOps(): Promise<OutboxOp[]>; // oldest first
  removeOp(id: number): Promise<void>;
  removeOpsForClientId(entityType: EntityType, clientId: string): Promise<void>;
}

// The subset of a server API client that the sync engine needs for one entity type.
// `list` is supplied per pull call rather than baked in here, since what "all the
// relevant rows" means differs per screen (e.g. nutrition logs are date-scoped).
export interface EntityApi<TServer extends { id: number; updatedAt: string; clientId?: string | null }> {
  create(payload: Record<string, unknown> & { clientId: string }): Promise<TServer>;
  update(serverId: number, payload: Record<string, unknown>): Promise<TServer>;
  remove(serverId: number): Promise<void>;
}
