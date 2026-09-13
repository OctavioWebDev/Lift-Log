import { useEffect } from "react";
import * as Crypto from "expo-crypto";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { enqueueCreate, enqueueDelete, toUiList } from "./sync";
import { onSyncSettled, runSync } from "./sync-runner";
import { sqliteStore } from "./sqlite-store";
import type { EntityType } from "./types";

// Reads/writes one entity type through the offline-first local cache: queries read
// from SQLite (never blocking on the network), and mutations write to SQLite +
// the outbox immediately, then kick a background sync — the UI never waits on a
// server round-trip for a create or delete to "take".
export function useOfflineResource<T extends object>(
  entityType: EntityType,
  userId: string | undefined
) {
  const queryClient = useQueryClient();
  const queryKey = ["offline", entityType, userId] as const;

  const query = useQuery({
    queryKey,
    queryFn: async () => toUiList<T>(await sqliteStore.listRecords(entityType, userId!)),
    enabled: !!userId,
    // This reads local SQLite only — it must keep working while offline, unlike
    // TanStack Query's default 'online' mode, which pauses refetches (including
    // the one triggered by invalidateQueries right after an offline create).
    networkMode: "always",
  });

  // A sync pass (triggered elsewhere — reconnect, foreground, another screen's
  // mutation) can pull in server-side changes; refresh once it settles.
  useEffect(() => onSyncSettled(() => queryClient.invalidateQueries({ queryKey })), [queryClient, queryKey]);

  async function create(data: Record<string, unknown>) {
    if (!userId) return;
    const clientId = Crypto.randomUUID();
    await enqueueCreate(sqliteStore, entityType, userId, clientId, data);
    await queryClient.invalidateQueries({ queryKey });
    runSync(userId);
  }

  async function remove(clientId: string) {
    if (!userId) return;
    await enqueueDelete(sqliteStore, entityType, clientId);
    await queryClient.invalidateQueries({ queryKey });
    runSync(userId);
  }

  return { data: query.data ?? [], isLoading: query.isLoading, create, remove };
}
