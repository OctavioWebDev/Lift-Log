import { SectionList } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { api } from "@/lib/api";
import type { Badge, BadgeCategory } from "@/lib/types";
import { screenStyles as styles } from "@/styles/screen";

const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  strength: "Strength Clubs",
  consistency: "Consistency",
  pr: "Personal Records",
};

export default function BadgesScreen() {
  const { data, isLoading } = useQuery({ queryKey: ["badges"], queryFn: () => api.badges.all() });

  const sections = (["strength", "consistency", "pr"] as BadgeCategory[])
    .map((category) => ({
      title: CATEGORY_LABELS[category],
      data: (data?.badges ?? []).filter((b) => b.category === category),
    }))
    .filter((s) => s.data.length > 0);

  return (
    <ThemedView style={styles.container}>
      {data && (
        <ThemedView style={styles.statCard}>
          <ThemedText style={styles.statValue}>
            {data.earnedCount}/{data.totalCount}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Badges Earned
          </ThemedText>
        </ThemedView>
      )}

      <SectionList<Badge>
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 8 }}
        ListEmptyComponent={!isLoading ? <ThemedText style={styles.empty}>No badges yet.</ThemedText> : null}
        renderSectionHeader={({ section }) => <ThemedText type="smallBold">{section.title}</ThemedText>}
        renderItem={({ item }) => {
          const earned = !!item.earnedAt;
          return (
            <ThemedView style={[styles.card, { opacity: earned ? 1 : 0.55, gap: 10 }]}>
              <ThemedText style={{ fontSize: 24 }}>{item.icon}</ThemedText>
              <ThemedView style={{ flex: 1 }}>
                <ThemedText style={styles.cardTitle}>{item.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.description}
                </ThemedText>
                {earned ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Earned {new Date(item.earnedAt!).toLocaleDateString()}
                  </ThemedText>
                ) : (
                  item.progress && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.progress.current} / {item.progress.target}
                    </ThemedText>
                  )
                )}
              </ThemedView>
            </ThemedView>
          );
        }}
      />
    </ThemedView>
  );
}
