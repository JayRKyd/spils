import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Modal, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

const DILUENTS = [
  "Ethanol (SDA 40B)",
  "DPG (Dipropylene Glycol)",
  "TEC (Triethyl Citrate)",
  "IPM (Isopropyl Myristate)",
  "MCT Oil",
  "Perfumers Alcohol",
];

export default function NewFormula() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bottleSizeMl, setBottleSizeMl] = useState(15);
  const [concPercent, setConcPercent] = useState(20);
  const [diluent, setDiluent] = useState("Ethanol (SDA 40B)");
  const [diluentPickerVisible, setDiluentPickerVisible] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(true);
  const [saving, setSaving] = useState(false);

  const targetConcentrateG = (bottleSizeMl * concPercent) / 100;

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("formulas")
      .insert([{
        name: name.trim(),
        description: description.trim() || null,
        user_id: user?.id,
        bottle_size_ml: bottleSizeMl,
        concentration_pct: concPercent,
        diluent,
      }])
      .select()
      .single();
    setSaving(false);
    if (!error && data) router.replace(`/formula/${data.id}` as any);
  };

  return (
    <LinearGradient colors={["#FFD4E6", "#F5AEC8", "#EC8FB5"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Nav */}
        <View style={s.navBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.back}>← Lab</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <TextInput
              style={s.formulaName}
              placeholder="Formula Name"
              placeholderTextColor="rgba(0,0,0,0.25)"
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <Text style={s.formulaDate}>
              {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </Text>
            <TextInput
              style={s.formulaDesc}
              placeholder="Tap to add notes..."
              placeholderTextColor="rgba(0,0,0,0.25)"
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>

          {/* ① Mood Board */}
          <View style={[s.panel, { marginHorizontal: 16, marginBottom: 16 }]}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Mood Board</Text>
              <View style={s.addBtn}>
                <Text style={s.addBtnText}>+ Add Item</Text>
              </View>
            </View>
            <View style={{ alignItems: "center", paddingVertical: 24 }}>
              <Text style={s.emptyHint}>No mood board items yet.{"\n"}Add images or notes for inspiration.</Text>
            </View>
          </View>

          {/* ② Formula Parameters */}
          <View style={[s.panel, { marginHorizontal: 16, marginBottom: 16 }]}>
            <Text style={[s.sectionTitle, { marginBottom: 14 }]}>Formula Parameters</Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.paramLabel}>Bottle Size (mL)</Text>
                <TextInput
                  style={s.paramInput}
                  value={bottleSizeMl.toString()}
                  onChangeText={(v) => setBottleSizeMl(parseFloat(v) || 0)}
                  keyboardType="decimal-pad"
                  placeholderTextColor="rgba(0,0,0,0.3)"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.paramLabel}>Concentration (%)</Text>
                <TextInput
                  style={s.paramInput}
                  value={concPercent.toString()}
                  onChangeText={(v) => setConcPercent(parseFloat(v) || 0)}
                  keyboardType="decimal-pad"
                  placeholderTextColor="rgba(0,0,0,0.3)"
                />
              </View>
            </View>
            <Text style={s.paramLabel}>Diluent</Text>
            <TouchableOpacity style={s.diluentRow} onPress={() => setDiluentPickerVisible(true)}>
              <Text style={{ color: "#13131a", fontSize: 14 }}>{diluent}</Text>
              <Text style={{ color: "rgba(0,0,0,0.4)", fontSize: 15 }}>▾</Text>
            </TouchableOpacity>
            <Text style={s.paramCalc}>
              Current concentrate: 0.000g · Target concentrate: {targetConcentrateG.toFixed(3)}g · Diluent to add: {bottleSizeMl - (bottleSizeMl * concPercent / 100)} mL
            </Text>
            <TouchableOpacity style={[s.normalizeBtn, { opacity: 0.4 }]} disabled>
              <Text style={s.normalizeBtnText}>Normalize to Target</Text>
            </TouchableOpacity>
          </View>

          {/* ③ Inline add (disabled on new page) */}
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <TextInput
                style={[s.searchBarInline, { flex: 1, opacity: 0.5 }]}
                placeholder="Type to search materials..."
                placeholderTextColor="rgba(0,0,0,0.3)"
                editable={false}
              />
              <TextInput
                style={[s.amountInline, { opacity: 0.5 }]}
                placeholder="0.000"
                placeholderTextColor="rgba(0,0,0,0.3)"
                editable={false}
              />
              <View style={[s.addBtn, { opacity: 0.4 }]}>
                <Text style={s.addBtnText}>Add</Text>
              </View>
            </View>
          </View>

          {/* ④ Materials Table */}
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <View style={[s.panel, { paddingHorizontal: 16 }]}>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderText, { flex: 1 }]}>Material</Text>
                <Text style={[s.tableHeaderText, { width: 52 }]}>Type</Text>
                <Text style={[s.tableHeaderText, { width: 68, textAlign: "right" }]}>Amount (g)</Text>
                <View style={{ width: 30 }} />
              </View>
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <Text style={s.emptyHint}>No ingredients yet. Add some to get started.</Text>
              </View>
              <View style={s.tableTotalRow}>
                <Text style={[s.tableTotalLabel, { flex: 1 }]}>Total</Text>
                <Text style={s.tableTotalVal}>0.000</Text>
                <Text style={[s.tableTotalVal, { width: 44, textAlign: "right" }]}>100.000%</Text>
                <View style={{ width: 30 }} />
              </View>
            </View>
          </View>

          {/* ⑤ Formula Summary */}
          <View style={[s.panel, { marginHorizontal: 16, marginBottom: 16 }]}>
            <Text style={[s.sectionTitle, { marginBottom: 16 }]}>Formula Summary</Text>
            <View style={{ flexDirection: "row" }}>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={s.statVal}>0.000g</Text>
                <Text style={s.statLabel}>Current Total</Text>
              </View>
              <View style={s.statDivider} />
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={s.statVal}>{targetConcentrateG.toFixed(3)}g</Text>
                <Text style={s.statLabel}>Target Concentrate</Text>
              </View>
              <View style={s.statDivider} />
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={s.statVal}>{(bottleSizeMl - targetConcentrateG).toFixed(1)} mL</Text>
                <Text style={s.statLabel}>Base/Diluent Needed</Text>
              </View>
            </View>
          </View>

          {/* ⑥ Notes (collapsible) */}
          <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
            <TouchableOpacity
              style={[s.notesHeader, notesExpanded && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 }]}
              onPress={() => setNotesExpanded((v) => !v)}
              activeOpacity={0.8}
            >
              <Text style={s.sectionTitle}>Notes</Text>
              <Text style={{ color: "rgba(0,0,0,0.45)", fontSize: 18, lineHeight: 22 }}>
                {notesExpanded ? "∧" : "∨"}
              </Text>
            </TouchableOpacity>
            {notesExpanded && (
              <View style={s.notesBody}>
                <Text style={{ color: "rgba(0,0,0,0.3)", fontSize: 14 }}>No notes yet.</Text>
              </View>
            )}
          </View>

        </ScrollView>

        {/* Bottom buttons */}
        <SafeAreaView edges={["bottom"]} style={{ backgroundColor: "transparent" }}>
          <View style={s.bottomRow}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.saveBtn, !name.trim() && { opacity: 0.4 }]}
              onPress={handleCreate}
              disabled={saving || !name.trim()}
            >
              {saving
                ? <ActivityIndicator color="#13131a" size="small" />
                : <Text style={s.saveBtnText}>Create</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Diluent Picker */}
        <Modal visible={diluentPickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDiluentPickerVisible(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: "#0e1828" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" }}>
              <View style={{ width: 60 }} />
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>Select Diluent</Text>
              <TouchableOpacity onPress={() => setDiluentPickerVisible(false)}>
                <Text style={{ color: "#13131a", fontSize: 16, fontWeight: "600" }}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {DILUENTS.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={{ paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                  onPress={() => { setDiluent(d); setDiluentPickerVisible(false); }}
                >
                  <Text style={{ color: "#fff", fontSize: 16 }}>{d}</Text>
                  {diluent === d ? <Text style={{ color: "#a78bfa", fontSize: 18 }}>✓</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  navBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  back: { color: "#13131a", fontSize: 16, fontWeight: "600" },

  formulaName: { color: "#13131a", fontSize: 26, fontWeight: "700", marginBottom: 4 },
  formulaDate: { color: "rgba(0,0,0,0.4)", fontSize: 13, marginBottom: 8 },
  formulaDesc: { color: "rgba(0,0,0,0.55)", fontSize: 14, lineHeight: 20 },

  panel: { backgroundColor: "rgba(255,255,255,0.35)", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 16, padding: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: "#13131a", fontWeight: "600", fontSize: 16 },
  addBtn: { backgroundColor: "#13131a", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  emptyHint: { color: "rgba(0,0,0,0.3)", fontSize: 14, textAlign: "center" },

  paramLabel: { color: "rgba(0,0,0,0.5)", fontSize: 12, marginBottom: 6 },
  paramInput: { backgroundColor: "rgba(255,255,255,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: "#13131a", fontSize: 15 },
  diluentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  paramCalc: { color: "rgba(0,0,0,0.4)", fontSize: 12, lineHeight: 18 },
  normalizeBtn: { marginTop: 14, backgroundColor: "rgba(139,117,250,0.25)", borderWidth: 1, borderColor: "rgba(167,139,250,0.5)", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  normalizeBtnText: { color: "#5b3fd4", fontWeight: "600", fontSize: 15 },

  searchBarInline: { backgroundColor: "rgba(255,255,255,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11, color: "#13131a", fontSize: 14 },
  amountInline: { backgroundColor: "rgba(255,255,255,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 11, color: "#13131a", fontSize: 14, width: 72, textAlign: "center" },

  tableHeader: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.1)" },
  tableHeaderText: { color: "rgba(0,0,0,0.4)", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  tableTotalRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.1)", marginTop: 2 },
  tableTotalLabel: { color: "#13131a", fontWeight: "700", fontSize: 14 },
  tableTotalVal: { color: "#13131a", fontWeight: "700", fontSize: 14 },

  statVal: { color: "#13131a", fontWeight: "700", fontSize: 17, marginBottom: 4, textAlign: "center" },
  statLabel: { color: "rgba(0,0,0,0.4)", fontSize: 11, textAlign: "center" },
  statDivider: { width: 1, backgroundColor: "rgba(0,0,0,0.1)", marginVertical: 4 },

  notesHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "rgba(255,255,255,0.35)", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 12 },
  notesBody: { backgroundColor: "rgba(255,255,255,0.25)", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderTopWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, padding: 16 },

  bottomRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 16 },
  cancelBtn: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "rgba(0,0,0,0.15)", borderRadius: 24, paddingHorizontal: 22, paddingVertical: 12 },
  cancelBtnText: { color: "#13131a", fontSize: 14 },
  saveBtn: { backgroundColor: "#C6FF00", borderRadius: 24, paddingHorizontal: 28, paddingVertical: 13 },
  saveBtnText: { color: "#13131a", fontSize: 15, fontWeight: "700" },
});
