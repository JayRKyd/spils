import { Tabs } from "expo-router";
import { router } from "expo-router";
import { Text, View, TouchableOpacity, StyleSheet, Image } from "react-native";
import { BlurView } from "expo-blur";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Line, Rect } from "react-native-svg";

// ─── Icons ────────────────────────────────────────────────────────────────────

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.75 }}>{emoji}</Text>;
}

function JournalIcon({ focused, color = "#edff8d" }: { focused: boolean; color?: string }) {
  return (
    <Svg viewBox="0 0 24.25 24.25" width={38} height={38} style={{ opacity: focused ? 1 : 0.75 }}>
      <Rect x={0.12} y={0.12} width={24} height={24} fill="none" />
      <Rect x={3.17} y={3.09} width={17.89} height={17.73} fill="none" />
      <Path
        d="M12.12,3.26C7.31,3.26,3.42,7.15,3.42,11.94s3.89,8.68,8.69,8.68,8.69-3.89,8.69-8.68S16.92,3.26,12.12,3.26ZM14.78,13.22c-.01,1.61-1.45,3.12-3.02,3.14l-2.68.04v-1.27s2.68-.04,2.68-.04c.87-.01,1.75-.98,1.76-1.86l.05-4.56h-2.57s0-1.27,0-1.27h3.83s-.04,5.82-.04,5.82Z"
        fill={focused ? color : "#fff"}
      />
      <Rect x={3.12} y={1.12} width={18} height={22} fill="none" />
    </Svg>
  );
}

function AddRightIcon() {
  return (
    <Svg viewBox="0 0 24.25 24.25" width={64} height={64}>
      <Line x1={12.38} y1={7.74} x2={12.38} y2={15.24} stroke="#fff" strokeWidth={0.5} strokeMiterlimit={10} />
      <Line x1={8.64} y1={11.49} x2={16.13} y2={11.49} stroke="#fff" strokeWidth={0.5} strokeMiterlimit={10} />
      <Path
        d="M12.38,2.86c4.77,0,8.63,3.86,8.63,8.63s-3.86,8.63-8.63,8.63S3.75,16.26,3.75,11.49,7.62,2.86,12.38,2.86M12.38,2.36C7.35,2.36,3.25,6.45,3.25,11.49s4.1,9.13,9.13,9.13,9.13-4.1,9.13-9.13S17.42,2.36,12.38,2.36h0Z"
        fill="#fff"
      />
      <Rect x={0.12} y={0.12} width={24} height={24} fill="none" />
    </Svg>
  );
}

function CommunityIcon({ focused, color = "#edff8d" }: { focused: boolean; color?: string }) {
  return (
    <Svg viewBox="0 0 24.25 24.25" width={38} height={38} style={{ opacity: focused ? 1 : 0.75 }}>
      <Rect x={0.12} y={0.12} width={24} height={24} fill="none" />
      <Rect x={3.17} y={3.09} width={17.89} height={17.73} fill="none" />
      <Rect x={3.12} y={1.12} width={18} height={22} fill="none" />
      <Rect x={11.13} y={3.09} width={17.89} height={17.73} fill="none" />
      <Path
        d="M12.1,3.26C7.3,3.26,3.41,7.15,3.41,11.94s3.89,8.68,8.69,8.68,8.69-3.88,8.69-8.68S16.91,3.26,12.1,3.26ZM10.94,16.43c-2.33-.61-3.8-2.98-3.2-5.4.49-1.97,2.21-3.29,4.13-3.37,2.01-.09,3.81,1.08,4.49,3.03l-1.16.04c-.74-1.58-2.32-2.32-3.93-1.92-1.5.37-2.61,1.77-2.59,3.36.03,1.58,1.18,2.94,2.7,3.26,1.61.34,3.17-.45,3.84-2.05h1.18c-.72,2.39-3.13,3.66-5.45,3.05ZM13.23,12.03c0,.6-.48,1.08-1.08,1.08s-1.08-.48-1.08-1.08.48-1.08,1.08-1.08,1.08.48,1.08,1.08Z"
        fill={focused ? color : "#fff"}
      />
    </Svg>
  );
}

function OrganIcon({ focused, color = "#edff8d" }: { focused: boolean; color?: string }) {
  return (
    <Svg viewBox="0 0 24.25 24.25" width={38} height={38} style={{ opacity: focused ? 1 : 0.75 }}>
      <Rect x={0.12} y={0.12} width={24} height={24} fill="none" />
      <Rect x={3.17} y={3.09} width={17.89} height={17.73} fill="none" />
      <Rect x={3.12} y={1.12} width={18} height={22} fill="none" />
      <Path
        d="M12.12,3.26C7.32,3.26,3.43,7.15,3.43,11.94s3.89,8.68,8.69,8.68,8.69-3.89,8.69-8.68S16.92,3.26,12.12,3.26ZM12.33,16.59c-2.6,0-4.71-2.11-4.71-4.71s2.11-4.71,4.71-4.71,4.71,2.11,4.71,4.71-2.11,4.71-4.71,4.71Z"
        fill={focused ? color : "#fff"}
      />
      <Path
        d="M12.33,15.41c-1.91,0-3.45-1.55-3.45-3.45s1.55-3.45,3.45-3.45,3.45,1.55,3.45,3.45-1.55,3.45-3.45,3.45Z"
        fill={focused ? color : "#fff"}
      />
    </Svg>
  );
}

