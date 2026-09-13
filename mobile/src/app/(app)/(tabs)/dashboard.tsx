import { FlatList, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-context";
import type { WorkoutSet } from "@/lib/types";
import { screenStyles as styles } from "@/styles/screen";

function startOfWeek(): Date {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  return start;
}

export default function Dashboard() {
  const { signOut } = useSession();
  const { data: workouts, isLoading } = useQuery({
    queryKey: ["workout-sets", "all"],
    queryFn: api.workoutSets.all,
  });
  const { data: goals } = useQuery({ queryKey: ["goals"], queryFn: api.goals.all });

  const weekStart = startOfWeek();
  const workoutsThisWeek = (workouts ?? []).filter((w) => new Date(w.date) >= weekStart);
  const totalVolume = workoutsThisWeek.reduce((sum, w) => sum + w.sets * w.weight * w.reps, 0);
  const recent = (workouts ?? []).slice(0, 10);

  return (
    <ThemedView style={styles.container}>
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
          <ThemedText style={styles.statValue}>{goals?.length ?? 0}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Active Goals
          </ThemedText>
        </ThemedView>
      </ThemedView>

      <ThemedText type="smallBold">Recent Activity</ThemedText>
      <FlatList<WorkoutSet>
        data={recent}
        keyExtractor={(item) => String(item.id)}
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
