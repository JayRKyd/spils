import { useState, useEffect, useCallback, useMemo } from "react";
import { ProfileIcon } from "@/components/ProfileIcon";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, FlatList, Modal, StyleSheet, Share, Image, Linking,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Video, ResizeMode } from "expo-av";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { SpilsLogo } from "@/components/SpilsLogo";
import { ConfirmModal, ConfirmConfig } from "@/components/ConfirmModal";
import { GlassRow } from "@/components/GlassCard";

const ACCENT = "#EC008C";
const HEART = "#edff8d";

function DarkScreen({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient
      colors={["#000000", "#000000", ACCENT]}
      locations={[0, 0.82, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>{children}</SafeAreaView>
    </LinearGradient>
  );
}

function formulaStatus(lineCount: number, status?: string | null) {
  if (status) return status;
  if (lineCount === 0) return "Draft";
  if (lineCount < 10) return "In Progress";
  return "Final";
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}.${dd}.${yy}`;
}

const SYMBOL_ICONS: Record<string, string> = {
  Top: "▲", Mid: "●", Base: "■", Solvent: "★", Other: "✴",
};

// Sort order for the formula list: Top → Mid → Base → others
const SYMBOL_ORDER: Record<string, number> = { Top: 0, Mid: 1, Base: 2, Solvent: 3, Other: 4 };
function symbolRank(type?: string | null) {
  if (!type) return 5;
  return SYMBOL_ORDER[type] ?? 5;
}

const MOOD_BUCKET = "moodboard";

const DILUENTS = [
  "Ethanol (EtOH)",
  "Perfumer's Alcohol (PA)",
  "Dipropylene Glycol (DPG)",
  "Propylene Glycol (PG)",
  "Isopropyl Myristate (IPM)",
  "Jojoba Oil",
  "Fractionated Coconut Oil",
  "Dowanol",
  "Base de Parfum",
  "Benzyl Benzoate",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Formula {
  id: number;
  name: string;
  description: string | null;
  date_created: string;
  notes: string | null;
  is_favorite?: boolean | null;
  status?: string | null;
}

interface FormulaVersion {
  id: string;
  formula_id: number;
  version_num: number;
  label: string | null;
  created_at: string;
}

interface Material {
  id: number;
  name: string;
  type: string | null;
  cas_number: string | null;
}

interface FormulaLine {
  id: number;
  material_id: number;
  amount_g: number;
  material?: Material;
}

interface MoodItem {
  id: string;
  formula_id: number;
  file_url: string;
  thumb_url: string | null;
  media_type: "image" | "note" | "audio" | "video";
  caption: string | null;
  created_at: string;
  display_url?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeNum(v: any, fallback = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseParams(notes: string | null) {
  const defaults = { bottleSizeMl: 15, concPercent: 20, diluent: "Ethanol (EtOH)" };
  if (!notes) return defaults;
  const bm = notes.match(/Bottle:\s*([\d.]+)mL/);
  const cm = notes.match(/Concentration:\s*([\d.]+)%/);
  const dm = notes.match(/Diluent:\s*([^,\n]+)/);
  return {
    bottleSizeMl: bm ? parseFloat(bm[1]) : defaults.bottleSizeMl,
    concPercent: cm ? parseFloat(cm[1]) : defaults.concPercent,
    diluent: dm ? dm[1].trim() : defaults.diluent,
  };
}

function extractStoragePath(fileUrl: string): string | null {
  const v = (fileUrl ?? "").trim();
  if (!v || v === "EMPTY") return null;
  if (!v.startsWith("http")) return v.replace(/^\/+/, "");
  const idx = v.indexOf("/moodboard/");
  if (idx === -1) return null;
  return decodeURIComponent(v.slice(idx + "/moodboard/".length).split("?")[0]);
}

async function resolveSignedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(MOOD_BUCKET).createSignedUrl(path, 86400);
  return data?.signedUrl ?? null;
}

// ─── Edit Header Modal ────────────────────────────────────────────────────────

// ─── Line Row ─────────────────────────────────────────────────────────────────

function LineRow({ line, totalG, onDelete, onUpdateAmount }: {
  line: FormulaLine; totalG: number; onDelete: () => void; onUpdateAmount: (g: number) => void;
}) {
  const pct = totalG > 0 ? ((line.amount_g / totalG) * 100).toFixed(1) : "0.0";
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(line.amount_g.toString());

  const commit = () => {
    const n = parseFloat(val);
    if (Number.isFinite(n) && n >= 0) onUpdateAmount(n);
    setEditing(false);
  };

  const symbol = line.material?.type ? (SYMBOL_ICONS[line.material.type] ?? "") : "";

  return (
    <View style={s.lineRow}>
      <Text style={s.lineSymbol}>{symbol}</Text>
      <Text style={[s.lineName, { flex: 1, marginRight: 6 }]} numberOfLines={1}>
        {line.material?.name ?? `Material #${line.material_id}`}
      </Text>
      <View style={{ alignItems: "flex-end", marginRight: 2 }}>
        {editing ? (
          <TextInput
            style={s.lineInput}
            value={val} onChangeText={setVal} keyboardType="decimal-pad"
            onBlur={commit} onSubmitEditing={commit} autoFocus
          />
        ) : (
          <TouchableOpacity onPress={() => { setVal(line.amount_g.toString()); setEditing(true); }}>
            <Text style={s.lineAmount}>{line.amount_g.toFixed(3)}g</Text>
          </TouchableOpacity>
        )}
        <Text style={s.linePct}>{pct}%</Text>
      </View>
      <TouchableOpacity style={{ padding: 6, marginLeft: 4, alignSelf: "flex-start" }} onPress={onDelete}>
        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 18, lineHeight: 18 }}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Add Mood Item Modal ──────────────────────────────────────────────────────

