import { useState } from "react";
import { FlatList, Pressable, TextInput } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { api } from "@/lib/api";
import type { Goal } from "@/lib/types";
import { screenStyles as styles } from "@/styles/screen";

export default function Goals() {
  const queryClient = useQueryClient();
  const { data: goals, isLoading } = useQuery({ queryKey: ["goals"], queryFn: api.goals.all });

  const createMutation = useMutation({
    mutationFn: api.goals.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: api.goals.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });

  const [exercise, setExercise] = useState("");
  const [current, setCurrent] = useState("");
  const [target, setTarget] = useState("");

  function handleAdd() {
    if (!exercise.trim() || !current || !target) return;
    createMutation.mutate(
      { exercise: exercise.trim(), current: Number(current), target: Number(target) },
      {
        onSuccess: () => {
          setExercise("");
          setCurrent("");
          setTarget("");
        },
      }
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList<Goal>
        data={goals ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ gap: 8 }}
        ListEmptyComponent={!isLoading ? <ThemedText style={styles.empty}>No goals set yet.</ThemedText> : null}
        renderItem={({ item }) => {
          const progress = item.target > item.current ? item.current / item.target : 1;
          return (
            <ThemedView style={styles.card}>
              <ThemedView>
                <ThemedText style={styles.cardTitle}>{item.exercise}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.current} / {item.target} {item.unit} ({Math.round(progress * 100)}%)
                </ThemedText>
              </ThemedView>
              <Pressable onPress={() => deleteMutation.mutate(item.id)}>
                <ThemedText style={styles.deleteText}>Delete</ThemedText>
              </Pressable>
            </ThemedView>
          );
        }}
      />

      <ThemedView style={styles.form}>
        <TextInput style={styles.input} placeholder="Exercise" value={exercise} onChangeText={setExercise} />
        <ThemedView style={styles.row}>
          <TextInput
            style={styles.input}
            placeholder="Current"
            keyboardType="decimal-pad"
            value={current}
            onChangeText={setCurrent}
          />
          <TextInput
            style={styles.input}
            placeholder="Target"
            keyboardType="decimal-pad"
            value={target}
            onChangeText={setTarget}
          />
        </ThemedView>
        <Pressable
          style={[styles.button, createMutation.isPending && styles.buttonDisabled]}
          disabled={createMutation.isPending}
          onPress={handleAdd}>
          <ThemedText style={styles.buttonText}>Add Goal</ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}
