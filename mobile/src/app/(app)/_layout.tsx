import { Stack } from "expo-router";
import { useSession } from "@/lib/auth-context";

export default function AppLayout() {
  const { subscriptionStatus } = useSession();
  const isSubscribed = subscriptionStatus === "active";

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isSubscribed}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>

      <Stack.Protected guard={!isSubscribed}>
        <Stack.Screen name="paywall" />
      </Stack.Protected>
    </Stack>
  );
}
