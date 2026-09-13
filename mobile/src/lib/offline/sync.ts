import type { EntityApi, EntityType, LocalRecord, LocalStore } from "./types";

// Thrown by the injected `create`/`update`/`remove` for a real HTTP error response
// (as opposed to a network failure that never reached the server). Kept local to
// avoid this file depending on the api.ts/ApiError module — see toRetryDecision.
export interface HttpLikeError {
  status: number;
}

function isHttpLikeError(err: unknown): err is HttpLikeError {
  return typeof err === "object" && err !== null && typeof (err as any).status === "number";
}

// Network failures and server-side hiccups are retried on the next sync pass.
// A real 4xx rejection (other than 401, which can be a transient token race) means
// retrying the exact same request will never succeed, so we drop it rather than
// looping forever — the local record stays `dirty` so it's visibly out of sync.
function isRetryable(err: unknown): boolean {
  if (!isHttpLikeError(err)) return true; // fetch threw — no connection
  return err.status === 401 || err.status >= 500;
}

export async function enqueueCreate(
  store: LocalStore,
  entityType: EntityType,
  userId: string,
  clientId: string,
  data: Record<string, unknown>
): Promise<void> {
  const now = new Date().toISOString();
  await store.upsertRecord({
    entityType,
    clientId,
    userId,
    serverId: null,
    data,
    updatedAt: now,
    dirty: true,
    deleted: false,
  });
  await store.enqueueOp({ entityType, clientId, opType: "create", payload: data, createdAt: now });
}

export async function enqueueUpdate(
  store: LocalStore,
  entityType: EntityType,
  clientId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const existing = await store.getRecord(entityType, clientId);
  if (!existing || existing.deleted) return;
  const now = new Date().toISOString();
  await store.upsertRecord({
    ...existing,
    data: { ...existing.data, ...patch },
    updatedAt: now,
    dirty: true,
  });
  await store.enqueueOp({ entityType, clientId, opType: "update", payload: patch, createdAt: now });
}

export async function enqueueDelete(store: LocalStore, entityType: EntityType, clientId: string): Promise<void> {
  const existing = await store.getRecord(entityType, clientId);
  if (!existing) return;
  if (existing.serverId == null) {
    // Created and deleted before ever syncing — nothing the server needs to know.
    await store.removeOpsForClientId(entityType, clientId);
    await store.deleteRecord(entityType, clientId);
    return;
  }
  const now = new Date().toISOString();
  await store.upsertRecord({ ...existing, deleted: true, dirty: true, updatedAt: now });
  await store.enqueueOp({ entityType, clientId, opType: "delete", payload: null, createdAt: now });
}

export type EntityApiMap = Partial<Record<EntityType, EntityApi<any>>>;

// Processes the outbox strictly oldest-first and stops at the first retryable
// failure, so a later op for the same record (an update or delete queued after a
// create) never runs ahead of the create it depends on.
export async function pushOutbox(store: LocalStore, apis: EntityApiMap): Promise<void> {
  const ops = await store.listOps();
  for (const op of ops) {
    const api = apis[op.entityType];
    if (!api) continue;
    try {
      if (op.opType === "create") {
        const server = await api.create({ ...op.payload, clientId: op.clientId });
        const record = await store.getRecord(op.entityType, op.clientId);
        if (record) {
          await store.upsertRecord({
            ...record,
            serverId: server.id,
            data: server,
            updatedAt: server.updatedAt,
            dirty: false,
          });
        }
      } else if (op.opType === "update") {
        const record = await store.getRecord(op.entityType, op.clientId);
        if (!record || record.serverId == null) {
          // Its create hasn't landed yet even though it should have run first —
          // leave it queued rather than sending an update with no target.
          break;
        }
        const server = await api.update(record.serverId, op.payload);
        await store.upsertRecord({ ...record, data: server, updatedAt: server.updatedAt, dirty: false });
      } else if (op.opType === "delete") {
        const record = await store.getRecord(op.entityType, op.clientId);
        if (record?.serverId != null) {
          await api.remove(record.serverId);
        }
        await store.deleteRecord(op.entityType, op.clientId);
      }
      await store.removeOp(op.id);
    } catch (err) {
      if (isRetryable(err)) {
        break; // preserve ordering — try the whole remaining queue again next time
      }
      console.warn(`[sync] dropping unrecoverable ${op.opType} op for ${op.entityType}/${op.clientId}:`, err);
      await store.removeOp(op.id);
    }
  }
}

// Merges a fresh set of server rows into the local cache: newer server rows win
// over stale local ones, local rows with unpushed changes are left alone (they'll
// overwrite the server on the next push), and rows deleted server-side are pruned
// locally — but only if they have no unpushed local changes of their own.
export async function pullAndMerge<T extends { id: number; updatedAt: string; clientId?: string | null }>(
  store: LocalStore,
  entityType: EntityType,
  userId: string,
  serverRows: T[]
): Promise<void> {
  const local = await store.listRecords(entityType, userId);
  const localByServerId = new Map(local.filter((r) => r.serverId != null).map((r) => [r.serverId, r]));
  const seenServerIds = new Set<number>();

  for (const row of serverRows) {
    seenServerIds.add(row.id);
    const existing = localByServerId.get(row.id);
    if (!existing) {
      const clientId = row.clientId ?? `server-${row.id}`;
      await store.upsertRecord({
        entityType,
        clientId,
        userId,
        serverId: row.id,
        data: row,
        updatedAt: row.updatedAt,
        dirty: false,
        deleted: false,
      });
      continue;
    }
    if (existing.dirty) continue;
    if (new Date(row.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
      await store.upsertRecord({ ...existing, data: row, updatedAt: row.updatedAt, dirty: false });
    }
  }

  for (const rec of local) {
    if (rec.serverId != null && !seenServerIds.has(rec.serverId) && !rec.dirty) {
      await store.deleteRecord(entityType, rec.clientId);
    }
  }
}

export function toUiList<T>(records: LocalRecord<T>[]): (T & { clientId: string; id?: number })[] {
  return records
    .filter((r) => !r.deleted)
    .map((r) => ({ ...(r.data as T), clientId: r.clientId, id: r.serverId ?? undefined }));
}
