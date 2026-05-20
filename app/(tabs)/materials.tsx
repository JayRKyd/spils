import { useState, useEffect, useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Modal, ScrollView, ActivityIndicator, Alert, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import GradientScreen from "@/components/GradientScreen";
import { GlassRow } from "@/components/GlassCard";

// ─── Types ────────────────────────────────────────────────────────────────────

type Material = {
  id: number;
  name: string;
  description: string | null;
  type: "Top" | "Mid" | "Base" | "Solvent" | "Other" | null;
  cas_number?: string | null;
  stock_g?: number | null;
  ifra_limit?: string | null;
  density_g_per_ml?: number | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SYMBOL_ICONS: Record<string, string> = {
  Top: "▲", Mid: "■", Base: "●", Solvent: "★", Other: "✴",
};
const TYPE_OPTIONS = ["Top", "Mid", "Base", "Solvent", "Other"] as const;

const ALPHA_RANGES = [
  { label: "A–D", from: "a", to: "d" },
  { label: "E–I", from: "e", to: "i" },
  { label: "J–N", from: "j", to: "n" },
  { label: "O–S", from: "o", to: "s" },
  { label: "T–Z", from: "t", to: "z" },
] as const;

const LOW_STOCK_THRESHOLD = 20;

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

function MaterialModal({ visible, initial, userId, onClose, onSaved }: {
  visible: boolean;
  initial?: Partial<Material>;
  userId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(initial?.id);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<Material["type"]>(null);
  const [casNumber, setCasNumber] = useState("");
  const [stockG, setStockG] = useState("");
  const [ifraLimit, setIfraLimit] = useState("");
  const [density, setDensity] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setType((initial?.type as any) ?? null);
    setCasNumber(initial?.cas_number ?? "");
    setStockG(initial?.stock_g?.toString() ?? "");
    setIfraLimit(initial?.ifra_limit ?? "");
    setDensity(initial?.density_g_per_ml?.toString() ?? "");
  }, [visible, initial]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      type: type || null,
      cas_number: casNumber.trim() || null,
      stock_g: stockG ? parseFloat(stockG) : null,
      ifra_limit: ifraLimit.trim() || null,
      density_g_per_ml: density ? parseFloat(density) : null,
    };
    const { error } = isEdit
      ? await supabase.from("materials").update(payload).eq("id", initial!.id!)
      : await supabase.from("materials").insert({ ...payload, user_id: userId });
    setSaving(false);
    if (error) {
      Alert.alert("Save failed", error.message ?? "Something went wrong. Please try again.");
      return;
    }
    onSaved();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.modalScreen}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={s.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={s.modalTitle}>{isEdit ? "Edit Material" : "New Material"}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving || !name.trim()}>
            {saving
              ? <ActivityIndicator color="#a78bfa" size="small" />
              : <Text style={[s.modalSave, !name.trim() && { opacity: 0.35 }]}>Save</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.fieldLabel}>Name *</Text>
          <TextInput style={s.input} placeholder="Ambroxan" placeholderTextColor="rgba(255,255,255,0.3)" value={name} onChangeText={setName} />

          <Text style={s.fieldLabel}>Description</Text>
          <TextInput style={[s.input, { height: 80, textAlignVertical: "top" }]} placeholder="Woody, ambergris-like…" placeholderTextColor="rgba(255,255,255,0.3)" value={description} onChangeText={setDescription} multiline />

          <Text style={s.fieldLabel}>Type</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {TYPE_OPTIONS.map((opt) => (
              <Chip
                key={opt}
                label={`${SYMBOL_ICONS[opt]} ${opt}`}
                active={type === opt}
                onPress={() => setType(type === opt ? null : opt)}
              />
            ))}
          </View>

          <Text style={s.fieldLabel}>CAS Number</Text>
          <TextInput style={s.input} placeholder="123-45-6" placeholderTextColor="rgba(255,255,255,0.3)" value={casNumber} onChangeText={setCasNumber} />

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Stock (g)</Text>
              <TextInput style={s.input} placeholder="100.0" placeholderTextColor="rgba(255,255,255,0.3)" value={stockG} onChangeText={setStockG} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Density (g/ml)</Text>
              <TextInput style={s.input} placeholder="0.85" placeholderTextColor="rgba(255,255,255,0.3)" value={density} onChangeText={setDensity} keyboardType="decimal-pad" />
            </View>
          </View>

          <Text style={s.fieldLabel}>IFRA Limit</Text>
          <TextInput style={s.input} placeholder="e.g. 5%" placeholderTextColor="rgba(255,255,255,0.3)" value={ifraLimit} onChangeText={setIfraLimit} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Material Card ────────────────────────────────────────────────────────────

function MaterialCard({ item, onEdit, onDelete }: {
  item: Material;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isLowStock = item.stock_g != null && item.stock_g <= LOW_STOCK_THRESHOLD;

  return (
    <GlassRow style={s.card}>
      <View style={s.cardTopRow}>
        <View style={s.cardNameRow}>
          {item.type
            ? <Text style={s.typeIcon}>{SYMBOL_ICONS[item.type]}</Text>
            : null}
          <Text style={s.cardTitle} numberOfLines={1}>{item.name}</Text>
        </View>
        <View style={s.cardActions}>
          <TouchableOpacity onPress={onEdit}><Text style={s.editBtn}>Edit</Text></TouchableOpacity>
          <TouchableOpacity onPress={onDelete}><Text style={s.deleteBtn}>Delete</Text></TouchableOpacity>
        </View>
      </View>

      {item.description
        ? <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text>
        : null}

      <View style={s.cardMetaRow}>
        {item.cas_number
          ? <Text style={s.cardMeta}>CAS {item.cas_number}</Text>
          : null}
        {item.stock_g != null
          ? (
            <View style={[s.stockPill, isLowStock && s.stockPillLow]}>
              <Text style={[s.stockText, isLowStock && s.stockTextLow]}>
                {item.stock_g}g{isLowStock ? " ⚠ Low" : ""}
              </Text>
            </View>
          )
          : null}
        {item.density_g_per_ml != null
          ? <Text style={s.cardMeta}>{item.density_g_per_ml} g/ml</Text>
          : null}
        {item.ifra_limit
          ? <Text style={s.cardMeta}>IFRA {item.ifra_limit}</Text>
          : null}
      </View>
    </GlassRow>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function Materials() {
  const { user } = useAuth();
  const { openAdd } = useLocalSearchParams<{ openAdd?: string }>();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [alphaFilter, setAlphaFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Partial<Material> | undefined>();

  useEffect(() => {
    if (openAdd) { setEditTarget(undefined); setModalVisible(true); }
  }, [openAdd]);

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("materials")
      .select("id,name,description,type,cas_number,stock_g,ifra_limit,density_g_per_ml")
      .order("name", { ascending: true });
    setMaterials((data as Material[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);

  const filtered = materials.filter((m) => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) &&
        !(m.cas_number ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== "all" && m.type !== typeFilter) return false;
    if (alphaFilter !== "all") {
      const range = ALPHA_RANGES.find((r) => r.label === alphaFilter);
      if (range) {
        const first = m.name[0]?.toLowerCase() ?? "";
        if (first < range.from || first > range.to) return false;
      }
    }
    return true;
  });

  const handleDelete = (id: number, name: string) => {
    Alert.alert("Delete Material", `Remove "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await supabase.from("materials").delete().eq("id", id);
          fetchMaterials();
        },
      },
    ]);
  };

  return (
    <GradientScreen gradient="materials">
      {/* Header */}
      <View style={s.header}>
        <Text style={s.pageTitle}>Organ</Text>

        {/* Search */}
        <BlurView intensity={24} tint="dark" style={s.searchWrap}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 16 }]} />
          <TextInput
            style={s.searchInput}
            placeholder="Search by name or CAS…"
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 16, paddingRight: 12 }}>✕</Text>
            </TouchableOpacity>
          )}
        </BlurView>

        {/* Type filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow}>
          {["all", ...TYPE_OPTIONS].map((opt) => (
            <Chip
              key={opt}
              label={opt === "all" ? "All" : `${SYMBOL_ICONS[opt]} ${opt}`}
              active={typeFilter === opt}
              onPress={() => setTypeFilter(opt)}
            />
          ))}
        </ScrollView>

        {/* Alpha range filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow}>
          <Chip label="All" active={alphaFilter === "all"} onPress={() => setAlphaFilter("all")} />
          {ALPHA_RANGES.map((r) => (
            <Chip
              key={r.label}
              label={r.label}
              active={alphaFilter === r.label}
              onPress={() => setAlphaFilter(alphaFilter === r.label ? "all" : r.label)}
            />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color="#a78bfa" style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <Text style={s.empty}>
              {search || typeFilter !== "all" || alphaFilter !== "all"
                ? "No materials match your filters"
                : "No materials yet. Tap + to add one."}
            </Text>
          }
          renderItem={({ item }) => (
            <MaterialCard
              item={item}
              onEdit={() => { setEditTarget(item); setModalVisible(true); }}
              onDelete={() => handleDelete(item.id, item.name)}
            />
          )}
        />
      )}

      <MaterialModal
        visible={modalVisible}
        initial={editTarget}
        userId={user?.id}
        onClose={() => setModalVisible(false)}
        onSaved={() => { setModalVisible(false); fetchMaterials(); }}
      />
    </GradientScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 8 },
  pageTitle: { color: "#fff", fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },

  searchWrap: { borderRadius: 16, overflow: "hidden", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  searchInput: { flex: 1, color: "#fff", fontSize: 14 },

  filterRow: { flexGrow: 0 },

  chip: { marginRight: 8, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.07)" },
  chipActive: { backgroundColor: "rgba(167,139,250,0.3)", borderColor: "#a78bfa" },
  chipText: { color: "rgba(255,255,255,0.65)", fontSize: 13 },
  chipTextActive: { color: "#fff", fontWeight: "600" },

  // Card
  card: { paddingHorizontal: 14, paddingVertical: 12 },
  cardTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 },
  cardNameRow: { flexDirection: "row", alignItems: "center", gap: 7, flex: 1, marginRight: 8 },
  typeIcon: { color: "#a78bfa", fontSize: 12 },
  cardTitle: { color: "#fff", fontWeight: "600", fontSize: 15, flex: 1 },
  cardActions: { flexDirection: "row", gap: 14 },
  editBtn: { color: "#a78bfa", fontSize: 13 },
  deleteBtn: { color: "#f87171", fontSize: 13 },
  cardDesc: { color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 6 },
  cardMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  cardMeta: { color: "rgba(255,255,255,0.35)", fontSize: 11 },

  // Stock pill — normal vs low
  stockPill: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  stockPillLow: { backgroundColor: "rgba(248,113,113,0.18)", borderWidth: 1, borderColor: "rgba(248,113,113,0.45)" },
  stockText: { color: "rgba(255,255,255,0.45)", fontSize: 11 },
  stockTextLow: { color: "#f87171", fontWeight: "600" },

  empty: { color: "rgba(255,255,255,0.4)", textAlign: "center", marginTop: 56, fontSize: 14 },

  // FAB (glass)
  fab: { position: "absolute", bottom: 28, right: 20, borderRadius: 28, overflow: "hidden", borderWidth: 1, borderColor: "rgba(167,139,250,0.5)" },
  fabInner: { width: 56, height: 56, backgroundColor: "rgba(167,139,250,0.35)", alignItems: "center", justifyContent: "center" },
  fabIcon: { color: "#fff", fontSize: 30, fontWeight: "300", lineHeight: 34 },

  // Modal
  modalScreen: { flex: 1, backgroundColor: "#0e3a1c" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  modalTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  modalCancel: { color: "rgba(255,255,255,0.45)", fontSize: 16 },
  modalSave: { color: "#a78bfa", fontSize: 16, fontWeight: "700" },
  fieldLabel: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 6 },
  input: { backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, color: "#fff", fontSize: 14, marginBottom: 14 },
});