function AddMoodItemModal({ visible, formulaId, onClose, onAdded }: {
  visible: boolean; formulaId: number; onClose: () => void; onAdded: () => void;
}) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>("image/jpeg");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) { setImageUri(null); setImageMimeType("image/jpeg"); }
  }, [visible]);

  const pickImage = async (source: "camera" | "library") => {
    const opts = { mediaTypes: ["images"] as any, allowsEditing: false, quality: 0.75 };
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageMimeType(asset.mimeType ?? "image/jpeg");
    }
  };

  const handleImageTap = () => Alert.alert("Add Image", "Choose source", [
    { text: "Tap to Capture", onPress: () => pickImage("camera") },
    { text: "Upload an Image", onPress: () => pickImage("library") },
    { text: "Cancel", style: "cancel" },
  ]);

  const handleSave = async () => {
    if (!imageUri) return;
    setSaving(true);
    try {
      const ext = imageMimeType.split("/")[1] || "jpg";
      const fileName = `formula_${formulaId}/${Date.now()}-photo.${ext}`;
      const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: "base64" });
      const arrayBuffer = decode(base64);
      const { error: uploadError } = await supabase.storage.from(MOOD_BUCKET).upload(fileName, arrayBuffer, { contentType: imageMimeType });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("formula_moodboard_assets").insert({
        formula_id: formulaId, file_url: fileName, media_type: "image", caption: null,
      });
      if (insertError) throw insertError;
      onAdded();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to add image");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={mb.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill as any} activeOpacity={1} onPress={onClose} />
        <View style={mb.sheet}>
          <TouchableOpacity style={mb.captureBox} onPress={handleImageTap} activeOpacity={0.9}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={{ width: "100%", height: "100%", borderRadius: 14 }} resizeMode="cover" />
            ) : (
              <View style={{ alignItems: "center", paddingHorizontal: 20 }}>
                <Text style={mb.captureText}>Tap to Capture</Text>
                <Text style={mb.captureHint}>(Best if shot on clean background)</Text>
                <Text style={mb.captureOr}>or</Text>
                <Text style={mb.captureText}>Upload an Image</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={mb.actions}>
            <TouchableOpacity style={mb.cancelBtn} onPress={onClose}>
              <Text style={mb.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[mb.addBtn, (!imageUri || saving) && { opacity: 0.4 }]}
              onPress={handleSave}
              disabled={!imageUri || saving}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={mb.addBtnText}>Add</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Formula Detail ───────────────────────────────────────────────────────────

export default function FormulaDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  const formulaId = parseInt(id ?? "0");
  const { user } = useAuth();

  const [formula, setFormula] = useState<Formula | null>(null);
  const [lines, setLines] = useState<FormulaLine[]>([]);
  const [moodItems, setMoodItems] = useState<MoodItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Formula params
  const [bottleSizeMl, setBottleSizeMl] = useState(15);
  const [concPercent, setConcPercent] = useState(20);
  const [diluent, setDiluent] = useState("Ethanol (EtOH)");
  const [diluentPickerVisible, setDiluentPickerVisible] = useState(false);
  const [concFocused, setConcFocused] = useState(false);

  // Inline add material
  const [inlineSearch, setInlineSearch] = useState("");
  const [inlineResults, setInlineResults] = useState<Material[]>([]);
  const [inlineSelected, setInlineSelected] = useState<Material | null>(null);
  const [inlineAmount, setInlineAmount] = useState("0.000");
  const [inlineAdding, setInlineAdding] = useState(false);

  // Accordion section open state (Main Notes always open; others collapsed)
  const [moodOpen, setMoodOpen] = useState(false);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Inline name/description editing
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [nameVal, setNameVal] = useState("");
  const [descVal, setDescVal] = useState("");

  // Modal visibility
  const [addMoodVisible, setAddMoodVisible] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [moreVisible, setMoreVisible] = useState(false);
  const [moreView, setMoreView] = useState<"main" | "share" | "delete">("main");
  const [saving, setSaving] = useState(false);

  // Status + save flow
  const [statusVal, setStatusVal] = useState<string | null>(null);
  const [saveMenuVisible, setSaveMenuVisible] = useState(false);
  const [versionDialogVisible, setVersionDialogVisible] = useState(false);
  const [versionName, setVersionName] = useState("");

  // Versions drawer
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<FormulaVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  const totalG = useMemo(() => lines.reduce((sum, l) => sum + safeNum(l.amount_g), 0), [lines]);
  const targetConcentrateG = useMemo(() => +(bottleSizeMl * (concPercent / 100)).toFixed(3), [bottleSizeMl, concPercent]);
  const diluentNeededMl = useMemo(() => Math.max(0, +(bottleSizeMl - targetConcentrateG).toFixed(1)), [bottleSizeMl, targetConcentrateG]);

  useEffect(() => {
    if (formula) {
      const p = parseParams(formula.notes);
      setBottleSizeMl(p.bottleSizeMl);
      setConcPercent(p.concPercent);
      setDiluent(p.diluent);
      setStatusVal(formula.status ?? null);
    }
  }, [formula?.id]);

  // Inline search debounce
  useEffect(() => {
    if (!inlineSearch.trim() || inlineSelected) { setInlineResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from("materials").select("id,name,type,cas_number").eq("user_id", user?.id).ilike("name", `%${inlineSearch}%`).limit(15);
      setInlineResults((data as Material[]) ?? []);
    }, 250);
    return () => clearTimeout(timer);
  }, [inlineSearch, inlineSelected]);

  const saveParams = useCallback(async (bSize = bottleSizeMl, cPct = concPercent, dil = diluent) => {
    const notesStr = `Bottle: ${bSize}mL, Concentration: ${cPct}%, Diluent: ${dil}`;
    await supabase.from("formulas").update({ notes: notesStr }).eq("id", formulaId);
    setFormula((prev) => prev ? { ...prev, notes: notesStr } : prev);
  }, [formulaId, bottleSizeMl, concPercent, diluent]);

  const fetchMoodItems = useCallback(async () => {
    const { data } = await supabase
      .from("formula_moodboard_assets").select("*").eq("formula_id", formulaId).order("created_at", { ascending: false });
    const raw = (data ?? []) as MoodItem[];
    const resolved: MoodItem[] = [];
    for (const item of raw) {
      if (item.media_type === "note") { resolved.push({ ...item, display_url: null }); continue; }
      const path = extractStoragePath(item.file_url);
      if (!path) { resolved.push({ ...item, display_url: item.file_url || null }); continue; }
      resolved.push({ ...item, display_url: await resolveSignedUrl(path) });
    }
    setMoodItems(resolved);
  }, [formulaId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: fData }, { data: lData }] = await Promise.all([
      supabase.from("formulas").select("*").eq("id", formulaId).single(),
      supabase.from("formula_lines").select("id,material_id,amount_g").eq("formula_id", formulaId).order("id", { ascending: true }),
    ]);
    setFormula(fData as Formula);
    const rawLines = (lData as any[]) ?? [];
    const matIds = [...new Set(rawLines.map((l) => l.material_id))];
    let matMap: Record<number, Material> = {};
    if (matIds.length) {
      const { data: mats } = await supabase.from("materials").select("id,name,type,cas_number").in("id", matIds);
      (mats ?? []).forEach((m: any) => { matMap[m.id] = m; });
    }
    setLines(rawLines.map((l) => ({ ...l, material: matMap[l.material_id] })));
    setLoading(false);
    fetchMoodItems();
  }, [formulaId, fetchMoodItems]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleFavorite = async () => {
    if (!formula) return;
    const next = !formula.is_favorite;
    setFormula((prev) => prev ? { ...prev, is_favorite: next } : prev);
    await supabase.from("formulas").update({ is_favorite: next }).eq("id", formulaId);
  };

  const openVersions = async () => {
    setVersionsOpen(true);
    if (versions.length === 0) {
      setVersionsLoading(true);
      const { data } = await supabase
        .from("formula_versions")
        .select("*")
        .eq("formula_id", formulaId)
        .order("created_at", { ascending: false });
      setVersions((data as FormulaVersion[]) ?? []);
      setVersionsLoading(false);
    }
  };

  const handleInlineAdd = async () => {
    const matName = inlineSelected?.name ?? inlineSearch.trim();
    if (!matName) return;
    setInlineAdding(true);
    try {
      let materialId = inlineSelected?.id ?? null;
      if (!materialId) {
        // New material — auto-add to Organ
        const { data: mat, error: matErr } = await supabase
          .from("materials")
          .insert([{ name: matName, user_id: user?.id }])
          .select("id")
          .single();
        if (matErr || !mat) throw matErr ?? new Error("Failed to create material");
        materialId = mat.id;
      }
      await supabase.from("formula_lines").insert([{
        formula_id: formulaId, material_id: materialId, amount_g: parseFloat(inlineAmount) || 0,
      }]);
      setInlineSearch(""); setInlineSelected(null); setInlineAmount("0.000"); setInlineResults([]);
      fetchData();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to add material");
    } finally {
      setInlineAdding(false);
    }
  };

  const handleDeleteLine = (lineId: number) => {
    setConfirm({
      title: "Remove Material",
      message: "Remove this material from the formula?",
      confirmLabel: "Remove",
      onConfirm: async () => { await supabase.from("formula_lines").delete().eq("id", lineId); fetchData(); },
    });
  };

  const handleUpdateAmount = async (lineId: number, amount_g: number) => {
    await supabase.from("formula_lines").update({ amount_g }).eq("id", lineId);
    setLines((prev) => prev.map((l) => l.id === lineId ? { ...l, amount_g } : l));
  };

  const commitName = async () => {
    if (!nameVal.trim() || !formula) { setEditingName(false); return; }
    await supabase.from("formulas").update({ name: nameVal.trim() }).eq("id", formula.id);
    setFormula((f) => f ? { ...f, name: nameVal.trim() } : f);
    setEditingName(false);
  };

  const commitDesc = async () => {
    if (!formula) { setEditingDesc(false); return; }
    await supabase.from("formulas").update({ description: descVal.trim() || null }).eq("id", formula.id);
    setFormula((f) => f ? { ...f, description: descVal.trim() || null } : f);
    setEditingDesc(false);
  };

  // Called from the in-sheet "Are you sure?" confirmation
  const handleDeleteFormula = async () => {
    closeMore();
    await supabase.from("formulas").delete().eq("id", formulaId);
    router.back();
  };

  const handleDeleteMoodItem = (itemId: string) => {
    setConfirm({
      title: "Remove Image",
      message: "Remove this mood board image?",
      confirmLabel: "Remove",
      onConfirm: async () => {
        const item = moodItems.find((i) => i.id === itemId);
        if (item && item.media_type !== "note") {
          const path = extractStoragePath(item.file_url);
          if (path) await supabase.storage.from(MOOD_BUCKET).remove([path]);
        }
        await supabase.from("formula_moodboard_assets").delete().eq("id", itemId);
        setMoodItems((prev) => prev.filter((i) => i.id !== itemId));
      },
    });
  };

  const normalizeToTarget = async () => {
    if (!lines.length || totalG <= 0 || Math.abs(totalG - targetConcentrateG) < 0.001) return;
    const scale = targetConcentrateG / totalG;
    const normalized = lines.map((l) => ({ ...l, amount_g: +(l.amount_g * scale).toFixed(3) }));
    await Promise.all(normalized.map((l) => supabase.from("formula_lines").update({ amount_g: l.amount_g }).eq("id", l.id)));
    setLines(normalized);
  };

  const handleSave = async () => {
    if (!formula) return;
    setSaveMenuVisible(false);
    setSaving(true);
    const name = editingName ? (nameVal.trim() || formula.name) : formula.name;
    const description = editingDesc ? (descVal.trim() || null) : formula.description;
    const { error } = await supabase.from("formulas").update({ name, description, status: statusVal }).eq("id", formulaId);
    setSaving(false);
    if (error) { Alert.alert("Save failed", error.message); return; }
    router.replace("/(tabs)/formulas" as any);
  };

  const handleSaveVersion = async (label: string) => {
    const { data: versions } = await supabase
      .from("formula_versions").select("version_num").eq("formula_id", formulaId)
      .order("version_num", { ascending: false }).limit(1);
    const lastNum = (versions as any)?.[0]?.version_num ?? 0;
    const nextNum = lastNum + 1;
    const snapshot = {
      bottle_ml: bottleSizeMl,
      concentration_pct: concPercent,
      diluent,
      lines: lines.map((l) => ({ material_id: l.material_id, amount_g: l.amount_g, name: l.material?.name ?? null })),
    };
    const { error } = await supabase.from("formula_versions").insert([{
      formula_id: formulaId,
      version_num: nextNum,
      label: label.trim() || `Version ${nextNum}`,
      notes: JSON.stringify(snapshot),
      created_by: user?.id,
    }]);
    if (error) { Alert.alert("Error", error.message); return; }
    setVersionDialogVisible(false);
    Alert.alert("Version Saved", `"${label.trim() || `Version ${nextNum}`}" saved.`);
  };

  const handleDuplicate = async () => {
    setMoreVisible(false);
    const { data: newF, error } = await supabase.from("formulas")
      .insert([{ name: `${formula!.name} (Copy)`, description: formula!.description, notes: formula!.notes, date_created: new Date().toISOString() }])
      .select("id").single();
    if (error || !newF) { Alert.alert("Error", "Could not duplicate formula."); return; }
    if (lines.length) {
      await supabase.from("formula_lines").insert(
        lines.map((l) => ({ formula_id: (newF as any).id, material_id: l.material_id, amount_g: l.amount_g }))
      );
    }
    Alert.alert("Duplicated", `"${formula!.name} (Copy)" created.`, [
      { text: "Open Copy", onPress: () => router.replace(`/formula/${(newF as any).id}` as any) },
      { text: "Stay Here", style: "cancel" },
    ]);
  };

  const buildShareText = () => {
    if (!formula) return "";
    const ingList = lines.slice().sort((a, b) => b.amount_g - a.amount_g)
      .map((l) => `  • ${l.material?.name ?? "Unknown"}: ${l.amount_g.toFixed(3)}g (${totalG > 0 ? ((l.amount_g / totalG) * 100).toFixed(1) : 0}%)`)
      .join("\n");
    return [
      `🧪 ${formula.name}`,
      formula.description ? `\n${formula.description}` : "",
      `\nIngredients — ${totalG.toFixed(3)}g total:`,
      ingList || "  (none)",
      `\nBottle: ${bottleSizeMl}mL · Conc: ${concPercent}% · Diluent: ${diluent}`,
    ].filter(Boolean).join("\n");
  };

  const closeMore = () => { setMoreVisible(false); setMoreView("main"); };

  const handleOSShare = async () => {
    if (!formula) return;
    closeMore();
    await Share.share({ title: formula.name, message: buildShareText() });
  };

  const handleEmailShare = () => {
    closeMore();
    Linking.openURL(`mailto:?subject=${encodeURIComponent(formula?.name ?? "Formula")}&body=${encodeURIComponent(buildShareText())}`);
  };

  const handleSMSShare = () => {
    closeMore();
    Linking.openURL(`sms:?body=${encodeURIComponent(buildShareText())}`);
  };

  if (loading) return (
    <DarkScreen>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={ACCENT} /></View>
    </DarkScreen>
  );
  if (!formula) return (
    <DarkScreen>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "rgba(255,255,255,0.5)" }}>Formula not found</Text></View>
    </DarkScreen>
  );

  const atTarget = Math.abs(totalG - targetConcentrateG) < 0.001;
  const moodImages = moodItems.filter((i) => i.media_type === "image" && i.display_url);
  const sortedLines = [...lines].sort((a, b) => symbolRank(a.material?.type) - symbolRank(b.material?.type));
  const catG = (t: string) => lines.filter((l) => l.material?.type === t).reduce((sum, l) => sum + safeNum(l.amount_g), 0);
  const topG = catG("Top"), midG = catG("Mid"), baseG = catG("Base");
  const pctOf = (g: number) => (totalG > 0 ? Math.round((g / totalG) * 100) : 0);

  return (
    <DarkScreen>
      {/* Nav */}
      <View style={s.topNav}>
        <SpilsLogo height={22} color="#edff8d" />
        <TouchableOpacity style={[s.profileBtn, { backgroundColor: "transparent", borderWidth: 0 }]} onPress={() => router.push("/(tabs)/profile" as any)}>
          <ProfileIcon size={34} />
        </TouchableOpacity>
      </View>

      {/* Back carrot + section header */}
      <View style={s.headerRow}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.backCarrot}>‹</Text>
        </TouchableOpacity>
        <Text style={s.pageTitle}>Lab</Text>
      </View>

      <KeyboardAwareScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled" enableOnAndroid extraScrollHeight={40} keyboardOpeningTime={0} enableResetScrollToCoords={false}>

        {/* ── Main Notes card (auto-open) ── */}
        <View style={s.notesCard}>
          <View style={s.notesCardTop}>
            {editingName ? (
              <TextInput
                style={[s.cardName, { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.3)", paddingBottom: 2, flex: 1, marginRight: 8 }]}
                value={nameVal}
                onChangeText={setNameVal}
                onBlur={commitName}
                onSubmitEditing={commitName}
                autoFocus
                returnKeyType="done"
              />
            ) : (
              <TouchableOpacity style={{ flex: 1, marginRight: 8 }} onPress={() => { setNameVal(formula.name); setEditingName(true); }} activeOpacity={0.7}>
                <Text style={s.cardName} numberOfLines={1}>{formula.name}</Text>
              </TouchableOpacity>
            )}
            <Text style={s.cardDate}>
              {new Date(formula.date_created).toLocaleDateString("en-US", { year: "2-digit", month: "2-digit", day: "2-digit" }).replace(/\//g, ".")}
            </Text>
          </View>

          {editingDesc ? (
            <TextInput
              style={[s.cardNotes, { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.3)", paddingBottom: 4, marginTop: 8 }]}
              value={descVal}
              onChangeText={setDescVal}
              onBlur={commitDesc}
              multiline
              autoFocus
              placeholder="Add notes..."
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
          ) : (
            <TouchableOpacity onPress={() => { setDescVal(formula.description ?? ""); setEditingDesc(true); }} activeOpacity={0.7} style={{ marginTop: 8 }}>
              <Text style={s.cardNotes}>
                {formula.description || <Text style={{ color: "rgba(255,255,255,0.35)" }}>Tap to add notes...</Text>}
              </Text>
            </TouchableOpacity>
          )}

          <View style={s.cardBottom}>
            <View style={s.cardBottomLeft}>
              <View style={s.statusPill}>
                <Text style={s.statusPillText}>{formulaStatus(lines.length, statusVal).toUpperCase()}</Text>
              </View>
              <Text style={s.cardMeta}>{lines.length} MATERIALS</Text>
              <Text style={s.cardSep}>  |  </Text>
              <TouchableOpacity onPress={openVersions}>
                <Text style={s.cardVersions}>VERSIONS</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={toggleFavorite} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[s.cardHeart, formula.is_favorite && s.cardHeartActive]}>{formula.is_favorite ? "♥" : "♡"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Mood Board ── */}
        <View style={s.section}>
          <TouchableOpacity style={s.sectionHead} activeOpacity={0.8} onPress={() => setMoodOpen((v) => !v)}>
            <Text style={s.sectionHeadTitle}>Mood Board</Text>
            {moodOpen ? (
              moodImages.length < 3 ? (
                <TouchableOpacity style={s.addPill} onPress={() => setAddMoodVisible(true)}>
                  <Text style={s.addPillText}>Add</Text>
                </TouchableOpacity>
              ) : null
            ) : (
              <Text style={s.sectionShow}>Show</Text>
            )}
          </TouchableOpacity>
          {moodOpen && (
            <View style={s.sectionBody}>
              {moodImages.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 20 }}>
                  <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, textAlign: "center" }}>
                    No images yet.{"\n"}Tap Add to capture or upload (up to 3).
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {moodImages.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={s.moodImgCard}
                      activeOpacity={0.9}
                      onPress={() => setLightboxUrl(item.display_url!)}
                    >
                      <Image source={{ uri: item.display_url! }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      <TouchableOpacity
                        style={s.imageDeleteBtn}
                        onPress={() => handleDeleteMoodItem(item.id)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <BlurView intensity={40} tint="dark" style={s.imageDeleteBlur}>
                          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>×</Text>
                        </BlurView>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <TouchableOpacity style={{ alignSelf: "flex-end", marginTop: 14 }} onPress={() => setMoodOpen(false)}>
                <Text style={s.sectionShow}>Hide</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Parameters ── */}
        <View style={s.section}>
          <TouchableOpacity style={s.sectionHead} activeOpacity={0.8} onPress={() => setParamsOpen((v) => !v)}>
            <Text style={s.sectionHeadTitle}>Parameters</Text>
            {!paramsOpen && <Text style={s.sectionShow}>Show</Text>}
          </TouchableOpacity>
          {paramsOpen && (
          <View style={s.sectionBody}>
            <View style={s.paramRow}>
              <View style={s.paramColSm}>
                <Text style={s.paramLabel}>Bottle Size (ml)</Text>
                <TextInput
                  style={s.paramInput}
                  value={bottleSizeMl.toString()}
                  onChangeText={(v) => setBottleSizeMl(parseFloat(v) || 0)}
                  onBlur={() => saveParams()}
                  keyboardType="decimal-pad"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
              </View>
              <View style={s.paramColSm}>
                <Text style={s.paramLabel}>Concentration (%)</Text>
                <TextInput
                  style={s.paramInput}
                  value={concFocused ? concPercent.toString() : `${concPercent}%`}
                  onChangeText={(v) => setConcPercent(parseFloat(v) || 0)}
                  onFocus={() => setConcFocused(true)}
                  onBlur={() => { setConcFocused(false); saveParams(); }}
                  keyboardType="decimal-pad"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
              </View>
              <View style={s.paramColLg}>
                <Text style={s.paramLabel}>Diluent</Text>
                <TouchableOpacity style={s.diluentRow} onPress={() => setDiluentPickerVisible(true)}>
                  <Text style={s.diluentText} numberOfLines={1}>{diluent}</Text>
                  <Text style={s.diluentChevron}>⌄</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={s.paramDivider} />

            <Text style={s.paramCalc}>
              Target Concentrate: {targetConcentrateG.toFixed(3)}g  |  Diluent: {diluentNeededMl}ml
            </Text>

            <TouchableOpacity style={{ alignSelf: "flex-end", marginTop: 12 }} onPress={() => setParamsOpen(false)}>
              <Text style={s.sectionShow}>Hide</Text>
            </TouchableOpacity>
          </View>
          )}
        </View>

        {/* ── Formula ── */}
        <View style={s.section}>
          <TouchableOpacity style={s.sectionHead} activeOpacity={0.8} onPress={() => setFormulaOpen((v) => !v)}>
            <Text style={s.sectionHeadTitle}>Formula</Text>
            {!formulaOpen && <Text style={s.sectionShow}>Show</Text>}
          </TouchableOpacity>
          {formulaOpen && (
          <View style={s.sectionBody}>
            {/* Search + Add (pill inside the bar) */}
            <View style={{ marginBottom: 16 }}>
              <View style={s.searchPillWrap}>
                <TextInput
                  style={s.searchPillInput}
                  placeholder="Search Materials..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={inlineSearch}
                  onChangeText={(v) => { setInlineSearch(v); setInlineSelected(null); }}
                />
                <TouchableOpacity
                  style={[s.searchAddBtn, ((!inlineSelected && !inlineSearch.trim()) || inlineAdding) && { opacity: 0.45 }]}
                  onPress={handleInlineAdd}
                  disabled={(!inlineSelected && !inlineSearch.trim()) || inlineAdding}
                >
                  {inlineAdding
                    ? <ActivityIndicator color="#13131a" size="small" />
                    : <Text style={s.searchAddText}>Add</Text>}
                </TouchableOpacity>
              </View>
              {/* Search dropdown */}
              {inlineSearch.trim() && !inlineSelected ? (
                <View style={s.inlineDropdown}>
                  {inlineResults.slice(0, 8).map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={s.inlineDropdownRow}
                      onPress={() => { setInlineSelected(item); setInlineSearch(item.name); setInlineResults([]); }}
                    >
                      <Text style={{ color: "#fff", fontSize: 14 }}>{item.name}</Text>
                      {item.type ? <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{SYMBOL_ICONS[item.type] ?? ""} {item.type}</Text> : null}
                    </TouchableOpacity>
                  ))}
                  {!inlineResults.some((r) => r.name.toLowerCase() === inlineSearch.toLowerCase()) && (
                    <TouchableOpacity
                      style={[s.inlineDropdownRow, inlineResults.length > 0 && { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }]}
                      onPress={() => { setInlineResults([]); }}
                    >
                      <Text style={{ color: ACCENT, fontSize: 14, fontWeight: "600" }}>+ Add "{inlineSearch}" to your Organ</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}
              {inlineSelected ? (
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, paddingHorizontal: 2 }}>
                  <Text style={{ color: ACCENT, fontSize: 13 }}>✓ {inlineSelected.name}</Text>
                  <TouchableOpacity onPress={() => { setInlineSelected(null); setInlineSearch(""); }} style={{ marginLeft: 10 }}>
                    <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Clear</Text>
                  </TouchableOpacity>
                </View>
              ) : !inlineSelected && inlineSearch.trim() && inlineResults.length === 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, paddingHorizontal: 2 }}>
                  <Text style={{ color: ACCENT, fontSize: 13 }}>★ "{inlineSearch}" will be added to your Organ</Text>
                </View>
              ) : null}
            </View>

            {/* Materials Table */}
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderText, { width: 56 }]}>Symbol</Text>
              <Text style={[s.tableHeaderText, { flex: 1 }]}>Material</Text>
              <Text style={[s.tableHeaderText, { textAlign: "right" }]}>Amount (g)</Text>
              <View style={{ width: 26 }} />
            </View>
            {lines.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>No materials yet. Search above to add.</Text>
              </View>
            ) : (
              sortedLines.map((line) => (
                <LineRow
                  key={line.id} line={line} totalG={totalG}
                  onDelete={() => handleDeleteLine(line.id)}
                  onUpdateAmount={(g) => handleUpdateAmount(line.id, g)}
                />
              ))
            )}
            {/* Total row */}
            <View style={s.tableTotalRow}>
              <Text style={[s.tableTotalLabel, { flex: 1 }]}>Total Materials Concentrate</Text>
              <Text style={s.tableTotalVal}>{totalG.toFixed(2)}g</Text>
              <Text style={s.tableTotalPct}>  |  {lines.length > 0 ? "100%" : "0%"}</Text>
            </View>

            <TouchableOpacity style={{ alignSelf: "flex-end", marginTop: 12 }} onPress={() => setFormulaOpen(false)}>
              <Text style={s.sectionShow}>Hide</Text>
            </TouchableOpacity>
          </View>
          )}
        </View>

        {/* ── Summary ── */}
        <View style={s.section}>
          <TouchableOpacity style={s.sectionHead} activeOpacity={0.8} onPress={() => setSummaryOpen((v) => !v)}>
            <Text style={s.sectionHeadTitle}>Summary</Text>
            {!summaryOpen && <Text style={s.sectionShow}>Show</Text>}
          </TouchableOpacity>
          {summaryOpen && (
          <View style={s.sectionBody}>
            <View style={{ flexDirection: "row" }}>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={s.statVal}>{totalG.toFixed(3)}g</Text>
                <Text style={s.statLabel}>CONCENTRATE TOTAL</Text>
              </View>
              <View style={s.statDivider} />
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={s.statVal}>{targetConcentrateG.toFixed(3)}g</Text>
                <Text style={s.statLabel}>TARGET CONCENTRATE</Text>
              </View>
              <View style={s.statDivider} />
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={s.statVal}>{diluentNeededMl}ml</Text>
                <Text style={s.statLabel}>DILUENT</Text>
              </View>
            </View>

            {/* Breakdown by symbol */}
            {lines.length > 0 && (
              <View style={s.breakdownRow}>
                {topG > 0 && <View style={[s.bdPill, { backgroundColor: "#9BE24F" }]}><Text style={s.bdPillDark}>▲ {pctOf(topG)}%</Text></View>}
                {midG > 0 && <View style={[s.bdPill, { backgroundColor: "#F06CA6" }]}><Text style={s.bdPillDark}>● {pctOf(midG)}%</Text></View>}
                {baseG > 0 && <View style={[s.bdPill, { backgroundColor: "#4C7DF0" }]}><Text style={s.bdPillLight}>■ {pctOf(baseG)}%</Text></View>}
              </View>
            )}

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
              <TouchableOpacity
                style={[s.normalizeBtn, (atTarget || totalG === 0) && { opacity: 0.4 }]}
                onPress={normalizeToTarget}
                disabled={atTarget || totalG === 0}
              >
                <Text style={s.normalizeBtnText}>Normalize to Target</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSummaryOpen(false)}>
                <Text style={s.sectionShow}>Hide</Text>
              </TouchableOpacity>
            </View>
          </View>
          )}
        </View>

        {/* ── Set Status ── */}
        <View style={{ paddingHorizontal: 30, marginTop: 4, marginBottom: 8 }}>
          <Text style={s.setStatusLabel}>Set Status</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {["Draft", "In Progress", "Final"].map((st) => {
              const active = statusVal === st;
              return (
                <TouchableOpacity
                  key={st}
                  style={[s.statusChip, active && s.statusChipActive]}
                  onPress={() => setStatusVal(active ? null : st)}
                >
                  <Text style={[s.statusChipText, active && s.statusChipTextActive]}>{st.toUpperCase()}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

      </KeyboardAwareScrollView>

      {/* Diluent Picker */}
      <Modal visible={diluentPickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDiluentPickerVisible(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <View style={{ width: 60 }} />
            <Text style={s.modalTitle}>Select Diluent</Text>
            <TouchableOpacity onPress={() => setDiluentPickerVisible(false)}><Text style={s.back}>Done</Text></TouchableOpacity>
          </View>
          <ScrollView>
            {DILUENTS.map((d) => (
              <TouchableOpacity
                key={d}
                style={{ paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                onPress={() => { setDiluent(d); setDiluentPickerVisible(false); saveParams(bottleSizeMl, concPercent, d); }}
              >
                <Text style={{ color: "#fff", fontSize: 16 }}>{d}</Text>
                {diluent === d ? <Text style={{ color: "#a78bfa", fontSize: 18 }}>✓</Text> : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <AddMoodItemModal
        visible={addMoodVisible} formulaId={formulaId}
        onClose={() => setAddMoodVisible(false)}
        onAdded={() => { setAddMoodVisible(false); fetchMoodItems(); }}
      />

      {/* Image lightbox */}
      <Modal visible={!!lightboxUrl} transparent animationType="fade" onRequestClose={() => setLightboxUrl(null)}>
        <View style={s.lightboxBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill as any} activeOpacity={1} onPress={() => setLightboxUrl(null)} />
          <TouchableOpacity style={s.lightboxClose} onPress={() => setLightboxUrl(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.lightboxCloseText}>✕</Text>
          </TouchableOpacity>
          {lightboxUrl ? <Image source={{ uri: lightboxUrl }} style={s.lightboxImg} resizeMode="contain" /> : null}
        </View>
      </Modal>

      {/* Persistent bottom bar */}
      <View style={s.bottomBar}>
        <TouchableOpacity style={s.moreBtn} onPress={() => setMoreVisible(true)}>
          <Text style={s.moreBtnText}>More</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.5 }]} onPress={() => setSaveMenuVisible(true)} disabled={saving}>
          {saving ? <ActivityIndicator color="#13131a" size="small" /> : <Text style={s.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      {/* More sheet */}
      <Modal visible={moreVisible} transparent animationType="slide" onRequestClose={closeMore}>
        <View style={s.moreBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={closeMore} />
          <View style={s.moreSheet}>
            <View style={s.moreHandle} />

            {moreView === "main" && (
              <>
                <TouchableOpacity style={[s.sheetBtn, s.sheetBtnBlue]} onPress={() => setMoreView("share")}>
                  <Text style={[s.sheetBtnText, s.sheetBtnTextLight]}>Share Formula</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.sheetBtn, s.sheetBtnBeige]} onPress={() => { closeMore(); Alert.alert("Print", "Print feature coming soon."); }}>
                  <Text style={[s.sheetBtnText, { color: "rgba(19,19,26,0.55)" }]}>Print</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.sheetBtn, s.sheetBtnMagenta]} onPress={() => setMoreView("delete")}>
                  <Text style={[s.sheetBtnText, s.sheetBtnTextLight]}>Delete Formula</Text>
                </TouchableOpacity>
              </>
            )}

            {moreView === "share" && (
              <>
                <View style={[s.sheetBtn, s.sheetBtnBlue]}>
                  <Text style={[s.sheetBtnText, s.sheetBtnTextLight]}>Share</Text>
                </View>
                <TouchableOpacity style={s.sheetBtn} onPress={handleOSShare}>
                  <Text style={s.sheetBtnText}>OS Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.sheetBtn} onPress={handleEmailShare}>
                  <Text style={s.sheetBtnText}>Email</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.sheetBtn} onPress={handleSMSShare}>
                  <Text style={s.sheetBtnText}>Text (SMS)</Text>
                </TouchableOpacity>
              </>
            )}

            {moreView === "delete" && (
              <>
                <View style={[s.sheetBtn, s.sheetBtnMagenta]}>
                  <Text style={[s.sheetBtnText, s.sheetBtnTextLight]}>Delete Formula</Text>
                </View>
                <Text style={s.sheetConfirmText}>Are you sure?</Text>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <TouchableOpacity style={[s.sheetBtn, { flex: 1 }]} onPress={handleDeleteFormula}>
                    <Text style={s.sheetBtnText}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.sheetBtn, { flex: 1 }]} onPress={() => setMoreView("main")}>
                    <Text style={s.sheetBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Save menu pop-up */}
      <Modal visible={saveMenuVisible} transparent animationType="fade" onRequestClose={() => setSaveMenuVisible(false)}>
        <View style={s.saveMenuBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill as any} activeOpacity={1} onPress={() => setSaveMenuVisible(false)} />
          <View style={s.saveMenuCard}>
            <TouchableOpacity style={s.saveMenuPrimary} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#13131a" size="small" /> : <Text style={s.saveMenuPrimaryText}>Save</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.saveMenuSecondary} onPress={() => { setSaveMenuVisible(false); setVersionName("Mod 2.0"); setVersionDialogVisible(true); }}>
              <Text style={s.saveMenuSecondaryText}>Save a Version</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Save a Version dialog */}
      <Modal visible={versionDialogVisible} transparent animationType="fade" onRequestClose={() => setVersionDialogVisible(false)}>
        <View style={s.saveMenuBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill as any} activeOpacity={1} onPress={() => setVersionDialogVisible(false)} />
          <View style={s.versionDialog}>
            <Text style={s.versionDialogTitle}>Save a Version</Text>
            <TextInput
              style={s.versionInput}
              value={versionName}
              onChangeText={setVersionName}
              placeholder="Version name"
              placeholderTextColor="rgba(255,255,255,0.35)"
              autoFocus
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={s.vdCancel} onPress={() => setVersionDialogVisible(false)}>
                <Text style={s.vdCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.vdSave} onPress={() => handleSaveVersion(versionName)}>
                <Text style={s.vdSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Versions drawer */}
      <Modal visible={versionsOpen} transparent animationType="fade" onRequestClose={() => setVersionsOpen(false)}>
        <View style={s.drawerBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill as any} activeOpacity={1} onPress={() => setVersionsOpen(false)} />
          <View style={s.drawerCard}>
            {/* Card header replica */}
            <View style={s.notesCardTop}>
              <Text style={s.cardName} numberOfLines={1}>{formula.name}</Text>
              <Text style={s.cardDate}>
                {new Date(formula.date_created).toLocaleDateString("en-US", { year: "2-digit", month: "2-digit", day: "2-digit" }).replace(/\//g, ".")}
              </Text>
            </View>
            {formula.description ? <Text style={[s.cardNotes, { marginTop: 8 }]} numberOfLines={2}>{formula.description}</Text> : null}
            <View style={s.cardBottom}>
              <View style={s.cardBottomLeft}>
                <View style={s.statusPill}>
                  <Text style={s.statusPillText}>{formulaStatus(lines.length, statusVal).toUpperCase()}</Text>
                </View>
                <Text style={s.cardMeta}>{lines.length} MATERIALS</Text>
                <Text style={s.cardSep}>  |  </Text>
                <Text style={s.cardVersions}>VERSIONS</Text>
              </View>
              <Text style={[s.cardHeart, formula.is_favorite && s.cardHeartActive]}>{formula.is_favorite ? "♥" : "♡"}</Text>
            </View>

            <View style={s.drawerDivider} />

            <Text style={s.drawerTitle}>Versions</Text>
            {versionsLoading ? (
              <ActivityIndicator size="small" color={ACCENT} style={{ marginTop: 12, marginBottom: 4 }} />
            ) : versions.length === 0 ? (
              <Text style={s.drawerEmpty}>No saved versions yet.</Text>
            ) : (
              versions.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={s.versionPill}
                  activeOpacity={0.75}
                  onPress={() => { setVersionsOpen(false); router.push(`/formula/version/${v.id}` as any); }}
                >
                  <Text style={s.versionName} numberOfLines={1}>
                    {v.label ?? `${formula.name} [version ${v.version_num}]`}
                  </Text>
                  <Text style={s.versionDate}>{formatDate(v.created_at)}</Text>
                </TouchableOpacity>
              ))
            )}

            <TouchableOpacity style={s.drawerHide} onPress={() => setVersionsOpen(false)}>
              <Text style={s.drawerHideText}>Hide</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConfirmModal config={confirm} onClose={() => setConfirm(null)} />
    </DarkScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

// Mood board modal styles
const mb = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: "#0c0c0c",
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.6)",
    padding: 18,
    width: "100%",
  },
  captureBox: {
    width: "100%",
    aspectRatio: 0.8,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  captureText: { color: "#13131a", fontSize: 15, fontWeight: "600", textAlign: "center" },
  captureHint: { color: "rgba(19,19,26,0.45)", fontSize: 12, textAlign: "center", marginTop: 4 },
  captureOr: { color: "rgba(19,19,26,0.45)", fontSize: 13, marginVertical: 10 },
  actions: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  cancelBtn: { flex: 1, marginRight: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", borderRadius: 24, paddingVertical: 13, alignItems: "center" },
  cancelBtnText: { color: "#fff", fontSize: 15, fontWeight: "500" },
  addBtn: { flex: 1, marginLeft: 8, backgroundColor: "#EC008C", borderRadius: 24, paddingVertical: 13, alignItems: "center" },
  addBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

const s = StyleSheet.create({
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30, paddingTop: 6, paddingBottom: 2 },
  back: { color: "#fff", fontSize: 16, fontWeight: "600" },
  profileBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  profileIcon: { fontSize: 16 },
  deleteBtn: { color: "#f87171", fontSize: 16 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 30, paddingTop: 24, paddingBottom: 16 },
  backCarrot: { color: "#fff", fontSize: 30, fontWeight: "300", lineHeight: 30, marginTop: -4 },
  pageTitle: { fontSize: 23, fontWeight: "700", color: "#fff", letterSpacing: -0.3 },

  // ── Main Notes card ──
  notesCard: { marginHorizontal: 30, marginBottom: 16, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.6)", borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16 },
  notesCardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  cardName: { fontSize: 16, fontWeight: "700", color: "#fff" },
  cardDate: { fontSize: 12, color: "rgba(255,255,255,0.5)", marginLeft: 8 },
  cardNotes: { fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 19 },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },
  cardBottomLeft: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  statusPill: { borderWidth: 1, borderColor: "rgba(255,255,255,0.4)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginRight: 10 },
  statusPillText: { fontSize: 9, color: "rgba(255,255,255,0.8)", fontWeight: "700", letterSpacing: 0.6 },
  cardMeta: { fontSize: 10, color: "rgba(255,255,255,0.55)", fontWeight: "600", letterSpacing: 0.5 },
  cardSep: { fontSize: 11, color: "rgba(255,255,255,0.3)" },
  cardVersions: { fontSize: 10, color: "rgba(255,255,255,0.55)", fontWeight: "600", letterSpacing: 0.5, textDecorationLine: "underline" },
  cardHeart: { fontSize: 22, color: "rgba(255,255,255,0.4)" },
  cardHeartActive: { color: HEART },

  // ── Accordion section ──
  section: { marginHorizontal: 30, marginBottom: 12, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.6)", borderRadius: 14, overflow: "hidden" },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 18 },
  sectionHeadTitle: { color: "#fff", fontWeight: "600", fontSize: 16 },
  sectionShow: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "500" },
  sectionBody: { paddingHorizontal: 18, paddingBottom: 20, paddingTop: 2 },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sectionTitle: { color: "#fff", fontWeight: "600", fontSize: 16 },

  addBtn: { backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: "#13131a", fontWeight: "600", fontSize: 14 },

  // Mood Board
  noteCard: { width: "100%", backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderRadius: 12, padding: 16, paddingBottom: 20, position: "relative", minHeight: 90 },
  noteText: { color: "#fff", fontSize: 14, lineHeight: 22, paddingRight: 24 },
  noteDeleteBtn: { position: "absolute", top: 10, right: 12 },
  imageCard: { width: "47%", aspectRatio: 4 / 3, borderRadius: 12, overflow: "hidden", position: "relative" },
  imageCaptionBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 8, paddingVertical: 6 },
  imageCaptionText: { color: "#fff", fontSize: 11, lineHeight: 14 },
  imageDeleteBtn: { position: "absolute", top: 6, right: 6 },
  imageDeleteBlur: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  addPill: { borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6 },
  addPillText: { color: "#fff", fontSize: 13, fontWeight: "500" },
  moodImgCard: { width: "31.5%", aspectRatio: 0.82, borderRadius: 10, overflow: "hidden", position: "relative", backgroundColor: "rgba(255,255,255,0.06)" },

  // Lightbox
  lightboxBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  lightboxImg: { width: "92%", height: "80%" },
  lightboxClose: { position: "absolute", top: 60, right: 24, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  lightboxCloseText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  // Formula Parameters
  paramRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  paramColSm: { width: 74 },
  paramColLg: { flex: 1 },
  paramLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, marginBottom: 8 },
  paramInput: { backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9, color: "#fff", fontSize: 14, textAlign: "center" },
  diluentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  diluentText: { color: "#fff", fontSize: 13, flex: 1, marginRight: 6 },
  diluentChevron: { color: "rgba(255,255,255,0.6)", fontSize: 16, marginTop: -4 },
  paramDivider: { height: 0.5, backgroundColor: "rgba(255,255,255,0.25)", marginTop: 22, marginBottom: 14 },
  paramCalc: { color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 18 },

  // Inline search
  searchBarInline: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11, color: "#fff", fontSize: 14 },
  amountInline: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 11, color: "#fff", fontSize: 14, width: 72, textAlign: "center" },
  inlineDropdown: { backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 12, marginTop: 6, overflow: "hidden" },
  inlineDropdownRow: { paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  // Materials table
  searchPillWrap: { flexDirection: "row", alignItems: "center", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.6)", borderRadius: 24, paddingLeft: 16, paddingRight: 5, paddingVertical: 5, backgroundColor: "rgba(255,255,255,0.04)" },
  searchPillInput: { flex: 1, fontSize: 14, color: "#fff", paddingVertical: 7, marginRight: 8 },
  searchAddBtn: { backgroundColor: "#fff", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 7 },
  searchAddText: { color: "#13131a", fontSize: 12, fontWeight: "600" },
  tableHeader: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.15)" },
  tableHeaderText: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  lineRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  lineSymbol: { width: 56, color: "rgba(255,255,255,0.85)", fontSize: 13, paddingLeft: 2 },
  lineName: { color: "#fff", fontWeight: "500", fontSize: 14 },
  lineTypeCol: { width: 52, color: "rgba(255,255,255,0.5)", fontSize: 12 },
  lineAmount: { color: "#fff", fontSize: 14 },
  linePct: { color: ACCENT, fontSize: 12, marginTop: 2, textAlign: "right" },
  lineInput: { backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(236,0,140,0.6)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, color: "#fff", textAlign: "right", width: 80 },
  tableTotalRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)", marginTop: 2 },
  tableTotalLabel: { color: "#fff", fontWeight: "700", fontSize: 13 },
  tableTotalVal: { color: "#fff", fontWeight: "700", fontSize: 14 },
  tableTotalPct: { color: ACCENT, fontWeight: "700", fontSize: 14 },
  tableUnderBy: { color: "#F0A93B", fontSize: 11 },

  // Formula Summary
  statVal: { color: "#fff", fontWeight: "700", fontSize: 17, marginBottom: 4, textAlign: "center" },
  statLabel: { color: "rgba(255,255,255,0.45)", fontSize: 11, textAlign: "center" },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.15)", marginVertical: 4 },

  // ── Versions drawer ──
  drawerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", paddingHorizontal: 24 },
  drawerCard: { backgroundColor: "#0c0c0c", borderRadius: 16, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.6)", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, width: "100%" },
  drawerDivider: { height: 0.5, backgroundColor: "rgba(255,255,255,0.25)", marginTop: 18, marginBottom: 4 },
  drawerTitle: { fontSize: 17, fontWeight: "600", color: "#fff", marginTop: 14, marginBottom: 2 },
  drawerEmpty: { fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 12, marginBottom: 4 },
  versionPill: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 10, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.55)", paddingHorizontal: 16, paddingVertical: 14, marginTop: 10 },
  versionName: { fontSize: 14, fontWeight: "600", color: "#fff", flex: 1, marginRight: 8 },
  versionDate: { fontSize: 12, color: "rgba(255,255,255,0.5)" },
  drawerHide: { alignSelf: "flex-end", paddingVertical: 8, paddingHorizontal: 4, marginTop: 14 },
  drawerHideText: { fontSize: 14, color: "rgba(255,255,255,0.7)", fontWeight: "500" },

  // Add Mood Modal (unused on detail page, kept for Diluent modal)
  tabRow: { flexDirection: "row", marginHorizontal: 24, marginTop: 16, marginBottom: 16, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 9 },
  tabActive: { backgroundColor: "#a78bfa" },
  tabText: { color: "rgba(255,255,255,0.5)", fontWeight: "600", fontSize: 14 },
  tabTextActive: { color: "#fff" },
  imagePickerEmpty: { height: 180, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },

  // Shared modal (Diluent picker — keeps dark bg)
  modal: { flex: 1, backgroundColor: "#0e1828" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  modalClose: { color: "rgba(255,255,255,0.5)", fontSize: 16 },
  fieldLabel: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: "#fff", fontSize: 15, marginBottom: 14 },
  modalSaveBtn: { backgroundColor: "#a78bfa", borderRadius: 12, paddingVertical: 15, alignItems: "center" as const },
  modalSaveBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },

  // Bottom bar
  bottomBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 40, paddingVertical: 16 },
  moreBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 26, paddingHorizontal: 34, paddingVertical: 14 },
  moreBtnText: { color: "#fff", fontSize: 15, fontWeight: "500" },
  saveBtn: { backgroundColor: "#D9F24E", borderRadius: 26, paddingHorizontal: 40, paddingVertical: 14 },
  saveBtnText: { color: "#13131a", fontSize: 15, fontWeight: "700" },

  // Summary breakdown + Set Status + Save menu
  normalizeBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  normalizeBtnText: { color: "rgba(255,255,255,0.75)", fontWeight: "600", fontSize: 12 },
  breakdownRow: { flexDirection: "row", gap: 10, marginTop: 20, justifyContent: "center" },
  bdPill: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6 },
  bdPillDark: { color: "#13131a", fontSize: 13, fontWeight: "700" },
  bdPillLight: { color: "#fff", fontSize: 13, fontWeight: "700" },
  setStatusLabel: { color: "#fff", fontSize: 16, fontWeight: "600", marginBottom: 12 },
  statusChip: { borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 9 },
  statusChipActive: { backgroundColor: "#fff", borderColor: "#fff" },
  statusChipText: { color: "#fff", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  statusChipTextActive: { color: "#13131a" },
  saveMenuBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", paddingHorizontal: 40 },
  saveMenuCard: { backgroundColor: "#0c0c0c", borderRadius: 18, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", padding: 20, gap: 12 },
  saveMenuPrimary: { backgroundColor: "#D9F24E", borderRadius: 24, paddingVertical: 14, alignItems: "center" },
  saveMenuPrimaryText: { color: "#13131a", fontSize: 15, fontWeight: "700" },
  saveMenuSecondary: { borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 24, paddingVertical: 14, alignItems: "center" },
  saveMenuSecondaryText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  versionDialog: { backgroundColor: "#0c0c0c", borderRadius: 16, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.5)", padding: 20 },
  versionDialogTitle: { color: "#fff", fontSize: 15, fontWeight: "600", marginBottom: 14 },
  versionInput: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, color: "#fff", fontSize: 15 },
  vdCancel: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 9 },
  vdCancelText: { color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: "500" },
  vdSave: { backgroundColor: "#D9F24E", borderRadius: 20, paddingHorizontal: 22, paddingVertical: 9 },
  vdSaveText: { color: "#13131a", fontSize: 14, fontWeight: "700" },

  // More sheet
  moreBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  moreSheet: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 44, gap: 10 },
  moreHandle: { width: 40, height: 4, backgroundColor: "rgba(0,0,0,0.15)", borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  sheetBtn: { borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 100, paddingVertical: 16, alignItems: "center" as const },
  sheetBtnBlue: { backgroundColor: "#30B8E8", borderColor: "#30B8E8" },
  sheetBtnBeige: { backgroundColor: "#EDE5D8", borderColor: "#EDE5D8" },
  sheetBtnMagenta: { backgroundColor: ACCENT, borderColor: ACCENT },
  sheetBtnText: { color: "#13131a", fontSize: 15, fontWeight: "500" as const },
  sheetBtnTextLight: { color: "#fff", fontWeight: "600" as const },
  sheetConfirmText: { color: "#13131a", fontSize: 16, fontWeight: "600" as const, textAlign: "center" as const, marginVertical: 10 },
});
