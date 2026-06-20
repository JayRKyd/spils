import { useState, useEffect, useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Modal, ScrollView, ActivityIndicator, Alert, StyleSheet, Share, Linking,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type Material = {
  id: number;
  name: string;
  description: string | null;
  type: "Top" | "Mid" | "Base" | "Solvent" | "Other" | null;
  types?: string[] | null;
  cas_number?: string | null;
  stock_g?: number | null;
  ifra_limit?: string | null;
  density_g_per_ml?: number | null;
  is_favorite?: boolean;
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

// ─── Dropdown Picker Modal ────────────────────────────────────────────────────

function DropdownModal({
  visible, title, options, selected, onSelect, onClose, icons,
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected: string;
  onSelect: (opt: string) => void;
  onClose: () => void;
  icons?: Record<string, string>;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={dd.overlay} activeOpacity={1} onPress={onClose}>
        <View style={dd.sheet}>
          <Text style={dd.sheetTitle}>{title}</Text>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[dd.option, selected === opt && dd.optionActive]}
              onPress={() => { onSelect(opt); onClose(); }}
            >
              <Text style={[dd.optionText, selected === opt && dd.optionTextActive]}>
                {icons?.[opt] ? `${icons[opt]}  ${opt}` : opt}
              </Text>
              {selected === opt && <Text style={dd.check}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

function MaterialModal({
  visible, initial, userId, onClose, onSaved,
}: {
  visible: boolean;
  initial?: Partial<Material>;
  userId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(initial?.id);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [casNumber, setCasNumber] = useState("");
  const [stockG, setStockG] = useState("");
  const [ifraLimit, setIfraLimit] = useState("");
  const [density, setDensity] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);
  const [moreView, setMoreView] = useState<"main" | "delete" | "share">("main");

  const closeMore = () => { setMoreVisible(false); setMoreView("main"); };
  const shareText = name ? `${name}${description ? ` — ${description}` : ""} (Organ / Spils)` : "Spils — Organ";

  const handleOSShare = async () => { closeMore(); await Share.share({ message: shareText }); };
  const handleEmailShare = () => { closeMore(); Linking.openURL(`mailto:?subject=${encodeURIComponent(name || "Material")}&body=${encodeURIComponent(shareText)}`); };
  const handleSMSShare = () => { closeMore(); Linking.openURL(`sms:?body=${encodeURIComponent(shareText)}`); };
  const handleCopyLink = async () => { await Clipboard.setStringAsync(shareText); closeMore(); Alert.alert("Copied!", "Material text copied to clipboard."); };
  const handleClearAll = () => {
    setName(""); setDescription(""); setTypes([]);
    setCasNumber(""); setStockG(""); setIfraLimit(""); setDensity(""); setIsFavorite(false);
    closeMore();
  };
  const handleDiscard = () => { closeMore(); onClose(); };

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setTypes(initial?.types ?? (initial?.type ? [initial.type] : []));
    setCasNumber(initial?.cas_number ?? "");
    setStockG(initial?.stock_g?.toString() ?? "");
    setIfraLimit(initial?.ifra_limit ?? "");
    setDensity(initial?.density_g_per_ml?.toString() ?? "");
    setIsFavorite(initial?.is_favorite ?? false);
  }, [visible, initial]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      types: types.length ? types : null,
      type: types[0] ?? null,
      cas_number: casNumber.trim() || null,
      stock_g: stockG ? parseFloat(stockG) : null,
      ifra_limit: ifraLimit.trim() || null,
      density_g_per_ml: density ? parseFloat(density) : null,
      is_favorite: isFavorite,
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
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <LinearGradient
        colors={["#E8FF70", "#C6FF00", "#A3D900"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          {/* Top nav */}
          <View style={mo.topNav}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <TouchableOpacity style={mo.backBtn} onPress={onClose}>
                <Text style={mo.backIcon}>‹</Text>
              </TouchableOpacity>
              <Text style={mo.logo}>SP/LS.</Text>
            </View>
            <TouchableOpacity style={mo.profileCircle}>
              <Text style={mo.profileIcon}>👤</Text>
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={mo.pageTitle}>Organ</Text>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Name + heart */}
            <View style={mo.nameWrap}>
              <TextInput
                style={mo.nameInput}
                placeholder="Material"
                placeholderTextColor="rgba(0,0,0,0.35)"
                value={name}
                onChangeText={setName}
              />
              <TouchableOpacity
                onPress={() => setIsFavorite((v) => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[mo.heart, isFavorite && mo.heartActive]}>{isFavorite ? "♥" : "♡"}</Text>
              </TouchableOpacity>
            </View>

            {/* Description */}
            <View style={mo.descWrap}>
              <Text style={mo.descLabel}>Description</Text>
              <TextInput
                style={mo.descInput}
                placeholder="Descripton...Lorem ipsum dolor sit amet..."
                placeholderTextColor="rgba(0,0,0,0.3)"
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* Type chips */}
            <View style={mo.chipsRow}>
              {TYPE_OPTIONS.map((opt) => {
                const active = types.includes(opt);
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[mo.chip, active && mo.chipActive]}
                    onPress={() => setTypes((prev) => active ? prev.filter((t) => t !== opt) : [...prev, opt])}
                  >
                    <Text style={[mo.chipText, active && mo.chipTextActive]}>
                      {SYMBOL_ICONS[opt]} {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* CAS | IFRA | Stock row */}
            <View style={mo.threeRow}>
              <TextInput
                style={mo.threeInput}
                placeholder="CAS Number"
                placeholderTextColor="rgba(0,0,0,0.35)"
                value={casNumber}
                onChangeText={setCasNumber}
              />
              <TextInput
                style={mo.threeInput}
                placeholder="IFRA Limit %"
                placeholderTextColor="rgba(0,0,0,0.35)"
                value={ifraLimit}
                onChangeText={setIfraLimit}
              />
              <TextInput
                style={mo.threeInput}
                placeholder="Stock (g)"
                placeholderTextColor="rgba(0,0,0,0.35)"
                value={stockG}
                onChangeText={setStockG}
                keyboardType="decimal-pad"
              />
            </View>
          </ScrollView>

          {/* Bottom buttons */}
          <SafeAreaView edges={["bottom"]} style={{ backgroundColor: "transparent" }}>
            <View style={mo.bottomRow}>
              {!isEdit ? (
                <TouchableOpacity style={mo.moreBtn} onPress={() => setMoreVisible(true)}>
                  <Text style={mo.moreBtnText}>More</Text>
                </TouchableOpacity>
              ) : <View />}
              <TouchableOpacity
                style={[mo.saveBtn, !name.trim() && { opacity: 0.4 }]}
                onPress={handleSave}
                disabled={saving || !name.trim()}
              >
                {saving
                  ? <ActivityIndicator color="#13131a" size="small" />
                  : <Text style={mo.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* More bottom sheet */}
          <Modal visible={moreVisible} transparent animationType="slide" onRequestClose={closeMore}>
            <View style={ms.backdrop}>
              <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeMore} />
              <View style={ms.sheet}>
                <View style={ms.handle} />
                {moreView === "main" && (
                  <>
                    <TouchableOpacity style={[ms.btn, ms.btnDark]} onPress={handleClearAll}>
                      <Text style={[ms.btnText, ms.btnTextLight]}>Clear All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[ms.btn, ms.btnDelete]} onPress={() => setMoreView("delete")}>
                      <Text style={[ms.btnText, ms.btnTextLight]}>Delete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[ms.btn, ms.btnBlue]} onPress={() => setMoreView("share")}>
                      <Text style={[ms.btnText, ms.btnTextLight]}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[ms.btn, ms.btnBeige]} onPress={() => { closeMore(); Alert.alert("Print", "Print coming soon."); }}>
                      <Text style={ms.btnText}>Print</Text>
                    </TouchableOpacity>
                  </>
                )}
                {moreView === "delete" && (
                  <>
                    <View style={[ms.btn, ms.btnDelete]}>
                      <Text style={[ms.btnText, ms.btnTextLight]}>Delete</Text>
                    </View>
                    <Text style={ms.confirmText}>Are you sure?</Text>
                    <View style={ms.confirmRow}>
                      <TouchableOpacity style={[ms.btn, { flex: 1 }]} onPress={handleDiscard}>
                        <Text style={ms.btnText}>Yes</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[ms.btn, { flex: 1 }]} onPress={() => setMoreView("main")}>
                        <Text style={ms.btnText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
                {moreView === "share" && (
                  <>
                    <View style={[ms.btn, ms.btnBlue]}>
                      <Text style={[ms.btnText, ms.btnTextLight]}>Share</Text>
                    </View>
                    <TouchableOpacity style={ms.btn} onPress={handleOSShare}>
                      <Text style={ms.btnText}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={ms.btn} onPress={handleEmailShare}>
                      <Text style={ms.btnText}>Email</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={ms.btn} onPress={handleSMSShare}>
                      <Text style={ms.btnText}>Text (SMS)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={ms.btn} onPress={handleCopyLink}>
                      <Text style={ms.btnText}>Copy Link</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

// ─── Material Card ────────────────────────────────────────────────────────────

function MaterialCard({
  item, onEdit, onDelete, onToggleFavorite,
}: {
  item: Material;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  const isLowStock = item.stock_g != null && item.stock_g <= LOW_STOCK_THRESHOLD;
  const primaryType = item.types?.[0] ?? item.type;
  const symbol = primaryType ? SYMBOL_ICONS[primaryType] : "·";
  const casIfra = [
    item.cas_number ? `CAS ${item.cas_number}` : null,
    item.ifra_limit ? `IFRA ${item.ifra_limit}` : null,
  ].filter(Boolean).join("  |  ");

  return (
    <BlurView intensity={55} tint="light" style={cd.card}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.55)", borderRadius: 16 }]} />
      {/* Top row: symbol + name + heart */}
      <View style={cd.topRow}>
        <View style={cd.nameRow}>
          {symbol !== "·" ? <Text style={cd.symbol}>{symbol}</Text> : null}
          <Text style={cd.name} numberOfLines={1}>{item.name}</Text>
        </View>
        <TouchableOpacity
          onPress={onToggleFavorite}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[cd.heart, item.is_favorite && cd.heartActive]}>{item.is_favorite ? "♥" : "♡"}</Text>
        </TouchableOpacity>
      </View>

      {/* Description */}
      {item.description ? (
        <Text style={cd.desc} numberOfLines={3}>{item.description}</Text>
      ) : null}

      {/* Bottom meta row: left group + right Edit|Delete */}
      <View style={cd.metaRow}>
        <View style={cd.metaLeft}>
          {item.stock_g != null ? (
            <View style={[cd.stockPill, isLowStock && cd.stockPillLow]}>
              <Text style={[cd.stockText, isLowStock && cd.stockTextLow]}>
                {isLowStock ? `Low ${item.stock_g}g` : `${item.stock_g}g`}
              </Text>
            </View>
          ) : null}
          {casIfra ? (
            <Text style={cd.casText} numberOfLines={1}>{casIfra}</Text>
          ) : null}
        </View>
        <View style={cd.actions}>
          <TouchableOpacity onPress={onEdit}>
            <Text style={cd.editBtn}>Edit</Text>
          </TouchableOpacity>
          <Text style={cd.actionSep}> | </Text>
          <TouchableOpacity onPress={onDelete}>
            <Text style={cd.deleteBtn}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BlurView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function Materials() {
  const { user } = useAuth();
  const { openAdd } = useLocalSearchParams<{ openAdd?: string }>();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [search, setSearch] = useState("");
  const [compFilter, setCompFilter] = useState("All");
  const [indexFilter, setIndexFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Partial<Material> | undefined>();
  const [compDropVisible, setCompDropVisible] = useState(false);
  const [indexDropVisible, setIndexDropVisible] = useState(false);
  const [ifraBannerVisible, setIfraBannerVisible] = useState(true);
  const [csvImportVisible, setCsvImportVisible] = useState(false);
  const [csvPreview, setCsvPreview] = useState<Array<Record<string, string>> | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);

  useEffect(() => {
    if (openAdd) { setEditTarget(undefined); setModalVisible(true); }
  }, [openAdd]);

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("materials")
      .select("*")
      .eq("user_id", user?.id)
      .order("name", { ascending: true });
    setMaterials((data as Material[]) ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);

  const filtered = materials.filter((m) => {
    if (
      search &&
      !m.name.toLowerCase().includes(search.toLowerCase()) &&
      !(m.cas_number ?? "").toLowerCase().includes(search.toLowerCase())
    ) return false;
    if (compFilter !== "All") {
      const matTypes = m.types?.length ? m.types : (m.type ? [m.type] : []);
      if (!matTypes.includes(compFilter)) return false;
    }
    if (indexFilter === "Favorites") {
      if (!m.is_favorite) return false;
    } else if (indexFilter === "Recently Added") {
      // pass — handled by sort below
    } else if (indexFilter !== "All") {
      const range = ALPHA_RANGES.find((r) => r.label === indexFilter);
      if (range) {
        const first = m.name[0]?.toLowerCase() ?? "";
        if (first < range.from || first > range.to) return false;
      }
    }
    return true;
  });

  const displayed = indexFilter === "Recently Added"
    ? [...filtered].sort((a, b) => b.id - a.id).slice(0, 30)
    : filtered;

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

  const handleToggleFavorite = async (item: Material) => {
    const newVal = !item.is_favorite;
    setMaterials((prev) =>
      prev.map((m) => m.id === item.id ? { ...m, is_favorite: newVal } : m)
    );
    await supabase.from("materials").update({ is_favorite: newVal }).eq("id", item.id);
  };

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = values[i] ?? ""; });
      return obj;
    }).filter((row) => row.name?.trim());
  };

  const handlePickCSV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "text/plain", "*/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const text = await fetch(result.assets[0].uri).then((r) => r.text());
      const rows = parseCSV(text);
      if (!rows.length) {
        Alert.alert("No data", "Could not parse any materials. Make sure the first row has a 'name' column.");
        return;
      }
      setCsvPreview(rows);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to read file");
    }
  };

  const handleImportCSV = async () => {
    if (!csvPreview) return;
    setCsvImporting(true);
    const VALID_TYPES = ["Top", "Mid", "Base", "Solvent", "Other"];
    try {
      for (const row of csvPreview) {
        const typeVal = VALID_TYPES.find((t) => t.toLowerCase() === (row.type ?? "").toLowerCase()) ?? null;
        await supabase.from("materials").insert([{
          name: row.name.trim(),
          description: row.description?.trim() || null,
          type: typeVal,
          types: typeVal ? [typeVal] : null,
          cas_number: row.cas_number?.trim() || null,
          ifra_limit: row.ifra_limit?.trim() || null,
          stock_g: row.stock_g ? parseFloat(row.stock_g) : null,
          user_id: user?.id,
        }]);
      }
      setCsvImportVisible(false);
      setCsvPreview(null);
      fetchMaterials();
      Alert.alert("Imported!", `${csvPreview.length} material${csvPreview.length !== 1 ? "s" : ""} added to your Organ.`);
    } catch (e: any) {
      Alert.alert("Import failed", e.message ?? "Something went wrong");
    } finally {
      setCsvImporting(false);
    }
  };

  const compOptions = ["All", ...TYPE_OPTIONS];
  const indexOptions = ["All", "Favorites", "Recently Added", ...ALPHA_RANGES.map((r) => r.label)];
  const compActive = compFilter !== "All";
  const indexActive = indexFilter !== "All";

  return (
    <LinearGradient
      colors={["#E8FF70", "#C6FF00", "#A3D900"]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        {/* Top nav */}
        <View style={s.topNav}>
          <Text style={s.logo}>SP/LS.</Text>
          <View style={s.profileCircle}>
            <Text style={s.profileIcon}>⚪</Text>
          </View>
        </View>

        {/* Page title */}
        <Text style={s.pageTitle}>Organ</Text>

        {/* Search bar */}
        <View style={s.searchWrap}>
          <Text style={s.searchIconText}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Search by name of CAS..."
            placeholderTextColor="rgba(0,0,0,0.38)"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Text style={s.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter row */}
        <View style={s.filterRow}>
          <View style={s.filterLeft}>
            <TouchableOpacity
              style={[s.filterChip, compActive && s.filterChipActive]}
              onPress={() => setCompDropVisible(true)}
            >
              <Text style={[s.filterChipText, compActive && s.filterChipTextActive]}>
                {compActive ? compFilter : "Composition"} ▾
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.filterChip, indexActive && s.filterChipActive]}
              onPress={() => setIndexDropVisible(true)}
            >
              <Text style={[s.filterChipText, indexActive && s.filterChipTextActive]}>
                {indexActive ? indexFilter : "Index"} ▾
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.importBtn} onPress={() => { setCsvPreview(null); setCsvImportVisible(true); }}>
            <Text style={s.importBtnText}>Import .CSV</Text>
          </TouchableOpacity>
        </View>

        {/* List */}
        {loading ? (
          <ActivityIndicator color="#13131a" style={{ marginTop: 48 }} />
        ) : (
          <FlatList
            data={displayed}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 }}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={
              <Text style={s.empty}>
                {search || compActive || indexActive
                  ? "No materials match your filters."
                  : "No materials yet. Tap + to add one."}
              </Text>
            }
            renderItem={({ item }) => (
              <MaterialCard
                item={item}
                onEdit={() => { setEditTarget(item); setModalVisible(true); }}
                onDelete={() => handleDelete(item.id, item.name)}
                onToggleFavorite={() => handleToggleFavorite(item)}
              />
            )}
          />
        )}

        {/* IFRA notice banner */}
        <Modal visible={ifraBannerVisible} transparent animationType="fade" onRequestClose={() => setIfraBannerVisible(false)}>
          <View style={s.bannerOverlay}>
            <View style={s.bannerCard}>
              <TouchableOpacity style={s.bannerClose} onPress={() => setIfraBannerVisible(false)}>
                <Text style={s.bannerCloseText}>✕</Text>
              </TouchableOpacity>
              <Text style={s.bannerHeading}>IFRA Compliance Coming Soon:</Text>
              <Text style={s.bannerBody}>
                Always double-check your formulas against{"\n"}IFRA guidelines.{"\n"}Our full IFRA assistant will arrive in future updates.
              </Text>
            </View>
          </View>
        </Modal>

        {/* CSV Import modal */}
        <Modal visible={csvImportVisible} transparent animationType="fade" onRequestClose={() => setCsvImportVisible(false)}>
          <View style={s.bannerOverlay}>
            <View style={s.bannerCard}>
              <TouchableOpacity style={s.bannerClose} onPress={() => setCsvImportVisible(false)}>
                <Text style={s.bannerCloseText}>✕</Text>
              </TouchableOpacity>
              <Text style={s.bannerHeading}>Import .CSV</Text>
              {!csvPreview ? (
                <>
                  <Text style={s.bannerBody}>
                    Expected columns (first row = headers):{"\n\n"}
                    <Text style={{ color: "#C6FF00", fontFamily: "monospace" }}>
                      name, type, cas_number,{"\n"}ifra_limit, stock_g, description
                    </Text>
                    {"\n\n"}Type must be: Top, Mid, Base, Solvent, or Other.
                  </Text>
                  <TouchableOpacity
                    style={[mo.saveBtn, { alignSelf: "center", marginTop: 20 }]}
                    onPress={handlePickCSV}
                  >
                    <Text style={mo.saveBtnText}>Choose File</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={[s.bannerBody, { marginBottom: 12 }]}>
                    {csvPreview.length} material{csvPreview.length !== 1 ? "s" : ""} ready to import:
                  </Text>
                  <ScrollView style={{ maxHeight: 180 }}>
                    {csvPreview.map((row, i) => (
                      <Text key={i} style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, marginBottom: 4 }}>
                        • {row.name}{row.type ? ` (${row.type})` : ""}
                      </Text>
                    ))}
                  </ScrollView>
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
                    <TouchableOpacity style={[mo.moreBtn, { flex: 1, alignItems: "center" }]} onPress={() => setCsvPreview(null)}>
                      <Text style={mo.moreBtnText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[mo.saveBtn, { flex: 1, alignItems: "center" }]}
                      onPress={handleImportCSV}
                      disabled={csvImporting}
                    >
                      {csvImporting
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={mo.saveBtnText}>Import All</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Dropdown modals */}
        <DropdownModal
          visible={compDropVisible}
          title="Composition"
          options={compOptions}
          selected={compFilter}
          onSelect={setCompFilter}
          onClose={() => setCompDropVisible(false)}
          icons={SYMBOL_ICONS}
        />
        <DropdownModal
          visible={indexDropVisible}
          title="Index"
          options={indexOptions}
          selected={indexFilter}
          onSelect={setIndexFilter}
          onClose={() => setIndexDropVisible(false)}
        />

        {/* Add / Edit modal */}
        <MaterialModal
          visible={modalVisible}
          initial={editTarget}
          userId={user?.id}
          onClose={() => setModalVisible(false)}
          onSaved={() => { setModalVisible(false); fetchMaterials(); }}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

