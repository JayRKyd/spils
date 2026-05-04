import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthContext";
import Toast from "react-native-toast-message";

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="collection/[id]" options={{ presentation: "card" }} />
          <Stack.Screen name="formula/[id]" options={{ presentation: "card" }} />
          <Stack.Screen name="journal/[id]" options={{ presentation: "card" }} />
          <Stack.Screen name="marketplace" options={{ presentation: "card" }} />
          <Stack.Screen name="profile/index" options={{ presentation: "card" }} />
          <Stack.Screen name="profile/listings" options={{ presentation: "card" }} />
          <Stack.Screen name="profile/messages" options={{ presentation: "card" }} />
          <Stack.Screen name="profile/watchlist" options={{ presentation: "card" }} />
          <Stack.Screen name="profile/conversation/[listingId]/[userId]" options={{ presentation: "card" }} />
        </Stack>
        <Toast />
      </AuthProvider>
    </QueryClientProvider>
  );
}
