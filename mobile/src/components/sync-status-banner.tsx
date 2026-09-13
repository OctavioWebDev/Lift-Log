import { StyleSheet } from "react-native";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";
import { useSyncStatus } from "@/lib/offline/sync-provider";

// Quiet by default — only shows up when there's something the user should know:
// no connection, or local changes still waiting to reach the server.
export function SyncStatusBanner() {
  const { isOnline, pendingCount } = useSyncStatus();
  if (isOnline && pendingCount === 0) return null;

  return (
    <ThemedView style={[styles.banner, !isOnline ? styles.offline : styles.pending]}>
      <ThemedText type="small" style={styles.text}>
        {!isOnline
          ? "Offline — changes will sync when you're back online"
          : `Syncing ${pendingCount} change${pendingCount === 1 ? "" : "s"}…`}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  offline: {
    backgroundColor: "#fef3c7",
  },
  pending: {
    backgroundColor: "#dbeafe",
  },
  text: {
    textAlign: "center",
  },
});