// Main screen
const s = StyleSheet.create({
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 2,
  },
  logo: { fontSize: 20, fontWeight: "900", color: "#13131a", letterSpacing: -0.5 },
  profileCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileIcon: { fontSize: 16 },

  pageTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#13131a",
    letterSpacing: -1,
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 12,
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.55)",
    borderRadius: 24,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  },
  searchIconText: { fontSize: 15, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: "#13131a" },
  searchClear: { color: "rgba(0,0,0,0.3)", fontSize: 15, paddingLeft: 8 },

  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  filterLeft: { flexDirection: "row", gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  },
  filterChipActive: {
    backgroundColor: "#13131a",
    borderColor: "#13131a",
  },
  filterChipText: { fontSize: 13, fontWeight: "600", color: "#13131a" },
  filterChipTextActive: { color: "#C6FF00" },

  importBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.55)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  },
  importBtnText: { fontSize: 13, fontWeight: "600", color: "#13131a" },

  empty: {
    color: "rgba(0,0,0,0.45)",
    textAlign: "center",
    marginTop: 56,
    fontSize: 14,
  },


  bannerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  bannerCard: {
    backgroundColor: "#13131a",
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 26,
    width: "100%",
  },
  bannerClose: {
    position: "absolute",
    top: 14,
    right: 16,
    padding: 6,
  },
  bannerCloseText: { color: "rgba(255,255,255,0.5)", fontSize: 16 },
  bannerHeading: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
    marginTop: 8,
    paddingRight: 24,
    textAlign: "center",
  },
  bannerBody: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
});

