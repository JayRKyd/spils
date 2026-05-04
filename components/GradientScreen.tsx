import { ReactNode } from "react";
import { StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

export const GRADIENTS = {
  default:     ["#5c3aae", "#3d2180", "#261456"] as const,
  materials:   ["#1e6035", "#145528", "#0e3a1c"] as const,
  lab:         ["#1a4878", "#103260", "#0a2048"] as const,
  collection:  ["#5c1c8a", "#421268", "#2c0a48"] as const,
  journal:     ["#7a3c18", "#5a2810", "#3c180a"] as const,
  community:   ["#1a5c6e", "#104855", "#0a3040"] as const,
  marketplace: ["#6a4e18", "#503a10", "#38280a"] as const,
  profile:     ["#4a1e8c", "#341268", "#200a48"] as const,
  detail:      ["#3a2e78", "#262060", "#181445"] as const,
} as const;

type GradientKey = keyof typeof GRADIENTS;

interface GradientScreenProps {
  children: ReactNode;
  gradient?: GradientKey;
  style?: object;
}

export default function GradientScreen({ children, gradient = "default", style }: GradientScreenProps) {
  return (
    <LinearGradient
      colors={GRADIENTS[gradient]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[StyleSheet.absoluteFill, { flex: 1 }]}
    >
      <SafeAreaView style={[{ flex: 1 }, style]}>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}
