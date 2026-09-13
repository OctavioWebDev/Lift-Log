import { FlatList, Pressable, Switch } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { SyncStatusBanner } from "@/components/sync-status-banner";
import { useSession } from "@/lib/auth-context";
import { useOfflineResource } from "@/lib/offline/use-offline-resource";
import { useHealthSyncSetting } from "@/lib/health/use-health-sync-setting";
import type { Goal, WorkoutSet } from "@/lib/types";
import { screenStyles as styles } from "@/styles/screen";

function startOfWeek(): Date {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  return start;
}

export default function Dashboard() {
  const { user, signOut } = useSession();
  const { data: workouts, isLoading } = useOfflineResource<WorkoutSet>("workoutSets", user?.id);
  const { data: goals } = useOfflineResource<Goal>("goals", user?.id);
  const health = useHealthSyncSetting();

  const weekStart = startOfWeek();
  const workoutsThisWeek = workouts.filter((w) => new Date(w.date) >= weekStart);
  const totalVolume = workoutsThisWeek.reduce((sum, w) => sum + w.sets * w.weight * w.reps, 0);
  const recent = [...workouts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);

  return (
    <ThemedView style={styles.container}>
      <SyncStatusBanner />
      <Pressable onPress={signOut} style={{ alignSelf: "flex-end" }}>
        <ThemedText type="small" themeColor="textSecondary">
          Sign Out
        </ThemedText>
      </Pressable>

      <ThemedView style={styles.statsRow}>
        <ThemedView style={styles.statCard}>
          <ThemedText style={styles.statValue}>{workoutsThisWeek.length}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            This Week
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.statCard}>
          <ThemedText style={styles.statValue}>{totalVolume.toLocaleString()}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Volume (lbs)
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.statCard}>
          <ThemedText style={styles.statValue}>{goals.length}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Active Goals
          </ThemedText>
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.card}>
        <ThemedView>
          <ThemedText style={styles.cardTitle}>Sync to {health.label}</ThemedText>
          {health.unavailable && (
            <ThemedText type="small" themeColor="textSecondary">
              Not available on this device
            </ThemedText>
          )}
        </ThemedView>
        <Switch
          value={health.enabled}
          onValueChange={(next) => void health.setEnabled(next)}
          disabled={health.unavailable}
        />
      </ThemedView>

      <ThemedText type="smallBold">Recent Activity</ThemedText>
      <FlatList<WorkoutSet & { clientId: string }>
        data={recent}
        keyExtractor={(item) => item.clientId}
        contentContainerStyle={{ gap: 8 }}
        ListEmptyComponent={
          !isLoading ? <ThemedText style={styles.empty}>No workouts logged yet.</ThemedText> : null
        }
        renderItem={({ item }) => (
          <ThemedView style={styles.card}>
            <ThemedView>
              <ThemedText style={styles.cardTitle}>{item.exercise}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.sets} × {item.reps} @ {item.weight} lbs
              </ThemedText>
            </ThemedView>
            <ThemedText type="small" themeColor="textSecondary">
              {new Date(item.date).toLocaleDateString()}
            </ThemedText>
          </ThemedView>
        )}
      />
    </ThemedView>
  );
}
