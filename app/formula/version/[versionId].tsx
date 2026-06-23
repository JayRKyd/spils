import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SnapshotLine {
  material_id: number;
  amount_g: number;
  name: string | null;
}

interface Snapshot {
  bottle_ml: number;
  concentration_pct: number;
  diluent: string;
  lines: SnapshotLine[];
}

interface VersionRow {
  id: string;
  formula_id: number;
  version_num: number;
  notes: string | null;
  created_at: string;
  formulas?: { name: string; description: string | null } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FormulaVersionDetail() {
  const { versionId } = useLocalSearchParams<{ versionId: string }>();
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState<VersionRow | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("formula_versions")
        .select("*, formulas(name, description)")
        .eq("id", versionId)
        .single();
      if (error || !data) { setLoading(false); return; }
      const row = data as VersionRow;
      setVersion(row);
      if (row.notes) {
        try { setSnapshot(JSON.parse(row.notes)); } catch { /* non-JSON notes */ }
      }
      setLoading(false);
    };
    load();
  }, [versionId]);

  const totalG = snapshot?.lines?.reduce((s, l) => s + l.amount_g, 0) ?? 0;

  return (
    <LinearGradient colors={["#FFD4E6", "#F5AEC8", "#EC8FB5"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backText}>← Lab</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : !version ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 16 }}>Version not found.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {/* Title block */}
            <View style={s.titleBlock}>
              <Text style={s.formulaName}>{version.formulas?.name ?? "Formula"}</Text>
              <View style={s.versionBadge}>
                <Text style={s.versionBadgeText}>Version {version.version_num}</Text>
              </View>
              {version.formulas?.description ? (
                <Text style={s.desc}>{version.formulas.description}</Text>
              ) : null}
              <Text style={s.savedOn}>Saved {formatDate(version.created_at)}</Text>
            </View>

            {/* Parameters */}
            {snapshot ? (
              <>
                <View style={s.section}>
                  <Text style={s.sectionTitle}>FORMULA PARAMETERS</Text>
                  <View style={s.paramRow}>
                    <View style={s.paramCard}>
                      <Text style={s.paramLabel}>Bottle Size</Text>
                      <Text style={s.paramValue}>{snapshot.bottle_ml} mL</Text>
                    </View>
                    <View style={s.paramCard}>
                      <Text style={s.paramLabel}>Concentration</Text>
                      <Text style={s.paramValue}>{snapshot.concentration_pct}%</Text>
                    </View>
                  </View>
                  <View style={s.diluentCard}>
                    <Text style={s.paramLabel}>Diluent</Text>
                    <Text style={s.paramValue}>{snapshot.diluent}</Text>
                  </View>
                </View>

                {/* Ingredients */}
                <View style={s.section}>
                  <Text style={s.sectionTitle}>INGREDIENTS</Text>
                  <Text style={s.totalG}>{totalG.toFixed(3)}g total</Text>
                  {snapshot.lines.length === 0 ? (
                    <Text style={s.empty}>No ingredients in this version.</Text>
                  ) : (
                    [...snapshot.lines]
                      .sort((a, b) => b.amount_g - a.amount_g)
                      .map((line, i) => {
                        const pct = totalG > 0 ? ((line.amount_g / totalG) * 100).toFixed(1) : "0.0";
                        return (
                          <View key={i} style={s.lineRow}>
                            <Text style={s.lineName} numberOfLines={1}>
                              {line.name ?? `Material #${line.material_id}`}
                            </Text>
                            <View style={s.lineRight}>
                              <Text style={s.lineAmt}>{line.amount_g.toFixed(3)}g</Text>
                              <Text style={s.linePct}>{pct}%</Text>
                            </View>
                          </View>
                        );
                      })
                  )}
                </View>
              </>
            ) : (
              <View style={s.section}>
                <Text style={s.empty}>No snapshot data available for this version.</Text>
              </View>
            )}

            {/* Read-only notice */}
            <View style={s.readOnlyBanner}>
              <Text style={s.readOnlyText}>This is a read-only snapshot. Edit the live formula to make changes.</Text>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backBtn: { paddingVertical: 6 },
  backText: { color: "rgba(0,0,0,0.6)", fontSize: 15, fontWeight: "600" },
  scroll: { paddingHorizontal: 16, paddingBottom: 60 },
  titleBlock: { marginBottom: 24, marginTop: 8 },
  formulaName: { fontSize: 26, fontWeight: "800", color: "#13131a", letterSpacing: -0.5, marginBottom: 6 },
  versionBadge: { alignSelf: "flex-start", backgroundColor: "rgba(0,0,0,0.12)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 8 },
  versionBadgeText: { fontSize: 13, fontWeight: "700", color: "#13131a" },
  desc: { fontSize: 14, color: "rgba(19,19,26,0.6)", marginBottom: 4, lineHeight: 20 },
  savedOn: { fontSize: 12, color: "rgba(19,19,26,0.45)", marginTop: 4 },
  section: { backgroundColor: "rgba(255,255,255,0.45)", borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.6)" },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: "rgba(19,19,26,0.5)", letterSpacing: 1, marginBottom: 12 },
  paramRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  paramCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.5)", borderRadius: 14, padding: 12, alignItems: "center" },
  diluentCard: { backgroundColor: "rgba(255,255,255,0.5)", borderRadius: 14, padding: 12, alignItems: "center" },
  paramLabel: { fontSize: 11, color: "rgba(19,19,26,0.5)", marginBottom: 4, fontWeight: "600" },
  paramValue: { fontSize: 16, fontWeight: "700", color: "#13131a" },
  totalG: { fontSize: 13, color: "rgba(19,19,26,0.5)", marginBottom: 10, textAlign: "right" },
  lineRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" },
  lineName: { flex: 1, fontSize: 14, fontWeight: "600", color: "#13131a", marginRight: 12 },
  lineRight: { flexDirection: "row", gap: 10, alignItems: "center" },
  lineAmt: { fontSize: 14, color: "#13131a", fontWeight: "500" },
  linePct: { fontSize: 12, color: "rgba(19,19,26,0.45)", minWidth: 38, textAlign: "right" },
  empty: { color: "rgba(19,19,26,0.45)", fontSize: 14, textAlign: "center", paddingVertical: 12 },
  readOnlyBanner: { backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 14, padding: 12, alignItems: "center", marginTop: 4 },
  readOnlyText: { fontSize: 12, color: "rgba(19,19,26,0.5)", textAlign: "center", lineHeight: 18 },
});
