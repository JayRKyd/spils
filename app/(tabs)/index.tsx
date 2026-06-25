import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, useWindowDimensions } from "react-native";
import { SpilsLogo } from "../../components/SpilsLogo";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";

const NAV_ITEMS = [
  { label: "Journal",    path: "/(tabs)/journal"    },
  { label: "Collection", path: "/(tabs)/collection" },
  { label: "Lab",        path: "/(tabs)/formulas"   },
  { label: "Organ",      path: "/(tabs)/materials"  },
  { label: "Community",  path: "/(tabs)/community"  },
];

export default function Home() {
  const { user } = useAuth();
  const { width, height } = useWindowDimensions();
  const [selected, setSelected] = useState("/(tabs)/journal");

  return (
    <View style={s.container}>
      <Image
        source={require("../../assets/new_float_too.png")}
        style={{ position: "absolute", width, height }}
        resizeMode="cover"
      />
      <View style={[StyleSheet.absoluteFill as any, s.overlay]} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Top bar */}
        <View style={s.topBar}>
          <SpilsLogo height={22} color="#edff8d" />
          <TouchableOpacity style={s.profileBtn} onPress={() => router.push("/(tabs)/profile" as any)}>
            <Text style={s.profileIcon}>👤</Text>
          </TouchableOpacity>
        </View>

        {/* Nav list */}
        <View style={s.navList}>
          {NAV_ITEMS.map(({ label, path }) => (
            <TouchableOpacity
              key={path}
              onPress={() => { setSelected(path); router.push(path as any); }}
              activeOpacity={0.7}
              style={selected === path ? s.pill : undefined}
            >
              <Text style={s.navItem}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  overlay: { backgroundColor: "rgba(0,0,0,0.38)" },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8,
  },
  logo: { color: "#E5F772", fontSize: 22, fontWeight: "800", letterSpacing: 1 },
  profileBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center",
  },
  profileIcon: { fontSize: 16 },

  navList: { flex: 1, justifyContent: "center", paddingHorizontal: 28, gap: 4 },

  pill: {
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderColor: "#edff8d",
    borderRadius: 50,
    paddingHorizontal: 24,
    paddingVertical: 4,
  },
  navItem: { color: "#fff", fontSize: 44, fontWeight: "700", paddingVertical: 2 },
});
