import { useState } from "react";
import { Pressable, ScrollView, TextInput } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { api } from "@/lib/api";
import type { MeetPrep, MeetPrepEntry, MeetPrepType } from "@/lib/types";
import { screenStyles as styles } from "@/styles/screen";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MeetPrepScreen() {
  const queryClient = useQueryClient();
  const { data: config } = useQuery({ queryKey: ["meetPrepConfig"], queryFn: () => api.meetPrep.config() });
  const { data: plans, isLoading } = useQuery({
    queryKey: ["meetPreps"],
    queryFn: () => api.meetPrep.list().then((r) => r.plans),
  });

  const [showForm, setShowForm] = useState(false);
  const [planType, setPlanType] = useState<MeetPrepType>("premade");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [trainingDays, setTrainingDays] = useState<Set<number>>(new Set());
  const [weeks, setWeeks] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [squatMax, setSquatMax] = useState("");
  const [benchMax, setBenchMax] = useState("");
  const [deadliftMax, setDeadliftMax] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sets, setSets] = useState("5");
  const [reps, setReps] = useState("5");
  const [squatWeight, setSquatWeight] = useState("");
  const [benchWeight, setBenchWeight] = useState("");
  const [deadliftWeight, setDeadliftWeight] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [entriesByPlan, setEntriesByPlan] = useState<Record<number, MeetPrepEntry[]>>({});
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);

  function toggleDay(day: number) {
    setTrainingDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function resetForm() {
    setName("");
    setStartDate("");
    setTrainingDays(new Set());
    setWeeks(null);
    setTemplateId(null);
    setSquatMax("");
    setBenchMax("");
    setDeadliftMax("");
    setEndDate("");
    setSquatWeight("");
    setBenchWeight("");
    setDeadliftWeight("");
    setShowForm(false);
  }

  async function handleCreate() {
    setError(null);
    setIsSubmitting(true);
    try {
      const base = {
        planType,
        name: name.trim() || undefined,
        startDate,
        trainingDays: Array.from(trainingDays),
      };
      const payload =
        planType === "premade"
          ? { ...base, weeks, squatMax: Number(squatMax), benchMax: Number(benchMax), deadliftMax: Number(deadliftMax) }
          : planType === "template"
            ? { ...base, templateId, squatMax: Number(squatMax), benchMax: Number(benchMax), deadliftMax: Number(deadliftMax) }
            : {
                ...base,
                endDate,
                sets: Number(sets),
                reps: Number(reps),
                squatWeight: Number(squatWeight),
                benchWeight: Number(benchWeight),
                deadliftWeight: Number(deadliftWeight),
              };
      await api.meetPrep.create(payload);
      await queryClient.invalidateQueries({ queryKey: ["meetPreps"] });
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create plan");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    await api.meetPrep.remove(id);
    setEntriesByPlan((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (expandedId === id) setExpandedId(null);
    await queryClient.invalidateQueries({ queryKey: ["meetPreps"] });
  }

  async function toggleExpand(plan: MeetPrep) {
    if (expandedId === plan.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(plan.id);
    if (entriesByPlan[plan.id]) return;
    setIsLoadingEntries(true);
    try {
      const { entries } = await api.meetPrep.detail(plan.id);
      setEntriesByPlan((prev) => ({ ...prev, [plan.id]: entries }));
    } catch {
      // leave it empty — the card just won't show entries this time
    } finally {
      setIsLoadingEntries(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <ThemedView style={styles.container}>
        <ThemedView style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <ThemedText type="smallBold">Your Plans</ThemedText>
          <Pressable onPress={() => setShowForm((v) => !v)}>
            <ThemedText type="linkPrimary">{showForm ? "Cancel" : "New Plan"}</ThemedText>
          </Pressable>
        </ThemedView>

        {!isLoading && (!plans || plans.length === 0) && (
          <ThemedText style={styles.empty}>No meet prep plans yet.</ThemedText>
        )}

        {plans?.map((plan) => (
          <ThemedView key={plan.id} style={{ gap: 8 }}>
            <Pressable onPress={() => toggleExpand(plan)}>
              <ThemedView style={styles.card}>
                <ThemedView>
                  <ThemedText style={styles.cardTitle}>{plan.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {plan.weeks} weeks · {new Date(plan.startDate).toLocaleDateString()} –{" "}
                    {new Date(plan.endDate).toLocaleDateString()}
                  </ThemedText>
                </ThemedView>
                <Pressable onPress={() => handleDelete(plan.id)}>
                  <ThemedText style={styles.deleteText}>Delete</ThemedText>
                </Pressable>
              </ThemedView>
            </Pressable>

            {expandedId === plan.id && (
              <ThemedView style={{ gap: 6, paddingLeft: 12 }}>
                {isLoadingEntries && !entriesByPlan[plan.id] ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Loading…
                  </ThemedText>
                ) : (
                  (entriesByPlan[plan.id] ?? []).map((entry) => (
                    <ThemedView key={entry.id} style={styles.card}>
                      <ThemedView>
                        <ThemedText style={styles.cardTitle}>{entry.exercise}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {entry.sets} × {entry.reps} @ {entry.weight} lbs
                          {entry.rpe ? ` · RPE ${entry.rpe}` : ""}
                        </ThemedText>
                      </ThemedView>
                      <ThemedText type="small" themeColor="textSecondary">
                        {new Date(entry.date).toLocaleDateString()}
                      </ThemedText>
                    </ThemedView>
                  ))
                )}
              </ThemedView>
            )}
          </ThemedView>
        ))}

        {showForm && (
          <ThemedView style={styles.form}>
            <ThemedView style={styles.row}>
              {(["premade", "template", "custom"] as MeetPrepType[]).map((t) => {
                const selected = planType === t;
                return (
                  <Pressable
                    key={t}
                    style={[styles.button, { flex: 1 }, !selected && { backgroundColor: "#e5e7eb" }]}
                    onPress={() => setPlanType(t)}>
                    <ThemedText style={[styles.buttonText, !selected && { color: "#111827" }]}>
                      {t === "premade" ? "Premade" : t === "template" ? "Template" : "Custom"}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ThemedView>

            <TextInput style={styles.input} placeholder="Plan name (optional)" value={name} onChangeText={setName} />
            <TextInput
              style={styles.input}
              placeholder="Start date (YYYY-MM-DD)"
              value={startDate}
              onChangeText={setStartDate}
            />

            <ThemedText type="small" themeColor="textSecondary">
              Training days
            </ThemedText>
            <ThemedView style={styles.row}>
              {WEEKDAY_LABELS.map((label, day) => {
                const selected = trainingDays.has(day);
                return (
                  <Pressable
                    key={day}
                    style={[
                      styles.button,
                      { flex: 1, paddingHorizontal: 4 },
                      !selected && { backgroundColor: "#e5e7eb" },
                    ]}
                    onPress={() => toggleDay(day)}>
                    <ThemedText style={[styles.buttonText, !selected && { color: "#111827" }]}>{label}</ThemedText>
                  </Pressable>
                );
              })}
            </ThemedView>

            {planType === "premade" && (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  Duration
                </ThemedText>
                <ThemedView style={styles.row}>
                  {(config?.premadeDurations ?? [4, 8, 12, 16]).map((w) => {
                    const selected = weeks === w;
                    return (
                      <Pressable
                        key={w}
                        style={[styles.button, { flex: 1 }, !selected && { backgroundColor: "#e5e7eb" }]}
                        onPress={() => setWeeks(w)}>
                        <ThemedText style={[styles.buttonText, !selected && { color: "#111827" }]}>{w}wk</ThemedText>
                      </Pressable>
                    );
                  })}
                </ThemedView>
                <TextInput
                  style={styles.input}
                  placeholder="Current Squat 1RM"
                  keyboardType="decimal-pad"
                  value={squatMax}
                  onChangeText={setSquatMax}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Current Bench 1RM"
                  keyboardType="decimal-pad"
                  value={benchMax}
                  onChangeText={setBenchMax}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Current Deadlift 1RM"
                  keyboardType="decimal-pad"
                  value={deadliftMax}
                  onChangeText={setDeadliftMax}
                />
              </>
            )}

            {planType === "template" && (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  Template
                </ThemedText>
                <ThemedView style={{ gap: 8 }}>
                  {(config?.templates ?? []).map((t) => {
                    const selected = templateId === t.id;
                    return (
                      <Pressable
                        key={t.id}
                        style={[styles.card, { alignItems: "flex-start" }, selected && { borderColor: "#212529" }]}
                        onPress={() => setTemplateId(t.id)}>
                        <ThemedView style={{ flex: 1 }}>
                          <ThemedText style={styles.cardTitle}>{t.name}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {t.description}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {t.weeks} weeks · {t.daysPerWeek} days/week
                          </ThemedText>
                        </ThemedView>
                        <ThemedText>{selected ? "●" : "○"}</ThemedText>
                      </Pressable>
                    );
                  })}
                </ThemedView>
                {templateId && (
                  <ThemedText type="small" themeColor="textSecondary">
                    Select exactly {config?.templates.find((t) => t.id === templateId)?.daysPerWeek} training days
                    above.
                  </ThemedText>
                )}
                <TextInput
                  style={styles.input}
                  placeholder="Current Squat 1RM"
                  keyboardType="decimal-pad"
                  value={squatMax}
                  onChangeText={setSquatMax}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Current Bench 1RM"
                  keyboardType="decimal-pad"
                  value={benchMax}
                  onChangeText={setBenchMax}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Current Deadlift 1RM"
                  keyboardType="decimal-pad"
                  value={deadliftMax}
                  onChangeText={setDeadliftMax}
                />
              </>
            )}

            {planType === "custom" && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Finish date (YYYY-MM-DD)"
                  value={endDate}
                  onChangeText={setEndDate}
                />
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
                    placeholder="Reps"
                    keyboardType="number-pad"
                    value={reps}
                    onChangeText={setReps}
                  />
                </ThemedView>
                <TextInput
                  style={styles.input}
                  placeholder="Squat starting weight"
                  keyboardType="decimal-pad"
                  value={squatWeight}
                  onChangeText={setSquatWeight}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Bench starting weight"
                  keyboardType="decimal-pad"
                  value={benchWeight}
                  onChangeText={setBenchWeight}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Deadlift starting weight"
                  keyboardType="decimal-pad"
                  value={deadliftWeight}
                  onChangeText={setDeadliftWeight}
                />
              </>
            )}

            {error && <ThemedText style={styles.deleteText}>{error}</ThemedText>}

            <Pressable
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              onPress={handleCreate}
              disabled={isSubmitting}>
              <ThemedText style={styles.buttonText}>{isSubmitting ? "Creating…" : "Create Plan"}</ThemedText>
            </Pressable>
          </ThemedView>
        )}
      </ThemedView>
    </ScrollView>
  );
}