// Card
const cd = StyleSheet.create({
  card: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, marginRight: 8 },
  symbol: { fontSize: 13, color: "#13131a", marginTop: 1 },
  name: { fontSize: 15, fontWeight: "700", color: "#13131a", flex: 1 },
  heart: { fontSize: 20, color: "rgba(19,19,26,0.4)" },
  heartActive: { color: "#13131a" },

  desc: {
    fontSize: 13,
    color: "#13131a",
    lineHeight: 18,
    marginBottom: 10,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  stockPill: {
    backgroundColor: "transparent",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#13131a",
  },
  stockPillLow: {
    backgroundColor: "#e53535",
    borderColor: "#e53535",
  },
  stockText: { fontSize: 11, fontWeight: "600", color: "#13131a" },
  stockTextLow: { color: "#ffffff" },
  casText: {
    fontSize: 11,
    color: "#13131a",
    flexShrink: 1,
  },
  actions: { flexDirection: "row", alignItems: "center" },
  editBtn: { fontSize: 13, color: "#13131a", fontWeight: "600" },
  actionSep: { fontSize: 13, color: "#cccccc" },
  deleteBtn: { fontSize: 13, color: "#13131a", fontWeight: "600" },
});

// Dropdown modal
const dd = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  sheet: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 0,
    width: 260,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(0,0,0,0.4)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  optionActive: { backgroundColor: "rgba(198,255,0,0.15)" },
  optionText: { fontSize: 15, color: "#13131a" },
  optionTextActive: { fontWeight: "700", color: "#13131a" },
  check: { fontSize: 15, color: "#7AAD00", fontWeight: "700" },
});

