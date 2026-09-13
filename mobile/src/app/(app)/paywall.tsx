import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useSession } from "@/lib/auth-context";

// Native in-app-purchase billing is a later phase (see Phase 5 of the mobile rebuild
// plan). For now, subscribing happens on the web app; this screen just lets the user
// re-check their status after doing that, or sign out.
export default function Paywall() {
  const { signOut, refreshSubscriptionStatus } = useSession();
  const [isChecking, setIsChecking] = useState(false);

  async function handleCheckAgain() {
    setIsChecking(true);
    try {
      await refreshSubscriptionStatus();
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Subscribe to continue
      </ThemedText>
      <ThemedText style={styles.body}>
        Chi-Rho Lifts requires an active subscription. Head to chirhostrength.com/billing on the web to
        subscribe, then check again here.
      </ThemedText>

      <Pressable style={styles.button} disabled={isChecking} onPress={handleCheckAgain}>
        {isChecking ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.buttonText}>Check Again</ThemedText>}
      </Pressable>

      <Pressable onPress={signOut} style={styles.signOut}>
        <ThemedText themeColor="textSecondary">Sign Out</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 16,
  },
  title: {
    textAlign: "center",
    fontSize: 28,
    lineHeight: 34,
  },
  body: {
    textAlign: "center",
  },
  button: {
    backgroundColor: "#212529",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  signOut: {
    alignSelf: "center",
    marginTop: 8,
  },
});
