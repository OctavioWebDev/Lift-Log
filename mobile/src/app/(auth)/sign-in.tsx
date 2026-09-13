import { useState } from "react";
import { ActivityIndicator, Pressable, TextInput } from "react-native";
import { Link } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useSession } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { authStyles as styles } from "@/styles/auth";

export default function SignIn() {
  const { signIn } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(username.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Chi-Rho Lifts
      </ThemedText>
      <ThemedText type="subtitle" style={styles.subtitle}>
        Sign in
      </ThemedText>

      <TextInput
        style={styles.input}
        placeholder="Username or email"
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      <Pressable
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        disabled={isSubmitting || !username || !password}
        onPress={handleSubmit}>
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.buttonText}>Sign In</ThemedText>}
      </Pressable>

      <Link href="/sign-up" style={styles.link}>
        <ThemedText themeColor="textSecondary">Need an account? Sign up</ThemedText>
      </Link>
    </ThemedView>
  );
}
