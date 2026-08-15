import { useState, useEffect, useCallback } from "react";
import { ProfileIcon } from "@/components/ProfileIcon";
import { SpilsLogo } from "../../components/SpilsLogo";
import { useLocalSearchParams, router } from "expo-router";
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  Modal, ScrollView, ActivityIndicator, Alert, StyleSheet, Share, Linking,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
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
  stock_entered_unit?: string | null;
  ifra_limit?: string | null;
  density_g_per_ml?: number | null;
  is_favorite?: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = "#33FF00";

const SYMBOL_ICONS: Record<string, string> = {
  Top: "▲", Mid: "●", Base: "■", Diluent: "★", Solvent: "★",
};

const TYPE_OPTIONS = ["Top", "Mid", "Base", "Diluent"] as const;
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
  const [unit, setUnit] = useState<"g" | "mL">("g");
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
  // Delete: removes the material when editing; discards the draft when adding
  const handleDeleteConfirmed = async () => {
    closeMore();
    if (isEdit && initial?.id) {
      await supabase.from("materials").delete().eq("id", initial.id);
      onSaved();
    } else {
      onClose();
    }
  };

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setTypes(initial?.types ?? (initial?.type ? [initial.type] : []));
    setCasNumber(initial?.cas_number ?? "");
    setStockG(initial?.stock_g?.toString() ?? "");
    setUnit(((initial as any)?.stock_entered_unit === "ml" ? "mL" : "g"));
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
      stock_entered_unit: unit === "mL" ? "ml" : "g",
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
        colors={["#000000", "#000000", ACCENT]}
        locations={[0, 0.82, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          {/* Top nav */}
          <View style={mo.topNav}>
            <SpilsLogo height={22} color="#edff8d" />
            <TouchableOpacity style={[mo.profileCircle, { backgroundColor: "transparent", borderWidth: 0 }]} onPress={() => router.push("/(tabs)/profile" as any)}>
              <ProfileIcon size={34} />
            </TouchableOpacity>
          </View>

          {/* Back carrot + title */}
          <View style={mo.headerRow}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={mo.backCarrot}>‹</Text>
            </TouchableOpacity>
            <Text style={mo.pageTitle}>Organ</Text>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 30, paddingBottom: 120, paddingTop: 48 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Name + heart */}
            <View style={mo.nameBox}>
              <TextInput
                style={mo.nameInput}
                placeholder="Type Material Name Here"
                placeholderTextColor="rgba(255,255,255,0.4)"
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
            <TextInput
              style={mo.descBox}
              placeholder="Description..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />

            {/* CAS | Stock (g/mL) | IFRA row */}
            <View style={mo.threeRow}>
              <TextInput
                style={mo.threeInput}
                placeholder="CAS #"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={casNumber}
                onChangeText={setCasNumber}
              />
              <View style={[mo.threeInput, mo.stockField]}>
                <TextInput
                  style={mo.stockInput}
                  placeholder="Stock"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={stockG}
                  onChangeText={setStockG}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity style={mo.unitToggle} onPress={() => setUnit((u) => (u === "g" ? "mL" : "g"))}>
                  <Text style={mo.unitToggleText}>{unit}</Text>
                </TouchableOpacity>
              </View>
              <View style={[mo.threeInput, mo.ifraDisabled]}>
                <TextInput
                  style={mo.threeInputText}
                  placeholder="IFRA %"
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  value={ifraLimit}
                  editable={false}
                />
              </View>
            </View>

            {/* Symbol / composition selector */}
            <View style={mo.symbolRow}>
              {[{ v: "Top", l: "TOP" }, { v: "Mid", l: "MIDDLE" }, { v: "Base", l: "BASE" }, { v: "Diluent", l: "DILUENT" }].map(({ v, l }) => {
                const active = types.includes(v);
                return (
                  <View key={v} style={mo.symbolCol}>
                    <TouchableOpacity
                      style={[mo.symbolBox, active && mo.symbolBoxActive]}
                      onPress={() => setTypes((prev) => active ? prev.filter((t) => t !== v) : [...prev, v])}
                    >
                      <Text style={[mo.symbolGlyph, active && mo.symbolGlyphActive]}>{SYMBOL_ICONS[v]}</Text>
                    </TouchableOpacity>
                    <Text style={[mo.symbolLabel, active && mo.symbolLabelActive]}>{l}</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>

          {/* Bottom buttons */}
          <SafeAreaView edges={["bottom"]} style={{ backgroundColor: "transparent" }}>
            <View style={mo.bottomRow}>
              <TouchableOpacity style={mo.moreBtn} onPress={() => setMoreVisible(true)}>
                <Text style={mo.moreBtnText}>More</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[mo.saveBtn, !name.trim() && { opacity: 0.4 }]}
                onPress={handleSave}
                disabled={saving || !name.trim()}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
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
                    <TouchableOpacity style={[ms.btn, ms.btnBlue]} onPress={() => setMoreView("share")}>
                      <Text style={[ms.btnText, ms.btnTextLight]}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[ms.btn, ms.btnBeige]} onPress={() => { closeMore(); Alert.alert("Print", "Print coming soon."); }}>
                      <Text style={[ms.btnText, { color: "rgba(19,19,26,0.55)" }]}>Print</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[ms.btn, ms.btnMagenta]} onPress={() => setMoreView("delete")}>
                      <Text style={[ms.btnText, ms.btnTextLight]}>Delete</Text>
                    </TouchableOpacity>
                  </>
                )}
                {moreView === "share" && (
                  <>
                    <View style={[ms.btn, ms.btnBlue]}>
                      <Text style={[ms.btnText, ms.btnTextLight]}>Share</Text>
                    </View>
                    <TouchableOpacity style={ms.btn} onPress={handleOSShare}>
                      <Text style={ms.btnText}>OS Share</Text>
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
                {moreView === "delete" && (
                  <>
                    <View style={[ms.btn, ms.btnMagenta]}>
                      <Text style={[ms.btnText, ms.btnTextLight]}>Delete</Text>
                    </View>
                    <Text style={ms.confirmText}>Are you sure?</Text>
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <TouchableOpacity style={[ms.btn, { flex: 1 }]} onPress={handleDeleteConfirmed}>
                        <Text style={ms.btnText}>Yes</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[ms.btn, { flex: 1 }]} onPress={() => setMoreView("main")}>
                        <Text style={ms.btnText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
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
  item, onEdit, onToggleFavorite,
}: {
  item: Material;
  onEdit: () => void;
  onToggleFavorite: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLowStock = item.stock_g != null && item.stock_g <= LOW_STOCK_THRESHOLD;
  const allTypes = item.types?.length ? item.types : (item.type ? [item.type] : []);
  const casIfra = [
    item.cas_number ? `CAS ${item.cas_number}` : null,
    item.ifra_limit ? `IFRA ${item.ifra_limit}` : null,
  ].filter(Boolean).join("  |  ");

  return (
    <TouchableOpacity style={cd.card} activeOpacity={0.85} onPress={() => setExpanded((v) => !v)}>
      {/* Top row: symbol + name + heart */}
      <View style={cd.topRow}>
        <View style={cd.nameRow}>
          {allTypes.map((t) => SYMBOL_ICONS[t] ? <Text key={t} style={cd.symbol}>{SYMBOL_ICONS[t]}</Text> : null)}
          <Text style={cd.name} numberOfLines={1}>{item.name}</Text>
        </View>
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); onToggleFavorite(); }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[cd.heart, item.is_favorite && cd.heartActive]}>{item.is_favorite ? "♥" : "♡"}</Text>
        </TouchableOpacity>
      </View>

      {/* Notes (drawer) */}
      {expanded ? (
        <Text style={cd.desc} numberOfLines={4}>
          {item.description || "One line of notes will go here…"}
        </Text>
      ) : null}

      {/* Bottom meta row: stock pill + CAS | IFRA + Edit (when open) */}
      <View style={cd.metaRow}>
        <View style={cd.metaLeft}>
          {item.stock_g != null ? (
            <View style={[cd.stockPill, isLowStock && cd.stockPillLow]}>
              <Text style={[cd.stockText, isLowStock && cd.stockTextLow]}>{item.stock_g}{item.stock_entered_unit === "ml" ? "mL" : "g"}</Text>
            </View>
          ) : null}
          {casIfra ? (
            <Text style={cd.casText} numberOfLines={1}>{casIfra}</Text>
          ) : null}
        </View>
        {expanded ? (
          <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); onEdit(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={cd.editBtn}>Edit</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
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

  const seedStarterMaterials = useCallback(async () => {
    if (!user?.id) return;
    const { data: prof } = await supabase.from("profiles").select("organ_starter_seeded").eq("id", user.id).single();
    if (!prof || (prof as any).organ_starter_seeded) return;
    const { data: starters } = await supabase.from("materials").select("*").eq("is_starter", true);
    const { data: mine } = await supabase.from("materials").select("name").eq("user_id", user.id);
    const myNames = new Set((mine ?? []).map((m: any) => (m.name ?? "").toLowerCase()));
    const clones = (starters ?? [])
      .filter((st: any) => !myNames.has((st.name ?? "").toLowerCase()))
      .map(({ id: _id, ...rest }: any) => ({ ...rest, user_id: user.id, is_starter: false, is_favorite: false }));
    if (clones.length) await supabase.from("materials").insert(clones);
    await supabase.from("profiles").update({ organ_starter_seeded: true }).eq("id", user.id);
  }, [user?.id]);

  useEffect(() => {
    (async () => { await seedStarterMaterials(); await fetchMaterials(); })();
  }, [seedStarterMaterials, fetchMaterials]);

  const filtered = materials.filter((m) => {
    if (
      search &&
      !m.name.toLowerCase().includes(search.toLowerCase()) &&
      !(m.cas_number ?? "").toLowerCase().includes(search.toLowerCase())
    ) return false;
    if (compFilter !== "All") {
      const matTypes = m.types?.length ? m.types : (m.type ? [m.type] : []);
      const wanted = compFilter === "Diluent" ? ["Diluent", "Solvent"] : [compFilter];
      if (!matTypes.some((t) => wanted.includes(t))) return false;
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

  const handleToggleFavorite = async (item: Material) => {
    const newVal = !item.is_favorite;
    setMaterials((prev) =>
      prev.map((m) => m.id === item.id ? { ...m, is_favorite: newVal } : m)
    );
    await supabase.from("materials").update({ is_favorite: newVal }).eq("id", item.id);
  };

  // Quote-aware CSV field splitter (handles commas inside "quoted" cells + escaped "")
  const parseCSVLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
        } else cur += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((v) => v.trim());
  };

  // Accept both the SPILS template headers and the legacy ones
  const CSV_HEADER_ALIASES: Record<string, string> = {
    symbols: "symbols", symbol: "symbols",
    name: "name",
    notes: "description", description: "description",
    cas: "cas_number", "cas number": "cas_number", cas_number: "cas_number",
    ifra: "ifra_limit", "ifra limit": "ifra_limit", ifra_limit: "ifra_limit",
    "stock (g/ml)": "stock", stock: "stock", stock_g: "stock",
    type: "type",
  };

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.replace(/^﻿/, "").trim().split(/\r?\n/).filter((l) => l.trim().length); // strips UTF-8 BOM first
    // Skip any preamble rows (e.g. a title line) — the header is the first row containing "name"
    const headerIdx = lines.findIndex((l) => parseCSVLine(l).some((c) => c.toLowerCase() === "name"));
    if (headerIdx === -1 || headerIdx === lines.length - 1) return [];
    const headers = parseCSVLine(lines[headerIdx]).map((h) => CSV_HEADER_ALIASES[h.toLowerCase()] ?? h.toLowerCase());
    return lines.slice(headerIdx + 1).map((line) => {
      const values = parseCSVLine(line);
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = values[i] ?? ""; });
      return obj;
    }).filter((row) => row.name?.trim());
  };

  // BOM prefix so Excel renders the ▲●■★ symbols correctly when the template is opened there
  const CSV_TEMPLATE =
    "﻿" +
    "Symbols,Name,Notes,CAS,IFRA,Stock (g/ml)\n" +
    '▲,Bergamot Oil,"Fresh, zesty, and slightly floral citrus aroma.",8007-75-8,,100\n' +
    '●,Jasmine Absolute,"Rich, opulent floral with deep jasmine character.",8007-01-0,,50\n' +
    '■,Sandalwood Oil,"Creamy, smooth, woody fragrance with depth.",8006-87-9,,25\n' +
    '★,Ethanol 95%,Common solvent and carrier for perfume blends.,64-17-5,,500\n' +
    '▲●,Hedione,"Soft, fresh jasmine-like aroma with airy clarity.",24851-98-7,,100\n';

  const handleDownloadTemplate = async () => {
    try {
      const path = `${FileSystem.cacheDirectory}SPILS_Organ_Template.csv`;
      await FileSystem.writeAsStringAsync(path, CSV_TEMPLATE);
      await Share.share({ url: path, title: "SPILS Organ CSV Template" });
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Could not create template");
    }
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
    const SYMBOL_TO_TYPE: Record<string, string> = { "▲": "Top", "●": "Mid", "■": "Base", "★": "Solvent" };
    try {
      const existing = new Set(materials.map((m) => m.name.trim().toLowerCase()));
      const rows = csvPreview.filter((row) => !existing.has(row.name.trim().toLowerCase()));
      const skipped = csvPreview.length - rows.length;
      const payload = rows.map((row) => {
        const types: string[] = [];
        for (const ch of row.symbols ?? "") {
          const t = SYMBOL_TO_TYPE[ch];
          if (t && !types.includes(t)) types.push(t);
        }
        if (!types.length && row.type) {
          const legacyRaw = row.type.trim().toLowerCase();
          const legacy = legacyRaw === "diluent" ? "Solvent" : VALID_TYPES.find((t) => t.toLowerCase() === legacyRaw);
          if (legacy) types.push(legacy);
        }
        const stockNum = parseFloat(row.stock ?? "");
        return {
          name: row.name.trim(),
          description: row.description?.trim() || null,
          type: types[0] ?? null,
          types: types.length ? types : null,
          cas_number: row.cas_number?.trim() || null,
          ifra_limit: row.ifra_limit?.trim() || null,
          stock_g: Number.isFinite(stockNum) ? stockNum : null,
          user_id: user?.id,
        };
      });
      if (payload.length) {
        const { error } = await supabase.from("materials").insert(payload);
        if (error) throw error;
      }
      setCsvImportVisible(false);
      setCsvPreview(null);
      fetchMaterials();
      Alert.alert(
        "Imported!",
        `${payload.length} material${payload.length !== 1 ? "s" : ""} added to your Organ.` +
          (skipped ? `\n${skipped} skipped (already in your Organ).` : "")
      );
    } catch (e: any) {
      Alert.alert("Import failed", e.message ?? "Something went wrong");
    } finally {
      setCsvImporting(false);
    }
  };

  const compOptions = ["All", ...TYPE_OPTIONS];
  const indexOptions = ["All", "Recently Added", "Favorites", ...ALPHA_RANGES.map((r) => r.label)];
  const compActive = compFilter !== "All";
  const indexActive = indexFilter !== "All";

  return (
    <LinearGradient
      colors={["#000000", "#000000", ACCENT]}
      locations={[0, 0.82, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        {/* Top nav */}
        <View style={s.topNav}>
          <SpilsLogo height={22} color="#edff8d" />
          <TouchableOpacity style={[s.profileCircle, { backgroundColor: "transparent", borderWidth: 0 }]} onPress={() => router.push("/(tabs)/profile" as any)}>
            <ProfileIcon size={34} />
          </TouchableOpacity>
        </View>

        {/* Page title */}
        <Text style={s.pageTitle}>Organ</Text>

        {/* Search bar — pill inside */}
        <View style={s.searchRow}>
          <View style={s.searchWrap}>
            <TextInput
              style={s.searchInput}
              placeholder="Search by name or CAS..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Text style={s.searchClear}>✕</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.searchBtn} onPress={() => {}}>
              <Text style={s.searchBtnText}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter row */}
        <View style={s.filterRow}>
          <TouchableOpacity
            style={[s.filterChip, compActive && s.filterChipActive]}
            onPress={() => setCompDropVisible(true)}
          >
            <Text style={[s.filterChipText, compActive && s.filterChipTextActive]} numberOfLines={1}>
              {compActive ? compFilter : "Composition"}
            </Text>
            <Text style={[s.filterChipChevron, compActive && s.filterChipTextActive]}>⌄</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.filterChip, indexActive && s.filterChipActive]}
            onPress={() => setIndexDropVisible(true)}
          >
            <Text style={[s.filterChipText, indexActive && s.filterChipTextActive]} numberOfLines={1}>
              {indexActive ? indexFilter : "Index"}
            </Text>
            <Text style={[s.filterChipChevron, indexActive && s.filterChipTextActive]}>⌄</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.importBtn} onPress={() => { setCsvPreview(null); setCsvImportVisible(true); }}>
            <Text style={s.importBtnText}>Import</Text>
          </TouchableOpacity>
        </View>

        {/* Low stock alert banner */}
        {!loading && (() => {
          const lowItems = materials.filter((m) => m.stock_g != null && m.stock_g <= LOW_STOCK_THRESHOLD);
          if (!lowItems.length) return null;
          return (
            <View style={s.lowStockBanner}>
              <Text style={s.lowStockIcon}>⚠</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.lowStockTitle}>{lowItems.length} material{lowItems.length > 1 ? "s" : ""} running low</Text>
                <Text style={s.lowStockNames} numberOfLines={1}>
                  {lowItems.map((m) => `${m.name} (${m.stock_g}${m.stock_entered_unit === "ml" ? "mL" : "g"})`).join("  ·  ")}
                </Text>
              </View>
            </View>
          );
        })()}

        {/* List */}
        {loading ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 48 }} />
        ) : (
          <FlatList
            data={displayed}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingHorizontal: 30, paddingTop: 8, paddingBottom: 100 }}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
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
                    Upload your CSV file to auto-populate your Organ.{"\n"}
                    The first row must contain column headers:{"\n\n"}
                    <Text style={{ color: ACCENT, fontFamily: "monospace" }}>
                      Symbols, Name, Notes, CAS,{"\n"}IFRA, Stock (g/ml)
                    </Text>
                    {"\n\n"}Symbols:{"\n"}
                    ▲ Top{"   "}● Mid{"   "}■ Base{"   "}★ Diluent
                  </Text>
                  <TouchableOpacity
                    style={[mo.saveBtn, { alignSelf: "center", marginTop: 20 }]}
                    onPress={handlePickCSV}
                  >
                    <Text style={mo.saveBtnText}>Choose File</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[mo.moreBtn, { alignSelf: "center", marginTop: 12 }]}
                    onPress={handleDownloadTemplate}
                  >
                    <Text style={mo.moreBtnText}>Download Template</Text>
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
                        • {row.symbols ? `${row.symbols} ` : ""}{row.name}
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
    paddingHorizontal: 30,
    paddingTop: 12,
    paddingBottom: 4,
  },
  logo: { fontSize: 20, fontWeight: "900", color: "#edff8d", letterSpacing: -0.5 },
  profileCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileIcon: { fontSize: 16 },

  pageTitle: {
    fontSize: 23,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
    paddingHorizontal: 30,
    marginTop: 73,
    marginBottom: 16,
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 30,
    marginBottom: 14,
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 5,
    paddingVertical: 5,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.6)",
  },
  searchInput: { flex: 1, fontSize: 14, color: "#fff", paddingVertical: 7 },
  searchClear: { color: "rgba(255,255,255,0.4)", fontSize: 15, paddingHorizontal: 6 },
  searchBtn: { backgroundColor: "#fff", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 7 },
  searchBtnText: { fontSize: 12, fontWeight: "600", color: "#13131a" },

  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 30,
    marginBottom: 16,
  },
  filterChip: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
  },
  filterChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  filterChipText: { flex: 1, textAlign: "center", fontSize: 13, fontWeight: "600", color: "#fff" },
  // ⌄ glyph draws low in the line box — pull it up so it sits centered next to the label
  filterChipChevron: { fontSize: 13, fontWeight: "600", color: "#fff", marginTop: -7 },
  filterChipTextActive: { color: "#13131a" },

  importBtn: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
  },
  importBtnText: { fontSize: 13, fontWeight: "600", color: "#fff" },

  lowStockBanner: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 30, marginBottom: 10, backgroundColor: "rgba(229,53,53,0.12)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(229,53,53,0.4)", paddingHorizontal: 14, paddingVertical: 10 },
  lowStockIcon: { fontSize: 18, color: "#ff6b6b" },
  lowStockTitle: { fontSize: 13, fontWeight: "700", color: "#ff8f8f" },
  lowStockNames: { fontSize: 11, color: "rgba(255,143,143,0.85)", marginTop: 2 },

  empty: {
    color: "rgba(255,255,255,0.5)",
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
    backgroundColor: "#141414",
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.9)",
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
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.6)",
    backgroundColor: "transparent",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, marginRight: 8 },
  symbol: { fontSize: 13, color: "#fff", marginTop: 1 },
  name: { fontSize: 15, fontWeight: "700", color: "#fff", flexShrink: 1 },
  heart: { fontSize: 20, color: "rgba(255,255,255,0.4)" },
  heartActive: { color: ACCENT },

  desc: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 19,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  editBtn: { fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: "600" },
  stockPill: {
    backgroundColor: "transparent",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  stockPillLow: {
    backgroundColor: "#e53535",
    borderColor: "#e53535",
  },
  stockText: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.85)" },
  stockTextLow: { color: "#ffffff" },
  casText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    flexShrink: 1,
  },
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
    backgroundColor: "#151515",
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.4)",
    paddingVertical: 8,
    paddingHorizontal: 0,
    width: 260,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.45)",
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
  optionActive: { backgroundColor: "rgba(51,255,0,0.15)" },
  optionText: { fontSize: 15, color: "#fff" },
  optionTextActive: { fontWeight: "700", color: ACCENT },
  check: { fontSize: 15, color: ACCENT, fontWeight: "700" },
});

