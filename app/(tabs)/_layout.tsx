import { Tabs } from "expo-router";
import { router } from "expo-router";
import { Text, View, TouchableOpacity, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Icons ────────────────────────────────────────────────────────────────────

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.75 }}>{emoji}</Text>;
}

// ─── Custom Floating Pill Bar ─────────────────────────────────────────────────

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[tb.wrapper, { paddingBottom: insets.bottom + 8 }]}>
      <View style={tb.row}>
        <BlurView intensity={80} tint="light" style={tb.pill}>
          <View style={tb.pillOverlay} />
          {state.routes.map((route, index) => {
            if (["community", "profile"].includes(route.name)) return null;
            const { options } = descriptors[route.key];
            const focused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <TouchableOpacity
                key={route.key}
                style={[tb.iconBtn, focused && tb.iconBtnActive]}
                onPress={onPress}
                activeOpacity={0.75}
              >
                {options.tabBarIcon?.({ focused, color: "#fff", size: 18 })}
              </TouchableOpacity>
            );
          })}
        </BlurView>

        {/* Plus button — context-aware, frosted standalone circle */}
        <TouchableOpacity
          onPress={() => {
            const current = state.routes[state.index]?.name;
            const ts = String(Date.now());
            if (current === "materials") {
              navigation.navigate("materials", { openAdd: ts } as any);
            } else if (current === "formulas") {
              navigation.navigate("formulas", { openAdd: ts } as any);
            } else if (current === "collection") {
              navigation.navigate("collection", { openAdd: ts } as any);
            } else {
              router.push("/journal/new" as any);
            }
          }}
          activeOpacity={0.75}
        >
          <BlurView intensity={80} tint="light" style={tb.plusBtn}>
            <View style={tb.plusOverlay} />
            <Text style={tb.plusIcon}>+</Text>
          </BlurView>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const tb = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 100,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  pillOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#13131a",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnActive: {
    backgroundColor: "#2a2a3a",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  plusBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  plusOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  plusIcon: {
    color: "#13131a",
    fontSize: 24,
    fontWeight: "300" as const,
    lineHeight: 28,
    marginTop: -1,
  },
});

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }}
      />
      <Tabs.Screen
        name="materials"
        options={{ title: "Organ", tabBarIcon: ({ focused }) => <TabIcon emoji="🧪" focused={focused} /> }}
      />
      <Tabs.Screen
        name="formulas"
        options={{ title: "Lab", tabBarIcon: ({ focused }) => <TabIcon emoji="⚗️" focused={focused} /> }}
      />
      <Tabs.Screen
        name="collection"
        options={{ title: "Collection", tabBarIcon: ({ focused }) => <TabIcon emoji="🌸" focused={focused} /> }}
      />
      <Tabs.Screen
        name="journal"
        options={{ title: "Journal", tabBarIcon: ({ focused }) => <TabIcon emoji="📓" focused={focused} /> }}
      />
      <Tabs.Screen
        name="community"
        options={{ href: null, title: "Community" }}
      />
      <Tabs.Screen
        name="profile"
        options={{ href: null, title: "Profile" }}
      />
    </Tabs>
  );
}
