import { useState } from "react";
import { FlatList, Pressable, TextInput } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { SyncStatusBanner } from "@/components/sync-status-banner";
import { useSession } from "@/lib/auth-context";
import { useOfflineResource } from "@/lib/offline/use-offline-resource";
import type { Goal } from "@/lib/types";
import { screenStyles as styles } from "@/styles/screen";

export default function Goals() {
  const { user } = useSession();
  const { data: goals, isLoading, create, remove } = useOfflineResource<Goal>("goals", user?.id);

  const [exercise, setExercise] = useState("");
  const [current, setCurrent] = useState("");
  const [target, setTarget] = useState("");

  async function handleAdd() {
    if (!exercise.trim() || !current || !target) return;
    await create({ exercise: exercise.trim(), current: Number(current), target: Number(target) });
    setExercise("");
    setCurrent("");
    setTarget("");
  }

  return (
    <ThemedView style={styles.container}>
      <SyncStatusBanner />
      <FlatList<Goal & { clientId: string }>
        data={goals}
        keyExtractor={(item) => item.clientId}
        contentContainerStyle={{ gap: 8 }}
        ListEmptyComponent={!isLoading ? <ThemedText style={styles.empty}>No goals set yet.</ThemedText> : null}
        renderItem={({ item }) => {
          const progress = item.target > item.current ? item.current / item.target : 1;
          return (
            <ThemedView style={styles.card}>
              <ThemedView>
                <ThemedText style={styles.cardTitle}>{item.exercise}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.current} / {item.target} {item.unit ?? "lbs"} ({Math.round(progress * 100)}%)
                </ThemedText>
              </ThemedView>
              <Pressable onPress={() => remove(item.clientId)}>
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
        <Pressable style={styles.button} onPress={handleAdd}>
          <ThemedText style={styles.buttonText}>Add Goal</ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}
