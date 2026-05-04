import { Tabs } from "expo-router";
import { Text } from "react-native";

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#13131a",
          borderTopColor: "#ffffff1a",
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: "#a78bfa",
        tabBarInactiveTintColor: "#ffffff60",
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarLabel: "Home", tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }}
      />
      <Tabs.Screen
        name="materials"
        options={{ title: "Organ", tabBarLabel: "Organ", tabBarIcon: ({ focused }) => <TabIcon emoji="🧪" focused={focused} /> }}
      />
      <Tabs.Screen
        name="formulas"
        options={{ title: "Lab", tabBarLabel: "Lab", tabBarIcon: ({ focused }) => <TabIcon emoji="⚗️" focused={focused} /> }}
      />
      <Tabs.Screen
        name="collection"
        options={{ title: "Collection", tabBarLabel: "Collection", tabBarIcon: ({ focused }) => <TabIcon emoji="🌸" focused={focused} /> }}
      />
      <Tabs.Screen
        name="journal"
        options={{ title: "Journal", tabBarLabel: "Journal", tabBarIcon: ({ focused }) => <TabIcon emoji="📓" focused={focused} /> }}
      />
      <Tabs.Screen
        name="community"
        options={{ title: "Community", tabBarLabel: "Community", tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarLabel: "Profile", tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }}
      />
    </Tabs>
  );
}
