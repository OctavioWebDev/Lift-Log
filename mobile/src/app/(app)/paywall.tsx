import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useSession } from "@/lib/auth-context";
import { billing } from "@/lib/billing";

export default function Paywall() {
  const { signOut, refreshSubscriptionStatus } = useSession();
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The purchase itself (App Store / Stripe) completes before our server
  // finds out — RevenueCat's and Stripe's webhooks typically land within a
  // couple seconds, but aren't instant. Poll briefly rather than making the
  // user tap "Check Again" themselves for what's usually just a short wait;
  // once subscriptionStatus flips to active, the (app) layout's guard
  // navigates away from this screen on its own.
  async function pollForActivation() {
    for (let i = 0; i < 4; i++) {
      await refreshSubscriptionStatus();
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  async function handleSubscribe() {
    setError(null);
    setIsSubscribing(true);
    try {
      const result = await billing.subscribe();
      if (result.success) {
        await pollForActivation();
      } else if (result.message) {
        setError(result.message);
      }
    } finally {
      setIsSubscribing(false);
    }
  }

  async function handleRestore() {
    setError(null);
    setIsRestoring(true);
    try {
      const result = await billing.restorePurchases();
      if (result.success) {
        await refreshSubscriptionStatus();
      } else if (result.message) {
        setError(result.message);
      }
    } finally {
      setIsRestoring(false);
    }
  }

  async function handleCheckAgain() {
    setError(null);
    setIsChecking(true);
    try {
      await refreshSubscriptionStatus();
    } finally {
      setIsChecking(false);
    }
  }

  const busy = isSubscribing || isRestoring || isChecking;

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Subscribe to continue
      </ThemedText>
      <ThemedText style={styles.body}>
        Chi-Rho Lifts is a one-time purchase for lifetime access — track workouts, set goals, and log
        nutrition with no ongoing fee.
      </ThemedText>

      {error && <ThemedText style={styles.error}>{error}</ThemedText>}

      <Pressable style={styles.button} disabled={busy} onPress={handleSubscribe}>
        {isSubscribing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText style={styles.buttonText}>Subscribe</ThemedText>
        )}
      </Pressable>

      {Platform.OS === "ios" && (
        <Pressable disabled={busy} onPress={handleRestore} style={styles.secondaryLink}>
          {isRestoring ? (
            <ActivityIndicator />
          ) : (
            <ThemedText themeColor="textSecondary">Restore Purchases</ThemedText>
          )}
        </Pressable>
      )}

      <Pressable disabled={busy} onPress={handleCheckAgain} style={styles.secondaryLink}>
        {isChecking ? <ActivityIndicator /> : <ThemedText themeColor="textSecondary">Check Again</ThemedText>}
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
  error: {
    color: "#dc2626",
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
  secondaryLink: {
    alignSelf: "center",
  },
  signOut: {
    alignSelf: "center",
    marginTop: 8,
  },
});