// Add/Edit modal
const mo = StyleSheet.create({
  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 30,
    paddingTop: 6,
    paddingBottom: 2,
  },
  profileCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  profileIcon: { fontSize: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 30, paddingTop: 24, paddingBottom: 4 },
  backCarrot: { color: "#fff", fontSize: 30, fontWeight: "300", lineHeight: 30, marginTop: -4 },
  pageTitle: { fontSize: 30, fontWeight: "700", color: "#fff", letterSpacing: -0.5 },

  nameBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 14,
  },
  nameInput: { flex: 1, fontSize: 15, color: "#fff", fontWeight: "500", marginRight: 10 },
  heart: { fontSize: 22, color: "rgba(255,255,255,0.45)" },
  heartActive: { color: ACCENT },

  descBox: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 14,
    minHeight: 120,
    marginBottom: 16,
  },

  threeRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  threeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 13,
    fontSize: 13,
    color: "#fff",
  },
  threeInputText: { color: "#fff", fontSize: 13, padding: 0 },
  stockField: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 0, paddingRight: 6 },
  stockInput: { flex: 1, color: "#fff", fontSize: 13, paddingVertical: 13 },
  unitToggle: { backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 4 },
  unitToggleText: { color: "#13131a", fontSize: 11, fontWeight: "700" },
  ifraDisabled: { opacity: 0.8 },

  symbolRow: { flexDirection: "row", gap: 10 },
  symbolCol: { flex: 1, alignItems: "center" },
  symbolBox: { width: "100%", borderWidth: 1, borderColor: "rgba(255,255,255,0.45)", borderRadius: 22, paddingVertical: 10, alignItems: "center" },
  symbolBoxActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  symbolGlyph: { color: "#fff", fontSize: 16 },
  symbolGlyphActive: { color: "#13131a" },
  symbolLabel: { color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "600", letterSpacing: 0.5, marginTop: 6 },
  symbolLabelActive: { color: "#fff" },

  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 40,
    paddingVertical: 16,
  },
  moreBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 26, paddingHorizontal: 34, paddingVertical: 14 },
  moreBtnText: { color: "#fff", fontSize: 15, fontWeight: "500" },
  saveBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 26, paddingHorizontal: 34, paddingVertical: 14 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});

const ms = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 10 },
  handle: { width: 40, height: 4, backgroundColor: "rgba(0,0,0,0.15)", borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  btn: { borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 100, paddingVertical: 16, alignItems: "center" },
  btnBlue: { backgroundColor: "#30B8E8", borderColor: "#30B8E8" },
  btnBeige: { backgroundColor: "#EDE5D8", borderColor: "#EDE5D8" },
  btnMagenta: { backgroundColor: "#EC008C", borderColor: "#EC008C" },
  btnText: { color: "#13131a", fontSize: 15, fontWeight: "500" },
  btnTextLight: { color: "#fff", fontWeight: "600" },
  confirmText: { color: "#13131a", fontSize: 16, fontWeight: "600", textAlign: "center", marginVertical: 10 },
});