// Add/Edit modal
const mo = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f5f5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.08)",
    backgroundColor: "#fff",
  },
  title: { fontSize: 17, fontWeight: "700", color: "#13131a" },
  cancel: { fontSize: 16, color: "rgba(0,0,0,0.4)" },
  save: { fontSize: 16, fontWeight: "700", color: "#7AAD00" },
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 4,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.08)",
    borderWidth: 1, borderColor: "rgba(0,0,0,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  backIcon: { color: "#13131a", fontSize: 24, fontWeight: "300", lineHeight: 28, marginTop: -2 },
  logo: { fontSize: 20, fontWeight: "800", color: "#13131a", letterSpacing: 1 },
  profileCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.08)",
    borderWidth: 1, borderColor: "rgba(0,0,0,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  profileIcon: { fontSize: 16 },
  pageTitle: {
    fontSize: 32, fontWeight: "800", color: "#13131a",
    letterSpacing: -1, paddingHorizontal: 20, marginTop: 6, marginBottom: 16,
  },

  nameWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 12,
  },
  nameInput: { flex: 1, fontSize: 15, color: "#13131a", fontWeight: "500" },
  heart: { fontSize: 22, color: "rgba(19,19,26,0.4)" },
  heartActive: { color: "#13131a" },

  descWrap: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    marginBottom: 16,
  },
  descLabel: { fontSize: 12, fontWeight: "600", color: "rgba(0,0,0,0.45)", marginBottom: 6 },
  descInput: { fontSize: 14, color: "#13131a", minHeight: 80 },

  chipsRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 6,
    marginBottom: 16,
  },
  chip: {
    flex: 1,
    paddingHorizontal: 6, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1,
    borderColor: "rgba(0,0,0,0.25)",
    backgroundColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
  },
  chipActive: { backgroundColor: "#13131a", borderColor: "#13131a" },
  chipText: { fontSize: 12, color: "#13131a", textAlign: "center" },
  chipTextActive: { color: "#C6FF00", fontWeight: "600" },

  threeRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  threeInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    paddingHorizontal: 10,
    paddingVertical: 14,
    fontSize: 12,
    color: "#13131a",
    textAlign: "center",
  },

  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  moreBtn: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  moreBtnText: { color: "#13131a", fontSize: 14 },
  saveBtn: {
    backgroundColor: "#C6FF00",
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

const ms = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 10 },
  handle: { width: 40, height: 4, backgroundColor: "rgba(0,0,0,0.15)", borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  btn: { borderWidth: 1, borderColor: "rgba(0,0,0,0.15)", borderRadius: 100, paddingVertical: 16, alignItems: "center" },
  btnDark: { backgroundColor: "#13131a", borderColor: "#13131a" },
  btnBlue: { backgroundColor: "#30B8E8", borderColor: "#30B8E8" },
  btnBeige: { backgroundColor: "#EDE5D8", borderColor: "#EDE5D8" },
  btnDelete: { backgroundColor: "#FF2D55", borderColor: "#FF2D55" },
  btnText: { color: "#13131a", fontSize: 15, fontWeight: "500" },
  btnTextLight: { color: "#fff" },
  confirmText: { color: "#13131a", fontSize: 17, fontWeight: "600", textAlign: "center", marginVertical: 16 },
  confirmRow: { flexDirection: "row", gap: 12 },
});
