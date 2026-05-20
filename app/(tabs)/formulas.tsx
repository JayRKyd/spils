import { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Modal, ScrollView, ActivityIndicator, Alert, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import GradientScreen from "@/components/GradientScreen";
import { GlassRow } from "@/components/GlassCard";

interface Formula {
  id: number;
  name: string;
  description: string | null;
  date_created: string;
  material_count?: number;
}

function getStatus(count: number) {
  if (count === 0) return { label: "Draft", progress: 0 };
  if (count <= 3) return { label: "In Progress", progress: 30 };
  if (count <= 6) return { label: "In Progress", progress: 60 };
  return { label: "Final", progress: 100 };
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={s.progressTrack}>
      <View style={[s.progressFill, { width: `${progress}%` as any }]} />
    </View>
  );
}

function CreateModal({ visible, userId, onClose, onCreated }: {
  visible: boolean; userId?: string; onClose: () => void; onCreated: (id: number) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) { setName(""); setDescription(""); } }, [visible]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from("formulas").insert([{ name: name.trim(), description: description.trim() || null, user_id: userId }]).select().single();
    setSaving(false);
    if (!error && data) onCreated(data.id);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.modal}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>New Project</Text>
          <TouchableOpacity onPress={onClose}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={s.fieldLabel}>Name *</Text>
          <TextInput style={s.input} placeholder="Formula name" placeholderTextColor="rgba(255,255,255,0.35)" value={name} onChangeText={setName} />
          <Text style={s.fieldLabel}>Description</Text>
          <TextInput style={[s.input, { height: 100, textAlignVertical: "top" }]} placeholder="Optional description" placeholderTextColor="rgba(255,255,255,0.35)" value={description} onChangeText={setDescription} multiline />
          <TouchableOpacity style={[s.saveBtn, (!name.trim() || saving) && { opacity: 0.5 }]} onPress={handleCreate} disabled={saving || !name.trim()}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Create Project</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function FormulaCard({ formula, onDelete }: { formula: Formula; onDelete: () => void }) {
  const status = getStatus(formula.material_count ?? 0);
  return (
    <TouchableOpacity onPress={() => router.push(`/formula/${formula.id}` as any)} activeOpacity={0.75}>
      <GlassRow style={s.card}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
          <Text style={[s.cardTitle, { flex: 1, marginRight: 8 }]} numberOfLines={1}>{formula.name}</Text>
          <Text style={s.cardDate}>{new Date(formula.date_created).toLocaleDateString()}</Text>
        </View>
        <Text style={s.cardDesc} numberOfLines={2}>{formula.description || "No description"}</Text>
        <ProgressBar progress={status.progress} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Text style={s.cardMeta}>{formula.material_count ?? 0} materials</Text>
            <Text style={s.cardMeta}>· {status.label}</Text>
          </View>
          <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); onDelete(); }}>
            <Text style={s.deleteBtn}>Delete</Text>
          </TouchableOpacity>
        </View>
      </GlassRow>
    </TouchableOpacity>
  );
}

export default function Formulas() {
  const { user } = useAuth();
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const { openAdd } = useLocalSearchParams<{ openAdd?: string }>();
  const [createVisible, setCreateVisible] = useState(false);
  useEffect(() => { if (openAdd) setCreateVisible(true); }, [openAdd]);

  const fetchFormulas = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("formulas").select("*, formula_lines(count)").order("name", { ascending: true });
    const mapped = (data ?? []).map((f: any) => ({ ...f, material_count: f.formula_lines?.[0]?.count ?? 0 }));
    setFormulas(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { fetchFormulas(); }, [fetchFormulas]);

  const filtered = formulas.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const handleDelete = (id: number, name: string) => {
    Alert.alert("Delete Project", `Remove "${name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await supabase.from("formulas").delete().eq("id", id); fetchFormulas(); } },
    ]);
  };

  return (
    <GradientScreen gradient="lab">
      <View style={s.header}>
        <Text style={s.pageTitle}>Lab</Text>
        <TextInput style={s.searchBar} placeholder="Search projects..." placeholderTextColor="rgba(255,255,255,0.4)" value={search} onChangeText={setSearch} />
      </View>

      {loading ? <ActivityIndicator color="#a78bfa" style={{ marginTop: 48 }} /> : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 64 }}>
              <Text style={s.empty}>{search ? "No projects match your search" : "No projects yet"}</Text>
              {!search && (
                <TouchableOpacity style={[s.saveBtn, { marginTop: 16, paddingHorizontal: 24 }]} onPress={() => setCreateVisible(true)}>
                  <Text style={s.saveBtnText}>Create First Project</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => <FormulaCard formula={item} onDelete={() => handleDelete(item.id, item.name)} />}
        />
      )}


      <CreateModal
        visible={createVisible}
        userId={user?.id}
        onClose={() => setCreateVisible(false)}
        onCreated={(id) => { setCreateVisible(false); fetchFormulas(); router.push(`/formula/${id}` as any); }}
      />
    </GradientScreen>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  pageTitle: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 12 },
  searchBar: { backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, color: "#fff" },
  card: { paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10 },
  cardTitle: { color: "#fff", fontWeight: "600", fontSize: 15 },
  cardDate: { color: "rgba(255,255,255,0.35)", fontSize: 12 },
  cardDesc: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 10 },
  cardMeta: { color: "rgba(255,255,255,0.35)", fontSize: 12 },
  deleteBtn: { color: "#f87171", fontSize: 12 },
  progressTrack: { height: 4, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#a78bfa", borderRadius: 2 },
  empty: { color: "rgba(255,255,255,0.5)", textAlign: "center", fontSize: 14 },
  fab: { position: "absolute", bottom: 24, right: 24, backgroundColor: "#a78bfa", width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  fabIcon: { color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 32 },
  modal: { flex: 1, backgroundColor: "#0e1828" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  modalClose: { color: "rgba(255,255,255,0.5)", fontSize: 18 },
  fieldLabel: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: "#fff", fontSize: 15, marginBottom: 14 },
  saveBtn: { backgroundColor: "#a78bfa", borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
