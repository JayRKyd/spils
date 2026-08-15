import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";

export interface ConfirmConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  /** Informational popup: single OK button, no Cancel, neutral color */
  infoOnly?: boolean;
  onConfirm?: () => void;
}

/**
 * App-styled confirmation dialog (replaces native Alert.alert confirms):
 * dark card with a 0.5pt white stroke, Cancel + destructive action pills.
 */
export function ConfirmModal({ config, onClose }: { config: ConfirmConfig | null; onClose: () => void }) {
  const handleConfirm = () => {
    const fn = config?.onConfirm;
    onClose();
    fn?.();
  };

  return (
    <Modal visible={!!config} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={onClose} />
        <View style={st.card}>
          <Text style={st.title}>{config?.title}</Text>
          <Text style={st.msg}>{config?.message}</Text>
          <View style={st.row}>
            {!config?.infoOnly && (
              <TouchableOpacity style={st.btn} onPress={onClose}>
                <Text style={st.btnText}>Cancel</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={st.btn} onPress={handleConfirm}>
              <Text style={config?.infoOnly ? st.btnText : st.confirmText}>
                {config?.confirmLabel ?? (config?.infoOnly ? "OK" : "Delete")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", paddingHorizontal: 36 },
  card: { backgroundColor: "#141414", borderRadius: 20, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.9)", padding: 24 },
  title: { color: "#fff", fontSize: 17, fontWeight: "700", marginBottom: 8 },
  msg: { color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 20, marginBottom: 20 },
  row: { flexDirection: "row", gap: 12 },
  btn: { flex: 1, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.6)", borderRadius: 100, paddingVertical: 13, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  confirmText: { color: "#ff5252", fontSize: 15, fontWeight: "600" },
});
