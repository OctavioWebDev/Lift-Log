import { useState } from "react";
import { FlatList, Pressable, TextInput } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { api } from "@/lib/api";
import { formatDisplayDate, shiftISODate, todayISODate } from "@/lib/date";
import type { WorkoutSet } from "@/lib/types";
import { screenStyles as styles } from "@/styles/screen";

export default function WorkoutLog() {
  const [date, setDate] = useState(todayISODate());
  const queryClient = useQueryClient();

  const { data: workouts, isLoading } = useQuery({
    queryKey: ["workout-sets", date],
    queryFn: () => api.workoutSets.forDate(date),
  });

  const createMutation = useMutation({
    mutationFn: api.workoutSets.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workout-sets", date] }),
  });

  const deleteMutation = useMutation({
    mutationFn: api.workoutSets.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workout-sets", date] }),
  });

  const [exercise, setExercise] = useState("");
  const [sets, setSets] = useState("3");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState("");

  function handleAdd() {
    if (!exercise.trim() || !weight || !reps) return;
    createMutation.mutate(
      {
        exercise: exercise.trim(),
        sets: Number(sets) || 1,
        weight: Number(weight),
        reps: Number(reps),
        rpe: rpe ? Number(rpe) : undefined,
        date: `${date}T12:00:00.000Z`,
      },
      {
        onSuccess: () => {
          setExercise("");
          setWeight("");
          setReps("");
          setRpe("");
        },
      }
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.dateNav}>
        <Pressable style={styles.navButton} onPress={() => setDate((d) => shiftISODate(d, -1))}>
          <ThemedText>{"< Prev"}</ThemedText>
        </Pressable>
        <ThemedText type="smallBold">{formatDisplayDate(date)}</ThemedText>
        <Pressable style={styles.navButton} onPress={() => setDate((d) => shiftISODate(d, 1))}>
          <ThemedText>{"Next >"}</ThemedText>
        </Pressable>
      </ThemedView>

      <FlatList<WorkoutSet>
        data={workouts ?? []}
        keyExtractor={(item) => String(item.id)}
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
            <Pressable onPress={() => deleteMutation.mutate(item.id)}>
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
        <Pressable
          style={[styles.button, createMutation.isPending && styles.buttonDisabled]}
          disabled={createMutation.isPending}
          onPress={handleAdd}>
          <ThemedText style={styles.buttonText}>Add Set</ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}