function LabIcon({ focused, color = "#edff8d" }: { focused: boolean; color?: string }) {
  return (
    <Svg viewBox="0 0 24.25 24.25" width={38} height={38} style={{ opacity: focused ? 1 : 0.75 }}>
      <Rect x={0.12} y={0.12} width={24} height={24} fill="none" />
      <Rect x={3.17} y={3.09} width={17.89} height={17.73} fill="none" />
      <Rect x={3.12} y={1.12} width={18} height={22} fill="none" />
      <Path
        d="M12.1,3.3C7.32,3.3,3.45,7.17,3.45,11.94s3.87,8.63,8.65,8.63,8.65-3.87,8.65-8.63S16.87,3.3,12.1,3.3ZM11.22,16.34c-1.39-.01-2.34-1.22-2.34-2.52v-6.4s1.25,0,1.25,0v6.51c.01.56.47,1.15,1.08,1.15h4.19s0,1.29,0,1.29l-4.19-.03Z"
        fill={focused ? color : "#fff"}
      />
    </Svg>
  );
}

function CollectionIcon({ focused, color = "#edff8d" }: { focused: boolean; color?: string }) {
  return (
    <Svg viewBox="0 0 24.25 24.25" width={38} height={38} style={{ opacity: focused ? 1 : 0.75 }}>
      <Rect x={0.12} y={0.12} width={24} height={24} fill="none" />
      <Rect x={3.17} y={3.09} width={17.89} height={17.73} fill="none" />
      <Rect x={3.12} y={1.12} width={18} height={22} fill="none" />
      <Path
        d="M12.12,3.26C7.32,3.26,3.43,7.15,3.43,11.94s3.89,8.68,8.69,8.68,8.69-3.88,8.69-8.68S16.92,3.26,12.12,3.26ZM11.72,16.49c-2.48-.32-4.25-2.47-4.1-4.87.15-2.42,2.15-4.35,4.66-4.37,2.09-.01,3.97,1.24,4.46,3.26l-1.31.03c-.5-1.27-1.61-1.97-2.91-2.03-1.88-.09-3.42,1.24-3.6,3.01-.2,1.88,1.12,3.6,3.15,3.74,1.55.11,2.77-.65,3.37-2.02l1.32.02c-.65,2.21-2.75,3.53-5.03,3.23Z"
        fill={focused ? color : "#fff"}
      />
    </Svg>
  );
}

function HomeLeftIcon({ focused }: { focused: boolean }) {
  return (
    <Svg viewBox="0 0 24.25 24.25" width={64} height={64} style={{ opacity: focused ? 1 : 0.75 }}>
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

const ROUTE_ACTIVE_COLORS: Record<string, string> = {
  journal: "#edff8d",
  collection: "#00AEEF",
  formulas: "#EC008C",
  materials: "#33FF00",
  community: "#F2533A",
};

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
              {options.tabBarIcon?.({ focused, color: "#fff", size: 18 })}
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
            const activeColor = ROUTE_ACTIVE_COLORS[route.name] ?? "#edff8d";
            return (
              <TouchableOpacity
                key={route.key}
                style={[tb.iconBtn, focused && tb.iconBtnActive]}
                onPress={makePress(route, focused)}
                activeOpacity={0.75}
              >
                {options.tabBarIcon?.({ focused, color: activeColor, size: 18 })}
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
            <AddRightIcon />
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
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnActive: {
    backgroundColor: "transparent",
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
        options={{ title: "Journal", tabBarIcon: ({ focused, color }) => <JournalIcon focused={focused} color={color} /> }}
      />
      <Tabs.Screen
        name="collection"
        options={{ title: "Collection", tabBarIcon: ({ focused, color }) => <CollectionIcon focused={focused} color={color} /> }}
      />
      <Tabs.Screen
        name="formulas"
        options={{ title: "Lab", tabBarIcon: ({ focused, color }) => <LabIcon focused={focused} color={color} /> }}
      />
      <Tabs.Screen
        name="materials"
        options={{ title: "Organ", tabBarIcon: ({ focused, color }) => <OrganIcon focused={focused} color={color} /> }}
      />
      <Tabs.Screen
        name="community"
        options={{ title: "Community", tabBarIcon: ({ focused, color }) => <CommunityIcon focused={focused} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ href: null, title: "Profile" }}
      />
    </Tabs>
  );
}
