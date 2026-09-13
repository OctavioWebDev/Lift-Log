import { useState } from "react";
import { FlatList, Pressable, TextInput } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { api } from "@/lib/api";
import { todayISODate } from "@/lib/date";
import type { FoodSearchResult, NutritionLog } from "@/lib/types";
import { screenStyles as styles } from "@/styles/screen";

export default function Nutrition() {
  const date = todayISODate();
  const queryClient = useQueryClient();

  const { data: logs, isLoading } = useQuery({
    queryKey: ["nutrition", date],
    queryFn: () => api.nutrition.forDate(date),
  });

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const createMutation = useMutation({
    mutationFn: api.nutrition.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nutrition", date] }),
  });
  const deleteMutation = useMutation({
    mutationFn: api.nutrition.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["nutrition", date] }),
  });

  async function handleSearch() {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      setResults(await api.foodSearch(query.trim()));
    } finally {
      setIsSearching(false);
    }
  }

  function handleLog(food: FoodSearchResult) {
    createMutation.mutate(
      {
        date: `${date}T12:00:00.000Z`,
        foodName: food.name,
        brandName: food.brand || undefined,
        servingSize: 1,
        servingUnit: "serving",
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
      },
      { onSuccess: () => setResults([]) }
    );
  }

  const totals = (logs ?? []).reduce(
    (acc, l) => ({
      calories: acc.calories + l.calories,
      protein: acc.protein + l.protein,
      carbs: acc.carbs + l.carbs,
      fat: acc.fat + l.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.statsRow}>
        <ThemedView style={styles.statCard}>
          <ThemedText style={styles.statValue}>{Math.round(totals.calories)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Calories
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.statCard}>
          <ThemedText style={styles.statValue}>{Math.round(totals.protein)}g</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Protein
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.statCard}>
          <ThemedText style={styles.statValue}>{Math.round(totals.carbs)}g</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Carbs
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.statCard}>
          <ThemedText style={styles.statValue}>{Math.round(totals.fat)}g</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Fat
          </ThemedText>
        </ThemedView>
      </ThemedView>

      <FlatList<NutritionLog>
        data={logs ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ gap: 8 }}
        ListEmptyComponent={!isLoading ? <ThemedText style={styles.empty}>No food logged today.</ThemedText> : null}
        renderItem={({ item }) => (
          <ThemedView style={styles.card}>
            <ThemedView>
              <ThemedText style={styles.cardTitle}>{item.foodName}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {Math.round(item.calories)} cal · {Math.round(item.protein)}p / {Math.round(item.carbs)}c /{" "}
                {Math.round(item.fat)}f
              </ThemedText>
            </ThemedView>
            <Pressable onPress={() => deleteMutation.mutate(item.id)}>
              <ThemedText style={styles.deleteText}>Delete</ThemedText>
            </Pressable>
          </ThemedView>
        )}
      />

      <ThemedView style={styles.form}>
        <ThemedView style={styles.row}>
          <TextInput
            style={styles.input}
            placeholder="Search food..."
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
          />
          <Pressable style={[styles.button, { paddingHorizontal: 16 }]} onPress={handleSearch} disabled={isSearching}>
            <ThemedText style={styles.buttonText}>{isSearching ? "..." : "Search"}</ThemedText>
          </Pressable>
        </ThemedView>

        {results.length > 0 && (
          <FlatList<FoodSearchResult>
            data={results}
            keyExtractor={(item, idx) => `${item.name}-${idx}`}
            style={{ maxHeight: 220 }}
            contentContainerStyle={{ gap: 6 }}
            renderItem={({ item }) => (
              <Pressable style={styles.card} onPress={() => handleLog(item)}>
                <ThemedView>
                  <ThemedText style={styles.cardTitle}>{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.brand ? `${item.brand} · ` : ""}
                    {item.calories} cal per serving
                  </ThemedText>
                </ThemedView>
                <ThemedText type="small">Add</ThemedText>
              </Pressable>
            )}
          />
        )}
      </ThemedView>
    </ThemedView>
  );
}
