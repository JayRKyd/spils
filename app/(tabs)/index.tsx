import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import GradientScreen from "@/components/GradientScreen";
import { GlassRow } from "@/components/GlassCard";

const QUICK_LINKS = [
  { label: "Materials", emoji: "🧪", path: "/(tabs)/materials", desc: "Your ingredient library" },
  { label: "Lab", emoji: "⚗️", path: "/(tabs)/formulas", desc: "Formula projects" },
  { label: "Collection", emoji: "🌸", path: "/(tabs)/collection", desc: "Your perfume collection" },
  { label: "Journal", emoji: "📓", path: "/(tabs)/journal", desc: "Scent diary & reviews" },
  { label: "Community", emoji: "💬", path: "/(tabs)/community", desc: "Forum, news & glossary" },
  { label: "Marketplace", emoji: "🛒", path: "/marketplace", desc: "Buy, sell & trade" },
];

export default function Home() {
  const { user } = useAuth();
  const displayName = user?.email?.split("@")[0] ?? "there";

  return (
    <GradientScreen gradient="default">
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Good day,</Text>
          <Text style={styles.name}>{displayName}</Text>
        </View>

        <Text style={styles.sectionLabel}>Quick Access</Text>

        <View style={styles.list}>
          {QUICK_LINKS.map(({ label, emoji, path, desc }) => (
            <TouchableOpacity
              key={path}
              onPress={() => router.push(path as any)}
              activeOpacity={0.75}
            >
              <GlassRow style={styles.row}>
                <Text style={styles.emoji}>{emoji}</Text>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{label}</Text>
                  <Text style={styles.rowDesc}>{desc}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </GlassRow>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 40 },
  header: { marginTop: 16, marginBottom: 32 },
  greeting: { color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 2 },
  name: { color: "#ffffff", fontSize: 30, fontWeight: "700" },
  sectionLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  list: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, gap: 14 },
  emoji: { fontSize: 22 },
  rowText: { flex: 1 },
  rowLabel: { color: "#ffffff", fontWeight: "600", fontSize: 15 },
  rowDesc: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 1 },
  chevron: { color: "rgba(255,255,255,0.3)", fontSize: 20 },
});
