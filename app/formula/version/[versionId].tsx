import { useState, useEffect, useRef } from "react";
import { ProfileIcon } from "@/components/ProfileIcon";
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, StyleSheet, Image, TextInput, Modal, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { SpilsLogo } from "@/components/SpilsLogo";
import { ConfirmModal, ConfirmConfig } from "@/components/ConfirmModal";

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = "#EC008C";
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

const SYMBOL_ICONS: Record<string, string> = {
  Top: "▲", Mid: "●", Base: "■", Solvent: "★", Other: "✴",
};
const SYMBOL_ORDER: Record<string, number> = { Top: 0, Mid: 1, Base: 2, Solvent: 3, Other: 4 };
function symbolRank(type?: string | null) {
  if (!type) return 5;
  return SYMBOL_ORDER[type] ?? 5;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SnapshotLine {
  material_id: number;
  amount_g: number;
  name: string | null;
  type?: string | null;
  density_g_per_ml?: number | null;
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
  label: string | null;
  created_at: string;
  formulas?: { name: string; description: string | null } | null;
}

interface MoodItem {
  id: string;
  file_url: string;
  media_type: "image" | "note" | "audio" | "video";
  caption: string | null;
  display_url?: string | null;
}

interface MaterialResult {
  id: number;
  name: string;
  type: string | null;
  density_g_per_ml?: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}.${dd}.${yy}`;
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

async function fetchMood(formulaId: number): Promise<MoodItem[]> {
  const { data } = await supabase
    .from("formula_moodboard_assets").select("*")
    .eq("formula_id", formulaId).order("created_at", { ascending: false });
  const raw = (data ?? []) as MoodItem[];
  const resolved: MoodItem[] = [];
  for (const item of raw) {
    if (item.media_type === "note") { resolved.push({ ...item, display_url: null }); continue; }
    const path = extractStoragePath(item.file_url);
    if (!path) { resolved.push({ ...item, display_url: item.file_url || null }); continue; }
    resolved.push({ ...item, display_url: await resolveSignedUrl(path) });
  }
  return resolved;
}

// ─── Add Mood Image Modal (image-only capture pop-up) ─────────────────────────

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
      const { error: uploadError } = await supabase.storage.from(MOOD_BUCKET).upload(fileName, decode(base64), { contentType: imageMimeType });
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

// ─── Editable Line Row ────────────────────────────────────────────────────────

function EditableLine({ line, pct, unit, onUpdate, onDelete }: {
  line: SnapshotLine; pct: string; unit: "g" | "mL";
  onUpdate: (g: number) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const density = line.density_g_per_ml || 1;
  const shown = unit === "g" ? line.amount_g : line.amount_g / density;
  const [val, setVal] = useState(line.amount_g.toFixed(3));

  const commit = () => {
    const n = parseFloat(val);
    // Input is in the displayed unit; store grams
    if (Number.isFinite(n) && n >= 0) onUpdate(unit === "g" ? n : n * density);
    else setVal(line.amount_g.toFixed(3));
    setEditing(false);
  };

  const symbol = line.type ? (SYMBOL_ICONS[line.type] ?? "") : "";

  return (
    <View style={s.lineRow}>
      <Text style={s.lineSymbol}>{symbol}</Text>
      <Text style={s.lineName} numberOfLines={1}>
        {line.name ?? `Material #${line.material_id}`}
      </Text>
      <View style={{ alignItems: "flex-end", marginRight: 2 }}>
        {editing ? (
          <TextInput
            style={s.lineInput}
            value={val}
            onChangeText={setVal}
            keyboardType="decimal-pad"
            onBlur={commit}
            onSubmitEditing={commit}
            autoFocus
            selectTextOnFocus
          />
        ) : (
          <TouchableOpacity onPress={() => { setVal(shown.toFixed(3)); setEditing(true); }}>
            <Text style={s.lineAmt}>{shown.toFixed(3)}{unit}</Text>
          </TouchableOpacity>
        )}
        <Text style={s.linePct}>{pct}%</Text>
      </View>
      <TouchableOpacity style={{ padding: 6, marginLeft: 4, alignSelf: "flex-start" }} onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 18, lineHeight: 18 }}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FormulaVersionDetail() {
  const { versionId } = useLocalSearchParams<{ versionId: string }>();
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState<VersionRow | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [moodItems, setMoodItems] = useState<MoodItem[]>([]);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelVal, setLabelVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [diluentPickerVisible, setDiluentPickerVisible] = useState(false);
  const [moreVisible, setMoreVisible] = useState(false);
  const [addMoodVisible, setAddMoodVisible] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Accordion sections (all collapsed; header card is always open)
  const [moodOpen, setMoodOpen] = useState(false);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [concFocused, setConcFocused] = useState(false);
  const [amountUnit, setAmountUnit] = useState<"g" | "mL">("g");

  // Add ingredient inline
  const [matSearch, setMatSearch] = useState("");
  const [matResults, setMatResults] = useState<MaterialResult[]>([]);
  const [matSelected, setMatSelected] = useState<MaterialResult | null>(null);

  const labelRef = useRef<TextInput>(null);

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
      setLabelVal(row.label ?? `Version ${row.version_num}`);

      if (row.notes) {
        try {
          const parsed: Snapshot = JSON.parse(row.notes);
          // Resolve missing names + note types for the symbol column
          const ids = [...new Set(parsed.lines.map((l) => l.material_id).filter(Boolean))];
          if (ids.length) {
            const { data: mats } = await supabase.from("materials").select("id,name,type,density_g_per_ml").in("id", ids);
            const matMap: Record<number, { name: string; type: string | null; density_g_per_ml?: number | null }> = {};
            (mats ?? []).forEach((m: any) => { matMap[m.id] = { name: m.name, type: m.type, density_g_per_ml: m.density_g_per_ml }; });
            parsed.lines = parsed.lines.map((l) => ({
              ...l,
              name: l.name ?? matMap[l.material_id]?.name ?? null,
              type: l.type ?? matMap[l.material_id]?.type ?? null,
              density_g_per_ml: l.density_g_per_ml ?? matMap[l.material_id]?.density_g_per_ml ?? null,
            }));
          }
          setSnapshot(parsed);
        } catch { /* non-JSON notes */ }
      }

      setMoodItems(await fetchMood(row.formula_id));
      setLoading(false);
    };
    load();
  }, [versionId]);

  // Material search debounce
  useEffect(() => {
    if (!matSearch.trim() || matSelected) { setMatResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from("materials")
        .select("id,name,type,density_g_per_ml").eq("user_id", user?.id).ilike("name", `%${matSearch}%`).limit(8);
      setMatResults((data ?? []) as MaterialResult[]);
    }, 250);
    return () => clearTimeout(timer);
  }, [matSearch, matSelected, user?.id]);

  const updateLineAmount = (index: number, amount_g: number) => {
    setSnapshot((prev) => {
      if (!prev) return prev;
      return { ...prev, lines: prev.lines.map((l, i) => i === index ? { ...l, amount_g } : l) };
    });
  };

  const deleteLine = (index: number) => {
    setSnapshot((prev) => {
      if (!prev) return prev;
      return { ...prev, lines: prev.lines.filter((_, i) => i !== index) };
    });
  };

  const handleAddMaterial = () => {
    const name = matSelected?.name ?? matSearch.trim();
    if (!name) return;
    const newLine: SnapshotLine = {
      material_id: matSelected?.id ?? 0,
      amount_g: 0,
      name,
      type: matSelected?.type ?? null,
    };
    setSnapshot((prev) => prev ? { ...prev, lines: [...prev.lines, newLine] } : prev);
    setMatSearch(""); setMatSelected(null); setMatResults([]);
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

  const handleDelete = () => {
    setMoreVisible(false);
    setConfirm({
      title: "Delete Version",
      message: "Delete this version? This cannot be undone.",
      onConfirm: async () => {
        await supabase.from("formula_versions").delete().eq("id", versionId);
        router.back();
      },
    });
  };

  const handleSave = async () => {
    if (!version) return;
    setSaving(true);
    await supabase.from("formula_versions")
      .update({
        label: labelVal.trim() || null,
        ...(snapshot ? { notes: JSON.stringify(snapshot) } : {}),
      })
      .eq("id", versionId);
    setSaving(false);
    router.back();
  };

  const totalG = snapshot?.lines?.reduce((sum, l) => sum + l.amount_g, 0) ?? 0;
  const targetConcentrateG = snapshot ? +(snapshot.bottle_ml * (snapshot.concentration_pct / 100)).toFixed(3) : 0;
  const diluentNeededMl = snapshot ? Math.max(0, +(snapshot.bottle_ml - targetConcentrateG).toFixed(1)) : 0;
  const atTarget = Math.abs(totalG - targetConcentrateG) < 0.001;
  const overTarget = totalG > targetConcentrateG;
  const targetDiffLabel = Math.abs(totalG - targetConcentrateG).toFixed(3);
  const catG = (t: string) => (snapshot?.lines ?? []).filter((l) => l.type === t).reduce((acc, l) => acc + l.amount_g, 0);
  const topG = catG("Top"), midG = catG("Mid"), baseG = catG("Base");
  const pctOf = (g: number) => (totalG > 0 ? Math.round((g / totalG) * 100) : 0);

  const normalizeToTarget = () => {
    if (!snapshot || !snapshot.lines.length || totalG <= 0 || atTarget) return;
    const scale = targetConcentrateG / totalG;
    const normalized = snapshot.lines.map((l) => ({ ...l, amount_g: +(l.amount_g * scale).toFixed(3) }));
    // Per-line rounding can leave the sum a few mg off target — absorb the remainder into the largest line
    const sum = normalized.reduce((acc, l) => acc + l.amount_g, 0);
    const remainder = +(targetConcentrateG - sum).toFixed(3);
    if (remainder !== 0 && normalized.length) {
      const biggest = normalized.reduce((a, b) => (b.amount_g > a.amount_g ? b : a));
      biggest.amount_g = +(biggest.amount_g + remainder).toFixed(3);
    }
    setSnapshot((prev) => (prev ? { ...prev, lines: normalized } : prev));
  };
  const moodImages = moodItems.filter((i) => i.media_type === "image" && i.display_url);
  const sortedLines = snapshot
    ? snapshot.lines.map((line, idx) => ({ line, idx })).sort((a, b) => symbolRank(a.line.type) - symbolRank(b.line.type))
    : [];

  return (
    <LinearGradient colors={["#000000", "#000000", ACCENT]} locations={[0, 0.82, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Top nav */}
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

        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={ACCENT} />
          </View>
        ) : !version ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 15 }}>Version not found.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* ── Version card (always open) ── */}
            <View style={s.notesCard}>
              <View style={s.notesCardTop}>
                <Text style={s.cardName} numberOfLines={1}>{version.formulas?.name ?? "Formula"}</Text>
                <Text style={s.cardDate}>{formatDate(version.created_at)}</Text>
              </View>

              {version.formulas?.description ? (
                <Text style={s.cardNotes}>{version.formulas.description}</Text>
              ) : null}

              <View style={s.cardBottom}>
                <TouchableOpacity
                  style={s.versionBadge}
                  onPress={() => { setEditingLabel(true); setTimeout(() => labelRef.current?.focus(), 50); }}
                  activeOpacity={0.7}
                >
                  {editingLabel ? (
                    <TextInput
                      ref={labelRef}
                      style={s.versionBadgeInput}
                      value={labelVal}
                      onChangeText={setLabelVal}
                      onBlur={() => { setEditingLabel(false); if (!labelVal.trim()) setLabelVal(`Version ${version.version_num}`); }}
                      onSubmitEditing={() => labelRef.current?.blur()}
                      returnKeyType="done"
                      selectTextOnFocus
                      autoCorrect={false}
                    />
                  ) : (
                    <Text style={s.versionBadgeText}>{labelVal}</Text>
                  )}
                </TouchableOpacity>
                <Text style={s.savedOn}>Saved {formatDate(version.created_at)}</Text>
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
                      {moodImages.slice(0, 3).map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={s.moodImgCard}
                          activeOpacity={0.9}
                          onPress={() => setLightboxUrl(item.display_url!)}
                        >
                          <Image source={{ uri: item.display_url! }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                          <TouchableOpacity
                            style={s.imgDelBtn}
                            onPress={() => handleDeleteMoodItem(item.id)}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Text style={s.imgDelText}>×</Text>
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
            {snapshot && (
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
                          value={String(snapshot.bottle_ml)}
                          onChangeText={(v) => setSnapshot((p) => p ? { ...p, bottle_ml: parseFloat(v) || 0 } : p)}
                          keyboardType="decimal-pad"
                          selectTextOnFocus
                          placeholderTextColor="rgba(255,255,255,0.3)"
                        />
                      </View>
                      <View style={s.paramColSm}>
                        <Text style={s.paramLabel}>Concentration (%)</Text>
                        <TextInput
                          style={s.paramInput}
                          value={concFocused ? String(snapshot.concentration_pct) : `${snapshot.concentration_pct}%`}
                          onChangeText={(v) => setSnapshot((p) => p ? { ...p, concentration_pct: parseFloat(v) || 0 } : p)}
                          onFocus={() => setConcFocused(true)}
                          onBlur={() => setConcFocused(false)}
                          keyboardType="decimal-pad"
                          selectTextOnFocus
                          placeholderTextColor="rgba(255,255,255,0.3)"
                        />
                      </View>
                      <View style={s.paramColLg}>
                        <Text style={s.paramLabel}>Diluent</Text>
                        <TouchableOpacity style={s.diluentRow} onPress={() => setDiluentPickerVisible(true)}>
                          <Text style={s.diluentText} numberOfLines={1}>{snapshot.diluent}</Text>
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
            )}

            {/* ── Formula ── */}
            {snapshot && (
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
                          value={matSearch}
                          onChangeText={(v) => { setMatSearch(v); setMatSelected(null); }}
                        />
                        <TouchableOpacity
                          style={[s.searchAddBtn, !matSearch.trim() && { opacity: 0.4 }]}
                          onPress={handleAddMaterial}
                          disabled={!matSearch.trim()}
                        >
                          <Text style={s.searchAddText}>Add</Text>
                        </TouchableOpacity>
                      </View>
                      {matSearch.trim() && !matSelected && matResults.length > 0 && (
                        <View style={s.inlineDropdown}>
                          {matResults.map((m) => (
                            <TouchableOpacity
                              key={m.id}
                              style={s.inlineDropdownRow}
                              onPress={() => { setMatSelected(m); setMatSearch(m.name); setMatResults([]); }}
                            >
                              <Text style={{ color: "#fff", fontSize: 14 }}>{m.name}</Text>
                              {m.type ? <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{SYMBOL_ICONS[m.type] ?? ""} {m.type}</Text> : null}
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>

                    {/* Materials table */}
                    <View style={s.tableHeader}>
                      <Text style={[s.tableHeaderText, { width: 56 }]}>Symbol</Text>
                      <Text style={[s.tableHeaderText, { flex: 1 }]}>Material</Text>
                      <TouchableOpacity onPress={() => setAmountUnit((u) => (u === "g" ? "mL" : "g"))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={[s.tableHeaderText, { textAlign: "right", textDecorationLine: "underline" }]}>Amount ({amountUnit})</Text>
                      </TouchableOpacity>
                      <View style={{ width: 26 }} />
                    </View>
                    {snapshot.lines.length === 0 ? (
                      <View style={{ paddingVertical: 24, alignItems: "center" }}>
                        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>No materials yet. Search above to add.</Text>
                      </View>
                    ) : (
                      sortedLines.map(({ line, idx }) => {
                        const pct = totalG > 0 ? ((line.amount_g / totalG) * 100).toFixed(1) : "0.0";
                        return (
                          <EditableLine
                            key={idx}
                            line={line}
                            pct={pct}
                            unit={amountUnit}
                            onUpdate={(g) => updateLineAmount(idx, g)}
                            onDelete={() => deleteLine(idx)}
                          />
                        );
                      })
                    )}
                    {/* Total row */}
                    <View style={s.tableTotalRow}>
                      <Text style={[s.tableTotalLabel, { flex: 1 }]}>Total Materials Concentrate</Text>
                      <Text style={s.tableTotalVal}>{amountUnit === "g" ? `${totalG.toFixed(3)}g` : `${(snapshot?.lines ?? []).reduce((sum, l) => sum + l.amount_g / (l.density_g_per_ml || 1), 0).toFixed(3)}mL`}</Text>
                      <Text style={s.tableTotalPct}>  |  {snapshot.lines.length > 0 ? "100%" : "0%"}</Text>
                    </View>

                    <TouchableOpacity style={{ alignSelf: "flex-end", marginTop: 12 }} onPress={() => setFormulaOpen(false)}>
                      <Text style={s.sectionShow}>Hide</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* ── Summary ── */}
            {snapshot && (
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

                  {/* Breakdown by symbol + target warning */}
                  {snapshot.lines.length > 0 && (
                    <>
                      <View style={s.breakdownRow}>
                        {topG > 0 && <View style={[s.bdPill, { backgroundColor: "#9BE24F" }]}><Text style={s.bdPillDark}>▲ {pctOf(topG)}%</Text></View>}
                        {midG > 0 && <View style={[s.bdPill, { backgroundColor: "#F06CA6" }]}><Text style={s.bdPillDark}>● {pctOf(midG)}%</Text></View>}
                        {baseG > 0 && <View style={[s.bdPill, { backgroundColor: "#4C7DF0" }]}><Text style={s.bdPillLight}>■ {pctOf(baseG)}%</Text></View>}
                      </View>
                      <View style={[s.breakdownRow, { marginTop: 10 }]}>
                        {atTarget ? (
                          <View style={[s.bdPill, { backgroundColor: "#D9F24E" }]}><Text style={s.bdPillDark}>On Target</Text></View>
                        ) : (
                          <View style={[s.bdPill, { backgroundColor: "#E53935" }]}>
                            <Text style={s.bdPillLight}>⚠ {overTarget ? "↓" : "↑"} {targetDiffLabel}g {overTarget ? "Over Target" : "To Target"}</Text>
                          </View>
                        )}
                      </View>
                    </>
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
            )}
          </ScrollView>
        )}

        {!loading && version && (
          <View style={s.bottomBar}>
            <TouchableOpacity style={s.moreBtn} onPress={() => setMoreVisible(true)}>
              <Text style={s.moreBtnText}>More</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#13131a" size="small" />
                : <Text style={s.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* More sheet */}
        <Modal visible={moreVisible} transparent animationType="slide" onRequestClose={() => setMoreVisible(false)}>
          <View style={s.moreBackdrop}>
            <TouchableOpacity style={StyleSheet.absoluteFill as any} onPress={() => setMoreVisible(false)} />
            <View style={s.moreSheet}>
              <View style={s.moreHandle} />
              <TouchableOpacity style={s.sheetBtn} onPress={() => { setMoreVisible(false); router.back(); }}>
                <Text style={s.sheetBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.sheetBtn, s.sheetBtnDanger]} onPress={handleDelete}>
                <Text style={[s.sheetBtnText, { color: "#e53535" }]}>Delete Version</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <AddMoodItemModal
          visible={addMoodVisible}
          formulaId={version?.formula_id ?? 0}
          onClose={() => setAddMoodVisible(false)}
          onAdded={async () => {
            setAddMoodVisible(false);
            if (version) setMoodItems(await fetchMood(version.formula_id));
          }}
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

        {/* Diluent picker */}
        <Modal visible={diluentPickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDiluentPickerVisible(false)}>
          <SafeAreaView style={s.pickerModal}>
            <View style={s.pickerHeader}>
              <Text style={s.pickerTitle}>Select Diluent</Text>
              <TouchableOpacity onPress={() => setDiluentPickerVisible(false)}>
                <Text style={s.pickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {DILUENTS.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={s.pickerRow}
                  onPress={() => { setSnapshot((p) => p ? { ...p, diluent: d } : p); setDiluentPickerVisible(false); }}
                >
                  <Text style={s.pickerRowText}>{d}</Text>
                  {snapshot?.diluent === d && <Text style={{ color: ACCENT, fontSize: 18 }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>
        <ConfirmModal config={confirm} onClose={() => setConfirm(null)} />
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30, paddingTop: 6, paddingBottom: 2 },
  profileBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  profileIcon: { fontSize: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 30, paddingTop: 24, paddingBottom: 16 },
  backCarrot: { color: "#fff", fontSize: 30, fontWeight: "300", lineHeight: 30, marginTop: -4 },
  pageTitle: { fontSize: 23, fontWeight: "700", color: "#fff", letterSpacing: -0.3 },

  // ── Version card ──
  notesCard: { marginHorizontal: 30, marginBottom: 16, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.6)", borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16 },
  notesCardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  cardName: { fontSize: 16, fontWeight: "700", color: "#fff", flex: 1, marginRight: 8 },
  cardDate: { fontSize: 12, color: "rgba(255,255,255,0.5)" },
  cardNotes: { fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 19, marginTop: 8 },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },
  versionBadge: { borderWidth: 1, borderColor: "#edff8d", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 5 },
  versionBadgeText: { fontSize: 12, fontWeight: "700", color: "#edff8d" },
  versionBadgeInput: { fontSize: 12, fontWeight: "700", color: "#edff8d", minWidth: 80, padding: 0, margin: 0 },
  savedOn: { fontSize: 11, color: "rgba(255,255,255,0.5)" },

  // ── Accordion section ──
  section: { marginHorizontal: 30, marginBottom: 12, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.6)", borderRadius: 14, overflow: "hidden" },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 18 },
  sectionHeadTitle: { color: "#fff", fontWeight: "600", fontSize: 16 },
  sectionShow: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "500" },
  sectionBody: { paddingHorizontal: 18, paddingBottom: 20, paddingTop: 2 },
  statVal: { color: "#fff", fontWeight: "700", fontSize: 17, marginBottom: 4, textAlign: "center" },
  statLabel: { color: "rgba(255,255,255,0.45)", fontSize: 11, textAlign: "center" },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.15)", marginVertical: 4 },
  breakdownRow: { flexDirection: "row", gap: 10, marginTop: 20, justifyContent: "center" },
  bdPill: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6 },
  bdPillDark: { color: "#13131a", fontSize: 13, fontWeight: "700" },
  bdPillLight: { color: "#fff", fontSize: 13, fontWeight: "700" },
  normalizeBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  normalizeBtnText: { color: "rgba(255,255,255,0.75)", fontWeight: "600", fontSize: 12 },

  // Mood board
  addPill: { borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6 },
  addPillText: { color: "#fff", fontSize: 13, fontWeight: "500" },
  moodImgCard: { width: "31.5%", aspectRatio: 0.82, borderRadius: 10, overflow: "hidden", position: "relative", backgroundColor: "rgba(255,255,255,0.06)" },
  imgDelBtn: { position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  imgDelText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // Parameters
  paramRow: { flexDirection: "row", gap: 12, alignItems: "flex-end" },
  paramColSm: { width: 74 },
  paramColLg: { flex: 1 },
  paramLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, marginBottom: 8 },
  paramInput: { backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9, color: "#fff", fontSize: 14, textAlign: "center" },
  diluentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  diluentText: { color: "#fff", fontSize: 13, flex: 1, marginRight: 6 },
  diluentChevron: { color: "rgba(255,255,255,0.6)", fontSize: 16, marginTop: -4 },
  paramDivider: { height: 0.5, backgroundColor: "rgba(255,255,255,0.25)", marginTop: 22, marginBottom: 14 },
  paramCalc: { color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 18 },

  // Formula
  searchPillWrap: { flexDirection: "row", alignItems: "center", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.6)", borderRadius: 24, paddingLeft: 16, paddingRight: 5, paddingVertical: 5, backgroundColor: "rgba(255,255,255,0.04)" },
  searchPillInput: { flex: 1, fontSize: 14, color: "#fff", paddingVertical: 7, marginRight: 8 },
  searchAddBtn: { backgroundColor: "#fff", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 7 },
  searchAddText: { color: "#13131a", fontSize: 12, fontWeight: "600" },
  inlineDropdown: { backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 12, marginTop: 6, overflow: "hidden" },
  inlineDropdownRow: { paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tableHeader: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.15)" },
  tableHeaderText: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  lineRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  lineSymbol: { width: 56, color: "rgba(255,255,255,0.85)", fontSize: 13, paddingLeft: 2 },
  lineName: { flex: 1, fontSize: 14, fontWeight: "500", color: "#fff", marginRight: 6 },
  lineAmt: { fontSize: 14, color: "#fff" },
  linePct: { color: ACCENT, fontSize: 12, marginTop: 2, textAlign: "right" },
  lineInput: { backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(236,0,140,0.6)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, color: "#fff", textAlign: "right", width: 80 },
  tableTotalRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)", marginTop: 2 },
  tableTotalLabel: { color: "#fff", fontWeight: "700", fontSize: 13 },
  tableTotalVal: { color: "#fff", fontWeight: "700", fontSize: 14 },
  tableTotalPct: { color: ACCENT, fontWeight: "700", fontSize: 14 },

  // Bottom bar
  bottomBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 40, paddingVertical: 16 },
  moreBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 26, paddingHorizontal: 34, paddingVertical: 14 },
  moreBtnText: { color: "#fff", fontSize: 15, fontWeight: "500" },
  saveBtn: { backgroundColor: "#D9F24E", borderRadius: 26, paddingHorizontal: 40, paddingVertical: 14 },
  saveBtnText: { color: "#13131a", fontSize: 15, fontWeight: "700" },

  // More sheet
  moreBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  moreSheet: { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 44, gap: 10 },
  moreHandle: { width: 40, height: 4, backgroundColor: "rgba(0,0,0,0.15)", borderRadius: 2, alignSelf: "center" as const, marginBottom: 12 },
  sheetBtn: { borderWidth: 1, borderColor: "rgba(0,0,0,0.12)", borderRadius: 100, paddingVertical: 16, alignItems: "center" as const },
  sheetBtnDanger: { borderColor: "rgba(220,50,50,0.2)" },
  sheetBtnText: { color: "#13131a", fontSize: 15, fontWeight: "500" as const },

  // Lightbox
  lightboxBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  lightboxImg: { width: "92%", height: "80%" },
  lightboxClose: { position: "absolute", top: 60, right: 24, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  lightboxCloseText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  // Diluent picker
  pickerModal: { flex: 1, backgroundColor: "#0e1828" },
  pickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  pickerTitle: { fontSize: 17, fontWeight: "700", color: "#fff" },
  pickerDone: { fontSize: 16, fontWeight: "600", color: "#fff" },
  pickerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  pickerRowText: { fontSize: 16, color: "#fff" },
});

// Mood add pop-up styles
const mb = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", paddingHorizontal: 24 },
  sheet: { backgroundColor: "#0c0c0c", borderRadius: 16, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.6)", padding: 18, width: "100%" },
  captureBox: { width: "100%", aspectRatio: 0.8, borderRadius: 14, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  captureText: { color: "#13131a", fontSize: 15, fontWeight: "600", textAlign: "center" },
  captureHint: { color: "rgba(19,19,26,0.45)", fontSize: 12, textAlign: "center", marginTop: 4 },
  captureOr: { color: "rgba(19,19,26,0.45)", fontSize: 13, marginVertical: 10 },
  actions: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  cancelBtn: { flex: 1, marginRight: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", borderRadius: 24, paddingVertical: 13, alignItems: "center" },
  cancelBtnText: { color: "#fff", fontSize: 15, fontWeight: "500" },
  addBtn: { flex: 1, marginLeft: 8, backgroundColor: "#EC008C", borderRadius: 24, paddingVertical: 13, alignItems: "center" },
  addBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
