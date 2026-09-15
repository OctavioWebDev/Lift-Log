import { useState } from "react";
import { Image, Pressable, ScrollView, TextInput } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { api, API_URL } from "@/lib/api";
import { useSession } from "@/lib/auth-context";
import type { Profile } from "@/lib/types";
import { screenStyles as styles } from "@/styles/screen";

const SEX_OPTIONS: { value: string; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "prefer_not_to_say", label: "Rather not say" },
];

export default function ProfileScreen() {
  const { signOut } = useSession();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.profile.get().then((r) => r.user),
  });

  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  async function handlePickAvatar() {
    setAvatarError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      setAvatarError("Photo library access is required to set a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setIsUpdatingAvatar(true);
    try {
      await api.profile.uploadAvatar({
        uri: asset.uri,
        name: asset.fileName ?? "avatar.jpg",
        type: asset.mimeType ?? "image/jpeg",
      });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setIsUpdatingAvatar(false);
    }
  }

  async function handleRemoveAvatar() {
    setAvatarError(null);
    setIsUpdatingAvatar(true);
    try {
      await api.profile.removeAvatar();
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Failed to remove photo");
    } finally {
      setIsUpdatingAvatar(false);
    }
  }

  if (isLoading && !data) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading profile…</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <ThemedView style={styles.container}>
        <ThemedView style={{ alignItems: "center", gap: 8 }}>
          <Pressable onPress={handlePickAvatar} disabled={isUpdatingAvatar}>
            {data?.avatarUrl ? (
              <Image source={{ uri: `${API_URL}${data.avatarUrl}` }} style={avatarStyle} />
            ) : (
              <ThemedView style={[avatarStyle, styles.card, { alignItems: "center", justifyContent: "center" }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  Add Photo
                </ThemedText>
              </ThemedView>
            )}
          </Pressable>
          <ThemedView style={styles.row}>
            <Pressable onPress={handlePickAvatar} disabled={isUpdatingAvatar}>
              <ThemedText type="linkPrimary">{isUpdatingAvatar ? "Working…" : "Change Photo"}</ThemedText>
            </Pressable>
            {data?.avatarUrl && (
              <Pressable onPress={handleRemoveAvatar} disabled={isUpdatingAvatar}>
                <ThemedText type="link" style={styles.deleteText}>
                  Remove
                </ThemedText>
              </Pressable>
            )}
          </ThemedView>
          {avatarError && <ThemedText style={styles.deleteText}>{avatarError}</ThemedText>}
        </ThemedView>

        {/* Keyed on the profile id so the form's local state initializes fresh
            from server data exactly once, instead of syncing via an effect. */}
        {data && <ProfileForm key={data.id} initial={data} />}

        <Pressable onPress={signOut} style={{ alignSelf: "center", marginTop: 8 }}>
          <ThemedText type="small" themeColor="textSecondary">
            Sign Out
          </ThemedText>
        </Pressable>
      </ThemedView>
    </ScrollView>
  );
}

function ProfileForm({ initial }: { initial: Profile }) {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState(initial.username);
  const [email, setEmail] = useState(initial.email ?? "");
  const [fullName, setFullName] = useState(initial.fullName ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(initial.dateOfBirth ? initial.dateOfBirth.split("T")[0] : "");
  const [sex, setSex] = useState<string | null>(initial.sex);
  const [bodyweight, setBodyweight] = useState(initial.bodyweight != null ? String(initial.bodyweight) : "");
  const [heightInches, setHeightInches] = useState(initial.heightInches != null ? String(initial.heightInches) : "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    setError(null);
    setSuccess(false);
    setIsSaving(true);
    try {
      await api.profile.update({
        username,
        email: email || null,
        fullName: fullName || null,
        dateOfBirth: dateOfBirth || null,
        sex,
        bodyweight: bodyweight ? Number(bodyweight) : null,
        heightInches: heightInches ? Number(heightInches) : null,
      });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <ThemedText type="smallBold">Account</ThemedText>
      <ThemedView style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </ThemedView>

      <ThemedText type="smallBold">Lifter Profile</ThemedText>
      <ThemedView style={styles.form}>
        <TextInput style={styles.input} placeholder="Full name" value={fullName} onChangeText={setFullName} />
        <TextInput
          style={styles.input}
          placeholder="Date of birth (YYYY-MM-DD)"
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
        />
        <ThemedView style={styles.row}>
          {SEX_OPTIONS.map((opt) => {
            const selected = sex === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[styles.button, { flex: 1 }, !selected && { backgroundColor: "#e5e7eb" }]}
                onPress={() => setSex(selected ? null : opt.value)}>
                <ThemedText style={[styles.buttonText, !selected && { color: "#111827" }]}>{opt.label}</ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>
        <ThemedView style={styles.row}>
          <TextInput
            style={styles.input}
            placeholder="Bodyweight (lbs)"
            keyboardType="decimal-pad"
            value={bodyweight}
            onChangeText={setBodyweight}
          />
          <TextInput
            style={styles.input}
            placeholder="Height (inches)"
            keyboardType="decimal-pad"
            value={heightInches}
            onChangeText={setHeightInches}
          />
        </ThemedView>
      </ThemedView>

      {error && <ThemedText style={styles.deleteText}>{error}</ThemedText>}
      {success && (
        <ThemedText type="small" themeColor="textSecondary">
          Profile updated.
        </ThemedText>
      )}

      <Pressable style={[styles.button, isSaving && styles.buttonDisabled]} onPress={handleSave} disabled={isSaving}>
        <ThemedText style={styles.buttonText}>{isSaving ? "Saving…" : "Save Profile"}</ThemedText>
      </Pressable>
    </>
  );
}

const avatarStyle = { width: 96, height: 96, borderRadius: 48 };
