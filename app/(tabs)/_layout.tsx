import { Tabs } from "expo-router";
import { router } from "expo-router";
import { Text, View, TouchableOpacity, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Line, Rect } from "react-native-svg";

// ─── Icons ────────────────────────────────────────────────────────────────────

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.75 }}>{emoji}</Text>;
}

function HomeLeftIcon({ focused }: { focused: boolean }) {
  return (
    <Svg viewBox="0 0 24.25 24.25" width={20} height={20} style={{ opacity: focused ? 1 : 0.75 }}>
      <Path
        d="M12.15,2.86c4.77,0,8.63,3.86,8.63,8.63s-3.86,8.63-8.63,8.63S3.52,16.26,3.52,11.49,7.38,2.86,12.15,2.86M12.15,2.36C7.11,2.36,3.02,6.45,3.02,11.49s4.1,9.13,9.13,9.13,9.13-4.1,9.13-9.13S17.18,2.36,12.15,2.36h0Z"
        fill="#fff"
      />
      <Line x1={15.16} y1={8.84} x2={9.85} y2={14.14} stroke="#fff" strokeWidth={0.5} strokeMiterlimit={10} />
      <Rect x={0.12} y={0.12} width={24} height={24} fill="none" />
    </Svg>
  );
}

// ─── Custom Floating Bar ──────────────────────────────────────────────────────

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const makePress = (route: (typeof state.routes)[0], focused: boolean) => () => {
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
  };

  const homeRoute = state.routes.find((r) => r.name === "index");
  const pillRoutes = state.routes.filter((r) => !["index", "profile"].includes(r.name));

  return (
    <View style={[tb.wrapper, { paddingBottom: insets.bottom + 8 }]}>
      <View style={tb.row}>

        {/* Home — standalone frosted circle on the left */}
        {homeRoute && (() => {
          const { options } = descriptors[homeRoute.key];
          const focused = state.index === state.routes.findIndex((r) => r.name === "index");
          return (
            <TouchableOpacity onPress={makePress(homeRoute, focused)} activeOpacity={0.75}>
              <BlurView intensity={80} tint="light" style={tb.soloBtn}>
                <View style={tb.pillOverlay} />
                {options.tabBarIcon?.({ focused, color: "#fff", size: 18 })}
              </BlurView>
            </TouchableOpacity>
          );
        })()}

        {/* Main pill: Journal | Collection | Lab | Organ | Community */}
        <BlurView intensity={80} tint="light" style={tb.pill}>
          <View style={tb.pillOverlay} />
          {pillRoutes.map((route) => {
            const index = state.routes.findIndex((r) => r.key === route.key);
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            return (
              <TouchableOpacity
                key={route.key}
                style={[tb.iconBtn, focused && tb.iconBtnActive]}
                onPress={makePress(route, focused)}
                activeOpacity={0.75}
              >
                {options.tabBarIcon?.({ focused, color: "#fff", size: 18 })}
              </TouchableOpacity>
            );
          })}
        </BlurView>

        {/* Plus — standalone frosted circle on the right (hidden on community tab) */}
        {state.routes[state.index]?.name !== "community" && (
          <TouchableOpacity
            onPress={() => {
              const current = state.routes[state.index]?.name;
              const ts = String(Date.now());
              if (current === "materials") navigation.navigate("materials", { openAdd: ts } as any);
              else if (current === "formulas") navigation.navigate("formulas", { openAdd: ts } as any);
              else if (current === "collection") router.push("/collection/new" as any);
              else router.push("/journal/new" as any);
            }}
            activeOpacity={0.75}
          >
            <BlurView intensity={80} tint="light" style={tb.soloBtn}>
              <View style={tb.pillOverlay} />
              <Text style={tb.plusIcon}>+</Text>
            </BlurView>
          </TouchableOpacity>
        )}

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
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  soloBtn: {
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
        options={{ title: "Home", tabBarIcon: ({ focused }) => <HomeLeftIcon focused={focused} /> }}
      />
      <Tabs.Screen
        name="journal"
        options={{ title: "Journal", tabBarIcon: ({ focused }) => <TabIcon emoji="📓" focused={focused} /> }}
      />
      <Tabs.Screen
        name="collection"
        options={{ title: "Collection", tabBarIcon: ({ focused }) => <TabIcon emoji="🌸" focused={focused} /> }}
      />
      <Tabs.Screen
        name="formulas"
        options={{ title: "Lab", tabBarIcon: ({ focused }) => <TabIcon emoji="⚗️" focused={focused} /> }}
      />
      <Tabs.Screen
        name="materials"
        options={{ title: "Organ", tabBarIcon: ({ focused }) => <TabIcon emoji="🧪" focused={focused} /> }}
      />
      <Tabs.Screen
        name="community"
        options={{ title: "Community", tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ href: null, title: "Profile" }}
      />
    </Tabs>
  );
}
