import { useState } from "react";
import { ActivityIndicator, Pressable, TextInput } from "react-native";
import { Link } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useSession } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { authStyles as styles } from "@/styles/auth";

export default function SignUp() {
  const { signUp } = useSession();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setIsSubmitting(true);
    try {
      await signUp(username.trim(), password, email.trim() || undefined);
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
        Create your account
      </ThemedText>

      <TextInput
        style={styles.input}
        placeholder="Username"
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Email (optional)"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      <Pressable
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        disabled={isSubmitting || !username || !password || !confirmPassword}
        onPress={handleSubmit}>
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText style={styles.buttonText}>Sign Up</ThemedText>
        )}
      </Pressable>

      <Link href="/sign-in" style={styles.link}>
        <ThemedText themeColor="textSecondary">Already have an account? Sign in</ThemedText>
      </Link>
    </ThemedView>
  );
}
