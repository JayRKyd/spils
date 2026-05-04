import { ReactNode } from "react";
import { StyleSheet, View, StyleProp, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  padding?: number;
}

export default function GlassCard({ children, style, intensity = 28, padding }: Props) {
  return (
    <BlurView intensity={intensity} tint="light" style={[styles.blur, style]}>
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />
      <View style={padding !== undefined ? { padding } : undefined}>
        {children}
      </View>
    </BlurView>
  );
}

export function GlassRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <BlurView intensity={22} tint="light" style={[styles.row, style]}>
      <View style={[StyleSheet.absoluteFill, styles.rowOverlay]} />
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  blur: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  overlay: {
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  row: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  rowOverlay: {
    backgroundColor: "rgba(255,255,255,0.10)",
  },
});
