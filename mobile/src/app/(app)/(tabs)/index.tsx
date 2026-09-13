import { useState } from "react";
import { FlatList, Pressable, TextInput } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { SyncStatusBanner } from "@/components/sync-status-banner";
import { useSession } from "@/lib/auth-context";
import { useOfflineResource } from "@/lib/offline/use-offline-resource";
import { useRestTimer } from "@/lib/use-rest-timer";
import { scheduleLocalNotification } from "@/lib/notifications";
import { useHealthSyncSetting } from "@/lib/health/use-health-sync-setting";
import { healthSync } from "@/lib/health";
import { formatDisplayDate, shiftISODate, todayISODate } from "@/lib/date";
import type { Goal, WorkoutSet } from "@/lib/types";
import { screenStyles as styles } from "@/styles/screen";

const REST_SECONDS = 90;

export default function WorkoutLog() {
  const { user } = useSession();
  const [date, setDate] = useState(todayISODate());
  const { data: allWorkouts, isLoading, create, remove } = useOfflineResource<WorkoutSet>("workoutSets", user?.id);
  const { data: goals } = useOfflineResource<Goal>("goals", user?.id);
  const workouts = allWorkouts.filter((w) => w.date.startsWith(date));
  const restTimer = useRestTimer();
  const { enabled: healthSyncEnabled } = useHealthSyncSetting();

  const [exercise, setExercise] = useState("");
  const [sets, setSets] = useState("3");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState("");

  async function handleAdd() {
    if (!exercise.trim() || !weight || !reps) return;
    const weightNum = Number(weight);
    const setsNum = Number(sets) || 1;
    const repsNum = Number(reps);
    const exerciseName = exercise.trim();
    const setDate = new Date(`${date}T12:00:00.000Z`);

    await create({
      exercise: exerciseName,
      sets: setsNum,
      weight: weightNum,
      reps: repsNum,
      rpe: rpe ? Number(rpe) : undefined,
      date: setDate.toISOString(),
    });
    setExercise("");
    setWeight("");
    setReps("");
    setRpe("");

    restTimer.start(REST_SECONDS);

    if (healthSyncEnabled) {
      healthSync
        .syncWorkoutSet({ date: setDate, exercise: exerciseName, sets: setsNum, reps: repsNum, weight: weightNum })
        .catch((err) => console.warn("[health] failed to sync workout set:", err));
    }

    const matchingGoal = goals.find((g) => g.exercise.toLowerCase() === exerciseName.toLowerCase());
    if (matchingGoal && weightNum >= matchingGoal.target) {
      scheduleLocalNotification("New PR! 🎉", `You hit your ${exerciseName} goal of ${matchingGoal.target} ${matchingGoal.unit ?? "lbs"}!`);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SyncStatusBanner />
      <ThemedView style={styles.dateNav}>
        <Pressable style={styles.navButton} onPress={() => setDate((d) => shiftISODate(d, -1))}>
          <ThemedText>{"< Prev"}</ThemedText>
        </Pressable>
        <ThemedText type="smallBold">{formatDisplayDate(date)}</ThemedText>
        <Pressable style={styles.navButton} onPress={() => setDate((d) => shiftISODate(d, 1))}>
          <ThemedText>{"Next >"}</ThemedText>
        </Pressable>
      </ThemedView>

      {restTimer.secondsLeft !== null && (
        <ThemedView style={styles.restTimer}>
          <ThemedText type="smallBold">Resting: {restTimer.secondsLeft}s</ThemedText>
          <Pressable onPress={restTimer.cancel}>
            <ThemedText type="small" themeColor="textSecondary">
              Skip
            </ThemedText>
          </Pressable>
        </ThemedView>
      )}

      <FlatList<WorkoutSet & { clientId: string }>
        data={workouts}
        keyExtractor={(item) => item.clientId}
        contentContainerStyle={{ gap: 8 }}
        ListEmptyComponent={
          !isLoading ? <ThemedText style={styles.empty}>No sets logged for this day yet.</ThemedText> : null
        }
        renderItem={({ item }) => (
          <ThemedView style={styles.card}>
            <ThemedView>
              <ThemedText style={styles.cardTitle}>{item.exercise}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.sets} × {item.reps} @ {item.weight} lbs{item.rpe ? ` · RPE ${item.rpe}` : ""}
              </ThemedText>
            </ThemedView>
            <Pressable onPress={() => remove(item.clientId)}>
              <ThemedText style={styles.deleteText}>Delete</ThemedText>
            </Pressable>
          </ThemedView>
        )}
      />

      <ThemedView style={styles.form}>
        <TextInput style={styles.input} placeholder="Exercise" value={exercise} onChangeText={setExercise} />
        <ThemedView style={styles.row}>
          <TextInput
            style={styles.input}
            placeholder="Sets"
            keyboardType="number-pad"
            value={sets}
            onChangeText={setSets}
          />
          <TextInput
            style={styles.input}
            placeholder="Weight"
            keyboardType="decimal-pad"
            value={weight}
            onChangeText={setWeight}
          />
          <TextInput
            style={styles.input}
            placeholder="Reps"
            keyboardType="number-pad"
            value={reps}
            onChangeText={setReps}
          />
          <TextInput
            style={styles.input}
            placeholder="RPE"
            keyboardType="decimal-pad"
            value={rpe}
            onChangeText={setRpe}
          />
        </ThemedView>
        <Pressable style={styles.button} onPress={handleAdd}>
          <ThemedText style={styles.buttonText}>Add Set</ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}
