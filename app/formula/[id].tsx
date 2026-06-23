import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, FlatList, Modal, StyleSheet, Share, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Video, ResizeMode } from "expo-av";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import GradientScreen from "@/components/GradientScreen";
import { GlassRow } from "@/components/GlassCard";

const SYMBOL_ICONS: Record<string, string> = {
  Top: "▲", Mid: "■", Base: "●", Solvent: "★", Other: "✴",
};

const MOOD_BUCKET = "moodboard";

const DILUENTS = [
  "Ethanol (SDA 40B)",
  "DPG (Dipropylene Glycol)",
  "TEC (Triethyl Citrate)",
  "IPM (Isopropyl Myristate)",
  "MCT Oil",
  "Perfumers Alcohol",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Formula {
  id: number;
  name: string;
  description: string | null;
  date_created: string;
  notes: string | null;
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
  const defaults = { bottleSizeMl: 15, concPercent: 20, diluent: "Ethanol (SDA 40B)" };
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

  return (
    <View style={s.lineRow}>
      <Text style={[s.lineName, { flex: 1, marginRight: 6 }]} numberOfLines={1}>
        {line.material?.name ?? `Material #${line.material_id}`}
      </Text>
      <Text style={s.lineTypeCol} numberOfLines={1}>
        {line.material?.type ?? "—"}
      </Text>
      <View style={{ width: 68, alignItems: "flex-end", marginRight: 4 }}>
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
      <TouchableOpacity style={{ padding: 6 }} onPress={onDelete}>
        <Text style={{ color: "#f87171", fontSize: 18 }}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Add Mood Item Modal ──────────────────────────────────────────────────────

const MOOD_TABS = [
  { key: "image", label: "Image/Video", icon: "⬛" },
  { key: "audio", label: "Audio",       icon: "♪"  },
  { key: "note",  label: "Note",        icon: "☰"  },
] as const;
type MoodTab = typeof MOOD_TABS[number]["key"];

function AddMoodItemModal({ visible, formulaId, onClose, onAdded }: {
  visible: boolean; formulaId: number; onClose: () => void; onAdded: () => void;
}) {
  const [tab, setTab] = useState<MoodTab>("image");
  const [noteText, setNoteText] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>("image/jpeg");
  const [imageCaption, setImageCaption] = useState("");
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) { setTab("image"); setNoteText(""); setImageUri(null); setImageMimeType("image/jpeg"); setImageCaption(""); setAudioUri(null); setAudioName(null); }
  }, [visible]);

  const pickImage = async (source: "camera" | "library") => {
    const opts = { mediaTypes: ["images", "videos"] as any, allowsEditing: false, quality: 0.75 };
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageMimeType(asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg"));
    }
  };

  const handleImageTap = () => Alert.alert("Upload Image/Video", "Choose source", [
    { text: "Take Photo", onPress: () => pickImage("camera") },
    { text: "Choose from Library", onPress: () => pickImage("library") },
    { text: "Cancel", style: "cancel" },
  ]);

  const pickAudio = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/aac", "audio/x-m4a", "audio/*"],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      setAudioUri(result.assets[0].uri);
      setAudioName(result.assets[0].name);
    }
  };

  const handleSave = async () => {
    if (tab === "note" && !noteText.trim()) return;
    if (tab === "image" && !imageUri) return;
    setSaving(true);
    try {
      if (tab === "note") {
        const { error } = await supabase.from("formula_moodboard_assets").insert({
          formula_id: formulaId, file_url: "EMPTY", media_type: "note", caption: noteText.trim(),
        });
        if (error) throw error;
      } else if (tab === "image") {
        const isVideo = imageMimeType.startsWith("video/");
        const ext = imageMimeType.split("/")[1] || (isVideo ? "mp4" : "jpg");
        const slug = isVideo ? "video" : "photo";
        const fileName = `formula_${formulaId}/${Date.now()}-${slug}.${ext}`;
        const base64 = await FileSystem.readAsStringAsync(imageUri!, { encoding: FileSystem.EncodingType.Base64 });
        const arrayBuffer = decode(base64);
        const { error: uploadError } = await supabase.storage.from(MOOD_BUCKET).upload(fileName, arrayBuffer, { contentType: imageMimeType });
        if (uploadError) throw uploadError;
        const { error: insertError } = await supabase.from("formula_moodboard_assets").insert({
          formula_id: formulaId, file_url: fileName, media_type: isVideo ? "video" : "image", caption: null,
        });
        if (insertError) throw insertError;
      } else if (tab === "audio") {
        const ext = audioName?.split(".").pop() ?? "mp3";
        const fileName = `formula_${formulaId}/${Date.now()}-audio.${ext}`;
        const base64 = await FileSystem.readAsStringAsync(audioUri!, { encoding: FileSystem.EncodingType.Base64 });
        const arrayBuffer = decode(base64);
        const { error: uploadError } = await supabase.storage.from(MOOD_BUCKET).upload(fileName, arrayBuffer, { contentType: `audio/${ext}` });
        if (uploadError) throw uploadError;
        const { error: insertError } = await supabase.from("formula_moodboard_assets").insert({
          formula_id: formulaId, file_url: fileName, media_type: "audio", caption: audioName ?? null,
        });
        if (insertError) throw insertError;
      }
      onAdded();
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to add item");
    } finally {
      setSaving(false);
    }
  };

  const canSave = tab === "note" ? noteText.trim().length > 0 : tab === "image" ? imageUri !== null : audioUri !== null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <LinearGradient colors={["#FFD4E6", "#F5AEC8", "#EC8FB5"]} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          {/* Header */}
          <View style={mb.header}>
            <Text style={mb.title}>ADD TO MOOD BOARD</Text>
            <TouchableOpacity onPress={onClose} style={mb.closeBtn}>
              <Text style={mb.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={mb.tabRow}>
            {MOOD_TABS.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[mb.tab, tab === key && mb.tabActive]}
                onPress={() => setTab(key)}
              >
                <Text style={[mb.tabText, tab === key && mb.tabTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
            {tab === "image" && (
              <>
                <TouchableOpacity style={mb.photoUpload} onPress={handleImageTap} activeOpacity={0.85}>
                  {imageUri && (
                    <Image source={{ uri: imageUri }} style={[StyleSheet.absoluteFill, { borderRadius: 18 }]} resizeMode="contain" />
                  )}
                  {!imageUri && (
                    <View style={{ alignItems: "center" }}>
                      <Text style={mb.photoUploadIcon}>↑</Text>
                      <Text style={mb.photoUploadLabel}>Tap to capture or upload</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </>
            )}

            {tab === "audio" && (
              <>
                <Text style={mb.uploadLabel}>Upload Audio</Text>
                <TouchableOpacity style={mb.photoUpload} onPress={pickAudio} activeOpacity={0.85}>
                  {audioUri ? (
                    <View style={{ alignItems: "center" }}>
                      <Text style={mb.photoUploadIcon}>♪</Text>
                      <Text style={[mb.photoUploadLabel, { fontWeight: "600", color: "#13131a" }]} numberOfLines={1}>{audioName}</Text>
                      <Text style={[mb.photoUploadLabel, { marginTop: 6 }]}>Tap to change</Text>
                    </View>
                  ) : (
                    <View style={{ alignItems: "center" }}>
                      <Text style={mb.photoUploadIcon}>↑</Text>
                      <Text style={mb.photoUploadLabel}>Tap to upload audio (MP3, M4A, WAV, AAC)</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </>
            )}

            {tab === "note" && (
              <TextInput
                style={mb.noteInput}
                placeholder="Thoughts, inspiration, observations..."
                placeholderTextColor="rgba(0,0,0,0.35)"
                value={noteText}
                onChangeText={setNoteText}
                multiline
                autoFocus
                textAlignVertical="top"
              />
            )}

            {saving && <View style={{ alignItems: "center", paddingVertical: 16 }}><ActivityIndicator color="#13131a" /></View>}
            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Save */}
          <SafeAreaView edges={["bottom"]} style={{ backgroundColor: "transparent" }}>
            <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
              <TouchableOpacity
                style={[mb.saveBtn, !canSave && { opacity: 0.4 }]}
                onPress={handleSave}
                disabled={!canSave || saving}
              >
                <Text style={mb.saveBtnText}>Add to Mood Board</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

// ─── Formula Detail ───────────────────────────────────────────────────────────

export default function FormulaDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const formulaId = parseInt(id ?? "0");
  const { user } = useAuth();

  const [formula, setFormula] = useState<Formula | null>(null);
  const [lines, setLines] = useState<FormulaLine[]>([]);
  const [moodItems, setMoodItems] = useState<MoodItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Formula params
  const [bottleSizeMl, setBottleSizeMl] = useState(15);
  const [concPercent, setConcPercent] = useState(20);
  const [diluent, setDiluent] = useState("Ethanol (SDA 40B)");
  const [diluentPickerVisible, setDiluentPickerVisible] = useState(false);

  // Inline add material
  const [inlineSearch, setInlineSearch] = useState("");
  const [inlineResults, setInlineResults] = useState<Material[]>([]);
  const [inlineSelected, setInlineSelected] = useState<Material | null>(null);
  const [inlineAmount, setInlineAmount] = useState("0.000");
  const [inlineAdding, setInlineAdding] = useState(false);

  // Notes collapsible
  const [notesExpanded, setNotesExpanded] = useState(true);

  // Inline name/description editing
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [nameVal, setNameVal] = useState("");
  const [descVal, setDescVal] = useState("");

  // Modal visibility
  const [addMoodVisible, setAddMoodVisible] = useState(false);
  const [moodCollapsed, setMoodCollapsed] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalG = useMemo(() => lines.reduce((sum, l) => sum + safeNum(l.amount_g), 0), [lines]);
  const targetConcentrateG = useMemo(() => +(bottleSizeMl * (concPercent / 100)).toFixed(3), [bottleSizeMl, concPercent]);
  const diluentNeededMl = useMemo(() => Math.max(0, +(bottleSizeMl - targetConcentrateG).toFixed(1)), [bottleSizeMl, targetConcentrateG]);

  useEffect(() => {
    if (formula) {
      const p = parseParams(formula.notes);
      setBottleSizeMl(p.bottleSizeMl);
      setConcPercent(p.concPercent);
      setDiluent(p.diluent);
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
      supabase.from("formulas").select("id,name,description,date_created,notes").eq("id", formulaId).single(),
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
    Alert.alert("Remove Material", "Remove this material from the formula?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => { await supabase.from("formula_lines").delete().eq("id", lineId); fetchData(); } },
    ]);
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

  const handleDeleteFormula = () => {
    Alert.alert("Delete Formula", `Delete "${formula?.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await supabase.from("formulas").delete().eq("id", formulaId); router.back(); } },
    ]);
  };

  const handleDeleteMoodItem = (itemId: string) => {
    Alert.alert("Remove Item", "Remove this mood board item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive", onPress: async () => {
          const item = moodItems.find((i) => i.id === itemId);
          if (item && item.media_type !== "note") {
            const path = extractStoragePath(item.file_url);
            if (path) await supabase.storage.from(MOOD_BUCKET).remove([path]);
          }
          await supabase.from("formula_moodboard_assets").delete().eq("id", itemId);
          setMoodItems((prev) => prev.filter((i) => i.id !== itemId));
        },
      },
    ]);
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
    setSaving(true);
    const name = editingName ? (nameVal.trim() || formula.name) : formula.name;
    const description = editingDesc ? (descVal.trim() || null) : formula.description;
    const { error } = await supabase.from("formulas").update({ name, description }).eq("id", formulaId);
    setSaving(false);
    if (error) { Alert.alert("Save failed", error.message); return; }
    setFormula((f) => f ? { ...f, name, description } : f);
    setEditingName(false);
    setEditingDesc(false);
  };

  const handleSaveVersion = async () => {
    setMoreVisible(false);
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
      notes: JSON.stringify(snapshot),
      created_by: user?.id,
    }]);
    if (error) { Alert.alert("Error", error.message); return; }
    Alert.alert("Version Saved", `Version ${nextNum} saved.`);
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

  const handleShare = async () => {
    if (!formula) return;
    const ingList = lines.slice().sort((a, b) => b.amount_g - a.amount_g)
      .map((l) => `  • ${l.material?.name ?? "Unknown"}: ${l.amount_g.toFixed(3)}g (${totalG > 0 ? ((l.amount_g / totalG) * 100).toFixed(1) : 0}%)`)
      .join("\n");
    const text = [
      `🧪 ${formula.name}`,
      formula.description ? `\n${formula.description}` : "",
      `\nIngredients — ${totalG.toFixed(3)}g total:`,
      ingList || "  (none)",
      `\nBottle: ${bottleSizeMl}mL · Conc: ${concPercent}% · Diluent: ${diluent}`,
    ].filter(Boolean).join("\n");
    await Share.share({ title: formula.name, message: text });
  };

  if (loading) return (
    <GradientScreen gradient="lab">
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color="#a78bfa" /></View>
    </GradientScreen>
  );
  if (!formula) return (
    <GradientScreen gradient="lab">
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "rgba(255,255,255,0.5)" }}>Formula not found</Text></View>
    </GradientScreen>
  );

  const atTarget = Math.abs(totalG - targetConcentrateG) < 0.001;

  return (
    <GradientScreen gradient="lab">
      {/* Nav */}
      <View style={s.navBar}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>← Lab</Text></TouchableOpacity>
        <TouchableOpacity style={s.profileBtn} onPress={() => router.push("/(tabs)/profile" as any)}>
          <Text style={s.profileIcon}>👤</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">

        {/* Header — inline editable */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          {editingName ? (
            <TextInput
              style={[s.formulaName, { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.3)", paddingBottom: 4 }]}
              value={nameVal}
              onChangeText={setNameVal}
              onBlur={commitName}
              onSubmitEditing={commitName}
              autoFocus
              returnKeyType="done"
            />
          ) : (
            <TouchableOpacity onPress={() => { setNameVal(formula.name); setEditingName(true); }} activeOpacity={0.7}>
              <Text style={s.formulaName}>{formula.name}</Text>
            </TouchableOpacity>
          )}
          <Text style={s.formulaDate}>
            {new Date(formula.date_created).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </Text>
          {editingDesc ? (
            <TextInput
              style={[s.formulaDesc, { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.3)", paddingBottom: 4, marginTop: 8 }]}
              value={descVal}
              onChangeText={setDescVal}
              onBlur={commitDesc}
              multiline
              autoFocus
              placeholder="Add notes..."
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
          ) : (
            <TouchableOpacity onPress={() => { setDescVal(formula.description ?? ""); setEditingDesc(true); }} activeOpacity={0.7} style={{ marginTop: 6 }}>
              <Text style={s.formulaDesc}>
                {formula.description || <Text style={{ color: "rgba(255,255,255,0.3)" }}>Tap to add notes...</Text>}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ① Mood Board */}
        <View style={[s.panel, { marginHorizontal: 16, marginBottom: 16 }]}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Mood Board</Text>
            <TouchableOpacity style={s.addBtn} onPress={() => setAddMoodVisible(true)}>
              <Text style={s.addBtnText}>+ Add Item</Text>
            </TouchableOpacity>
          </View>

          {!moodCollapsed && (
            <>
              {moodItems.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 24 }}>
                  <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, textAlign: "center" }}>
                    No mood board items yet.{"\n"}Add images or notes for inspiration.
                  </Text>
                </View>
              ) : (
                <>
                  {/* Notes — full width */}
                  {moodItems.filter((i) => i.media_type === "note").map((item) => (
                    <View key={item.id} style={s.noteCard}>
                      <Text style={s.noteText}>{item.caption}</Text>
                      <TouchableOpacity style={s.noteDeleteBtn} onPress={() => handleDeleteMoodItem(item.id)}>
                        <Text style={{ color: "#f87171", fontSize: 16 }}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Images — 2 per row */}
                  {(() => {
                    const mediaItems = moodItems.filter((i) => (i.media_type === "image" || i.media_type === "video" || i.media_type === "audio") && i.display_url);
                    if (!mediaItems.length) return null;
                    return (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                        {mediaItems.map((item) => (
                          <View key={item.id} style={[s.imageCard, { width: "47%" }]}>
                            {item.media_type === "video" ? (
                              <Video
                                source={{ uri: item.display_url! }}
                                style={{ width: "100%", height: "100%" }}
                                resizeMode={ResizeMode.COVER}
                                useNativeControls
                                isLooping={false}
                              />
                            ) : (
                              <Image source={{ uri: item.display_url! }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                            )}
                            <TouchableOpacity style={s.imageDeleteBtn} onPress={() => handleDeleteMoodItem(item.id)}>
                              <BlurView intensity={40} tint="dark" style={s.imageDeleteBlur}>
                                <Text style={{ color: "#f87171", fontSize: 14, fontWeight: "700" }}>×</Text>
                              </BlurView>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    );
                  })()}
                </>
              )}
            </>
          )}

          {/* Hide / Show toggle */}
          {moodItems.length > 0 && (
            <TouchableOpacity
              style={{ alignSelf: "flex-end", marginTop: 10 }}
              onPress={() => setMoodCollapsed((v) => !v)}
            >
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "600" }}>
                {moodCollapsed ? "Show" : "Hide"}
              </Text>
            </TouchableOpacity>
          )}
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
                onBlur={() => saveParams()}
                keyboardType="decimal-pad"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.paramLabel}>Concentration (%)</Text>
              <TextInput
                style={s.paramInput}
                value={concPercent.toString()}
                onChangeText={(v) => setConcPercent(parseFloat(v) || 0)}
                onBlur={() => saveParams()}
                keyboardType="decimal-pad"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            </View>
          </View>
          <Text style={s.paramLabel}>Diluent</Text>
          <TouchableOpacity style={s.diluentRow} onPress={() => setDiluentPickerVisible(true)}>
            <Text style={{ color: "#13131a", fontSize: 14 }}>{diluent}</Text>
            <Text style={{ color: "rgba(0,0,0,0.4)", fontSize: 15 }}>▾</Text>
          </TouchableOpacity>
          <Text style={s.paramCalc}>
            Current concentrate: {totalG.toFixed(3)}g · Target concentrate: {targetConcentrateG.toFixed(3)}g · Diluent to add: {diluentNeededMl} mL
          </Text>
          <TouchableOpacity
            style={[s.normalizeBtn, (atTarget || totalG === 0) && { opacity: 0.4 }]}
            onPress={normalizeToTarget}
            disabled={atTarget || totalG === 0}
          >
            <Text style={s.normalizeBtnText}>Normalize to Target</Text>
          </TouchableOpacity>
        </View>

        {/* ③ Type to search bar (inline add) */}
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <TextInput
              style={[s.searchBarInline, { flex: 1 }]}
              placeholder="Type to search materials..."
              placeholderTextColor="rgba(0,0,0,0.35)"
              value={inlineSearch}
              onChangeText={(v) => { setInlineSearch(v); setInlineSelected(null); }}
            />
            <TextInput
              style={s.amountInline}
              placeholder="0.000"
              placeholderTextColor="rgba(0,0,0,0.35)"
              value={inlineAmount}
              onChangeText={setInlineAmount}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              style={[s.addBtn, ((!inlineSelected && !inlineSearch.trim()) || inlineAdding) && { opacity: 0.45 }]}
              onPress={handleInlineAdd}
              disabled={(!inlineSelected && !inlineSearch.trim()) || inlineAdding}
            >
              {inlineAdding
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.addBtnText}>Add</Text>
              }
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
                  <Text style={{ color: "#13131a", fontSize: 14 }}>{item.name}</Text>
                  {item.type ? <Text style={{ color: "rgba(0,0,0,0.45)", fontSize: 12 }}>{SYMBOL_ICONS[item.type] ?? ""} {item.type}</Text> : null}
                </TouchableOpacity>
              ))}
              {!inlineResults.some((r) => r.name.toLowerCase() === inlineSearch.toLowerCase()) && (
                <TouchableOpacity
                  style={[s.inlineDropdownRow, inlineResults.length > 0 && { borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.1)" }]}
                  onPress={() => { setInlineResults([]); }}
                >
                  <Text style={{ color: "#22a55b", fontSize: 14, fontWeight: "600" }}>+ Add "{inlineSearch}" as new material</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}
          {inlineSelected ? (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, paddingHorizontal: 2 }}>
              <Text style={{ color: "#a78bfa", fontSize: 13 }}>✓ {inlineSelected.name}</Text>
              <TouchableOpacity onPress={() => { setInlineSelected(null); setInlineSearch(""); }} style={{ marginLeft: 10 }}>
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Clear</Text>
              </TouchableOpacity>
            </View>
          ) : !inlineSelected && inlineSearch.trim() && inlineResults.length === 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, paddingHorizontal: 2 }}>
              <Text style={{ color: "#ec8fb5", fontSize: 13 }}>★ "{inlineSearch}" will be added to your Organ</Text>
            </View>
          ) : null}
        </View>

        {/* ④ Materials Table */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <GlassRow style={{ paddingHorizontal: 16 }}>
            {/* Table header */}
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderText, { flex: 1 }]}>Material</Text>
              <Text style={[s.tableHeaderText, { width: 52 }]}>Type</Text>
              <Text style={[s.tableHeaderText, { width: 68, textAlign: "right" }]}>Amount (g)</Text>
              <View style={{ width: 30 }} />
            </View>
            {lines.length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>No ingredients yet. Add some to get started.</Text>
              </View>
            ) : (
              lines.map((line) => (
                <LineRow
                  key={line.id} line={line} totalG={totalG}
                  onDelete={() => handleDeleteLine(line.id)}
                  onUpdateAmount={(g) => handleUpdateAmount(line.id, g)}
                />
              ))
            )}
            {/* Total row */}
            <View style={s.tableTotalRow}>
              <Text style={[s.tableTotalLabel, { flex: 1 }]}>Total</Text>
              <Text style={s.tableTotalVal}>{totalG.toFixed(3)}</Text>
              {!atTarget && lines.length > 0 ? (
                <Text style={s.tableUnderBy}>  Under by {Math.abs(targetConcentrateG - totalG).toFixed(3)}g</Text>
              ) : null}
              <Text style={[s.tableTotalVal, { width: 44, textAlign: "right" }]}>100.000%</Text>
              <View style={{ width: 30 }} />
            </View>
          </GlassRow>
        </View>

        {/* ⑤ Formula Summary */}
        <View style={[s.panel, { marginHorizontal: 16, marginBottom: 16 }]}>
          <Text style={[s.sectionTitle, { marginBottom: 16 }]}>Formula Summary</Text>
          <View style={{ flexDirection: "row" }}>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={s.statVal}>{totalG.toFixed(3)}g</Text>
              <Text style={s.statLabel}>Current Total</Text>
            </View>
            <View style={s.statDivider} />
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={s.statVal}>{targetConcentrateG.toFixed(3)}g</Text>
              <Text style={s.statLabel}>Target Concentrate</Text>
            </View>
            <View style={s.statDivider} />
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={s.statVal}>{diluentNeededMl} mL</Text>
              <Text style={s.statLabel}>Base/Diluent Needed</Text>
            </View>
          </View>
        </View>

        {/* ⑥ Notes (collapsible) */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <TouchableOpacity
            style={[
              s.notesHeader,
              notesExpanded && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
            ]}
            onPress={() => setNotesExpanded((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={s.sectionTitle}>Notes</Text>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 18, lineHeight: 22 }}>
              {notesExpanded ? "∧" : "∨"}
            </Text>
          </TouchableOpacity>
          {notesExpanded ? (
            <View style={s.notesBody}>
              {formula.description ? (
                <Text style={s.notesText}>{formula.description}</Text>
              ) : (
                <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
                  No notes yet. Tap Edit to add.
                </Text>
              )}
            </View>
          ) : null}
        </View>

      </ScrollView>

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

      {/* Persistent bottom bar */}
      <View style={s.bottomBar}>
        <TouchableOpacity style={s.moreBtn} onPress={() => setMoreVisible(true)}>
          <Text style={s.moreBtnText}>More</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#13131a" size="small" /> : <Text style={s.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      {/* More sheet */}
      <Modal visible={moreVisible} transparent animationType="slide" onRequestClose={() => setMoreVisible(false)}>
        <View style={s.moreBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={() => setMoreVisible(false)} />
          <View style={s.moreSheet}>
            <View style={s.moreHandle} />
            <TouchableOpacity style={s.sheetBtn} onPress={() => { setMoreVisible(false); handleShare(); }}>
              <Text style={s.sheetBtnText}>Share Formula</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.sheetBtn} onPress={handleSaveVersion}>
              <Text style={s.sheetBtnText}>Save Version</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.sheetBtn} onPress={handleDuplicate}>
              <Text style={s.sheetBtnText}>Duplicate Formula</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.sheetBtn, s.sheetBtnDanger]} onPress={() => { setMoreVisible(false); handleDeleteFormula(); }}>
              <Text style={[s.sheetBtnText, { color: "#e53535" }]}>Delete Formula</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </GradientScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

// Mood board modal styles
const mb = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#13131a",
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.08)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeIcon: { color: "#13131a", fontSize: 14, fontWeight: "600" },

  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.2)",
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  tabActive: {
    backgroundColor: "#13131a",
    borderColor: "#13131a",
  },
  tabText: { fontSize: 13, fontWeight: "600", color: "rgba(0,0,0,0.6)" },
  tabTextActive: { color: "#ffffff" },

  uploadLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#13131a",
    marginBottom: 10,
  },
  photoUpload: {
    width: "100%",
    height: 380,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.06)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
  photoUploadIcon: { fontSize: 32, color: "rgba(19,19,26,0.35)", marginBottom: 10 },
  photoUploadLabel: { color: "rgba(19,19,26,0.4)", fontSize: 14 },

  uploadBox: {
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.2)",
    borderStyle: "dashed",
    borderRadius: 14,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  uploadArrow: {
    fontSize: 32,
    color: "#13131a",
    marginBottom: 12,
  },
  uploadDesc: {
    fontSize: 13,
    color: "rgba(0,0,0,0.55)",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 6,
  },
  uploadMax: {
    fontSize: 12,
    color: "rgba(0,0,0,0.4)",
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#13131a",
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#13131a",
  },
  noteInput: {
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: "#13131a",
    minHeight: 180,
  },

  saveBtn: {
    backgroundColor: "#13131a",
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
});

const s = StyleSheet.create({
  navBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  back: { color: "#13131a", fontSize: 16, fontWeight: "600" },
  profileBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.08)", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", alignItems: "center", justifyContent: "center" },
  profileIcon: { fontSize: 16 },
  deleteBtn: { color: "#f87171", fontSize: 16 },

  formulaName: { color: "#13131a", fontSize: 26, fontWeight: "700", marginBottom: 4 },
  formulaDate: { color: "rgba(0,0,0,0.4)", fontSize: 13 },
  formulaDesc: { color: "rgba(0,0,0,0.55)", fontSize: 14, lineHeight: 20 },

  panel: { backgroundColor: "rgba(255,255,255,0.35)", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 16, padding: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sectionTitle: { color: "#13131a", fontWeight: "600", fontSize: 16 },

  addBtn: { backgroundColor: "#13131a", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  // Mood Board
  noteCard: { width: "100%", backgroundColor: "rgba(255,255,255,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.7)", borderRadius: 12, padding: 16, paddingBottom: 20, position: "relative", minHeight: 90 },
  noteText: { color: "#13131a", fontSize: 14, lineHeight: 22, paddingRight: 24 },
  noteDeleteBtn: { position: "absolute", top: 10, right: 12 },
  imageCard: { width: "47%", aspectRatio: 4 / 3, borderRadius: 12, overflow: "hidden", position: "relative" },
  imageCaptionBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 8, paddingVertical: 6 },
  imageCaptionText: { color: "#fff", fontSize: 11, lineHeight: 14 },
  imageDeleteBtn: { position: "absolute", top: 6, right: 6 },
  imageDeleteBlur: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", overflow: "hidden" },

  // Formula Parameters
  paramLabel: { color: "rgba(0,0,0,0.5)", fontSize: 12, marginBottom: 6 },
  paramInput: { backgroundColor: "rgba(255,255,255,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: "#13131a", fontSize: 15 },
  diluentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  paramCalc: { color: "rgba(0,0,0,0.4)", fontSize: 12, lineHeight: 18 },
  normalizeBtn: { marginTop: 14, backgroundColor: "rgba(139,117,250,0.25)", borderWidth: 1, borderColor: "rgba(167,139,250,0.5)", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  normalizeBtnText: { color: "#5b3fd4", fontWeight: "600", fontSize: 15 },

  // Inline search
  searchBarInline: { backgroundColor: "rgba(255,255,255,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11, color: "#13131a", fontSize: 14 },
  amountInline: { backgroundColor: "rgba(255,255,255,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 11, color: "#13131a", fontSize: 14, width: 72, textAlign: "center" },
  inlineDropdown: { backgroundColor: "#fff", borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 12, marginTop: 6, overflow: "hidden" },
  inlineDropdownRow: { paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  // Materials table
  tableHeader: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.1)" },
  tableHeaderText: { color: "rgba(0,0,0,0.4)", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  lineRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" },
  lineName: { color: "#13131a", fontWeight: "500", fontSize: 14 },
  lineTypeCol: { width: 52, color: "rgba(0,0,0,0.45)", fontSize: 12 },
  lineAmount: { color: "#13131a", fontSize: 14 },
  linePct: { color: "#7c5cbf", fontSize: 12, marginTop: 2 },
  lineInput: { backgroundColor: "rgba(255,255,255,0.8)", borderWidth: 1, borderColor: "rgba(167,139,250,0.6)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, color: "#13131a", textAlign: "right", width: 80 },
  tableTotalRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.1)", marginTop: 2 },
  tableTotalLabel: { color: "#13131a", fontWeight: "700", fontSize: 14 },
  tableTotalVal: { color: "#13131a", fontWeight: "700", fontSize: 14 },
  tableUnderBy: { color: "rgba(200,100,0,0.9)", fontSize: 11 },

  // Formula Summary
  statVal: { color: "#13131a", fontWeight: "700", fontSize: 17, marginBottom: 4, textAlign: "center" },
  statLabel: { color: "rgba(0,0,0,0.4)", fontSize: 11, textAlign: "center" },
  statDivider: { width: 1, backgroundColor: "rgba(0,0,0,0.1)", marginVertical: 4 },

  // Notes collapsible
  notesHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "rgba(255,255,255,0.35)", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 12 },
  notesBody: { backgroundColor: "rgba(255,255,255,0.25)", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderTopWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, padding: 16 },
  notesText: { color: "rgba(0,0,0,0.65)", fontSize: 14, lineHeight: 21 },

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
  bottomBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.1)", backgroundColor: "#fff" },
  moreBtn: { borderWidth: 1, borderColor: "rgba(0,0,0,0.2)", borderRadius: 24, paddingHorizontal: 22, paddingVertical: 12 },
  moreBtnText: { color: "#13131a", fontSize: 14 },
  saveBtn: { backgroundColor: "#C6FF00", borderRadius: 24, paddingHorizontal: 28, paddingVertical: 13 },
  saveBtnText: { color: "#13131a", fontSize: 15, fontWeight: "700" },

  // More sheet
  moreBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  moreSheet: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 44, gap: 10 },
  moreHandle: { width: 40, height: 4, backgroundColor: "rgba(0,0,0,0.15)", borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  sheetBtn: { borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 100, paddingVertical: 16, alignItems: "center" as const },
  sheetBtnDanger: { borderColor: "rgba(220,50,50,0.2)" },
  sheetBtnText: { color: "#13131a", fontSize: 15, fontWeight: "500" as const },
});
