import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, FlatList, Modal, StyleSheet, Share, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { BlurView } from "expo-blur";
import { supabase } from "@/lib/supabase";
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

function EditHeaderModal({ visible, formula, onClose, onSaved }: {
  visible: boolean; formula: Formula; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(formula.name);
  const [description, setDescription] = useState(formula.description ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) { setName(formula.name); setDescription(formula.description ?? ""); }
  }, [visible, formula]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from("formulas").update({ name: name.trim(), description: description.trim() || null }).eq("id", formula.id);
    setSaving(false);
    onSaved();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.modal}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={s.modalClose}>Cancel</Text></TouchableOpacity>
          <Text style={s.modalTitle}>Edit Formula</Text>
          <TouchableOpacity onPress={handleSave} disabled={!name.trim() || saving}>
            <Text style={[s.back, (!name.trim() || saving) && { opacity: 0.4 }]}>Save</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }} keyboardShouldPersistTaps="handled">
          <Text style={s.fieldLabel}>Name *</Text>
          <TextInput style={s.input} placeholder="Formula name" placeholderTextColor="rgba(255,255,255,0.35)" value={name} onChangeText={setName} />
          <Text style={s.fieldLabel}>Notes</Text>
          <TextInput
            style={[s.input, { height: 140, textAlignVertical: "top" }]}
            placeholder="Lab notes, observations, inspiration..."
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={description} onChangeText={setDescription} multiline
          />
          <TouchableOpacity style={[s.saveBtn, (!name.trim() || saving) && { opacity: 0.5 }]} onPress={handleSave} disabled={saving || !name.trim()}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save Changes</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

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
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={s.lineName} numberOfLines={1}>
          {line.material?.name ?? `Material #${line.material_id}`}
        </Text>
        {line.material?.type ? (
          <Text style={s.lineType}>{SYMBOL_ICONS[line.material.type] ?? ""} {line.material.type}</Text>
        ) : null}
      </View>
      <View style={{ alignItems: "flex-end", marginRight: 4 }}>
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

function AddMoodItemModal({ visible, formulaId, onClose, onAdded }: {
  visible: boolean; formulaId: number; onClose: () => void; onAdded: () => void;
}) {
  const [tab, setTab] = useState<"note" | "image">("note");
  const [noteText, setNoteText] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) { setTab("note"); setNoteText(""); setImageUri(null); setImageCaption(""); }
  }, [visible]);

  const pickImage = async (source: "camera" | "library") => {
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ quality: 0.75 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75 });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  };

  const handleImageTap = () => Alert.alert("Add Image", "Choose source", [
    { text: "Take Photo", onPress: () => pickImage("camera") },
    { text: "Choose from Library", onPress: () => pickImage("library") },
    { text: "Cancel", style: "cancel" },
  ]);

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
      } else {
        const fileName = `formula_${formulaId}/${Date.now()}-photo.jpg`;
        const response = await fetch(imageUri!);
        const blob = await response.blob();
        const { error: uploadError } = await supabase.storage.from(MOOD_BUCKET).upload(fileName, blob, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;
        const { error: insertError } = await supabase.from("formula_moodboard_assets").insert({
          formula_id: formulaId, file_url: fileName, media_type: "image", caption: imageCaption.trim() || null,
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

  const canSave = tab === "note" ? noteText.trim().length > 0 : imageUri !== null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.modal}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={s.modalClose}>Cancel</Text></TouchableOpacity>
          <Text style={s.modalTitle}>Add to Mood Board</Text>
          <TouchableOpacity onPress={handleSave} disabled={!canSave || saving}>
            <Text style={[s.back, (!canSave || saving) && { opacity: 0.4 }]}>Save</Text>
          </TouchableOpacity>
        </View>
        <View style={s.tabRow}>
          {(["note", "image"] as const).map((t) => (
            <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t === "note" ? "✍  Note" : "🖼  Image"}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView style={{ flex: 1, paddingHorizontal: 24 }} keyboardShouldPersistTaps="handled">
          {tab === "note" ? (
            <TextInput
              style={[s.input, { height: 160, textAlignVertical: "top" }]}
              placeholder="Thoughts, inspiration, observations..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={noteText} onChangeText={setNoteText} multiline autoFocus
            />
          ) : (
            <>
              <TouchableOpacity onPress={handleImageTap} activeOpacity={0.8}>
                {imageUri
                  ? <Image source={{ uri: imageUri }} style={{ width: "100%", height: 220, borderRadius: 16, marginBottom: 4 }} resizeMode="cover" />
                  : <View style={s.imagePickerEmpty}><Text style={{ fontSize: 36, marginBottom: 8 }}>📷</Text><Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Tap to add image</Text></View>
                }
              </TouchableOpacity>
              <Text style={[s.fieldLabel, { marginTop: 16 }]}>Caption (optional)</Text>
              <TextInput style={s.input} placeholder="Add a caption..." placeholderTextColor="rgba(255,255,255,0.35)" value={imageCaption} onChangeText={setImageCaption} />
            </>
          )}
          {saving && <View style={{ alignItems: "center", paddingVertical: 16 }}><ActivityIndicator color="#a78bfa" /></View>}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Formula Detail ───────────────────────────────────────────────────────────

export default function FormulaDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const formulaId = parseInt(id ?? "0");

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

  // Modal visibility
  const [editHeaderVisible, setEditHeaderVisible] = useState(false);
  const [addMoodVisible, setAddMoodVisible] = useState(false);

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
      const { data } = await supabase.from("materials").select("id,name,type,cas_number").ilike("name", `%${inlineSearch}%`).limit(15);
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
    if (!inlineSelected) return;
    setInlineAdding(true);
    await supabase.from("formula_lines").insert([{
      formula_id: formulaId, material_id: inlineSelected.id, amount_g: parseFloat(inlineAmount) || 0,
    }]);
    setInlineSearch(""); setInlineSelected(null); setInlineAmount("0.000"); setInlineResults([]);
    setInlineAdding(false);
    fetchData();
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
        <View style={{ flexDirection: "row", gap: 16 }}>
          <TouchableOpacity onPress={handleShare}><Text style={s.back}>Share</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setEditHeaderVisible(true)}><Text style={s.back}>Edit</Text></TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteFormula}><Text style={s.deleteBtn}>Delete</Text></TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <Text style={s.formulaName}>{formula.name}</Text>
          <Text style={s.formulaDate}>
            {new Date(formula.date_created).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </Text>
        </View>

        {/* ① Mood Board */}
        <View style={[s.panel, { marginHorizontal: 16, marginBottom: 16 }]}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Mood Board</Text>
            <TouchableOpacity style={s.addBtn} onPress={() => setAddMoodVisible(true)}>
              <Text style={s.addBtnText}>+ Add Item</Text>
            </TouchableOpacity>
          </View>
          {moodItems.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 24 }}>
              <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, textAlign: "center" }}>
                No mood board items yet.{"\n"}Add images or notes for inspiration.
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
              {moodItems.map((item) => {
                if (item.media_type === "note") {
                  return (
                    <View key={item.id} style={s.noteCard}>
                      <Text style={s.noteText}>{item.caption}</Text>
                      <TouchableOpacity style={s.noteDeleteBtn} onPress={() => handleDeleteMoodItem(item.id)}>
                        <Text style={{ color: "#f87171", fontSize: 16 }}>×</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }
                if (item.media_type === "image" && item.display_url) {
                  return (
                    <View key={item.id} style={s.imageCard}>
                      <Image source={{ uri: item.display_url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      {item.caption ? (
                        <View style={s.imageCaptionBar}>
                          <Text style={s.imageCaptionText} numberOfLines={2}>{item.caption}</Text>
                        </View>
                      ) : null}
                      <TouchableOpacity style={s.imageDeleteBtn} onPress={() => handleDeleteMoodItem(item.id)}>
                        <BlurView intensity={40} tint="dark" style={s.imageDeleteBlur}>
                          <Text style={{ color: "#f87171", fontSize: 14, fontWeight: "700" }}>×</Text>
                        </BlurView>
                      </TouchableOpacity>
                    </View>
                  );
                }
                return null;
              })}
            </View>
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
            <Text style={{ color: "#fff", fontSize: 14 }}>{diluent}</Text>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 15 }}>▾</Text>
          </TouchableOpacity>
          <Text style={s.paramCalc}>
            Current concentrate: {totalG.toFixed(3)}g · Target concentrate: {targetConcentrateG.toFixed(3)}g · Diluent to add: {diluentNeededMl} mL
          </Text>
          {lines.length > 0 && totalG > 0 && !atTarget ? (
            <TouchableOpacity style={s.normalizeBtn} onPress={normalizeToTarget}>
              <Text style={s.normalizeBtnText}>Normalize to Target</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ③ Type to search bar (inline add) */}
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <TextInput
              style={[s.searchBarInline, { flex: 1 }]}
              placeholder="Type to search materials..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={inlineSearch}
              onChangeText={(v) => { setInlineSearch(v); setInlineSelected(null); }}
            />
            <TextInput
              style={s.amountInline}
              placeholder="0.000"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={inlineAmount}
              onChangeText={setInlineAmount}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              style={[s.addBtn, (!inlineSelected || inlineAdding) && { opacity: 0.45 }]}
              onPress={handleInlineAdd}
              disabled={!inlineSelected || inlineAdding}
            >
              {inlineAdding
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.addBtnText}>Add</Text>
              }
            </TouchableOpacity>
          </View>
          {/* Search dropdown */}
          {inlineResults.length > 0 && !inlineSelected ? (
            <View style={s.inlineDropdown}>
              {inlineResults.slice(0, 8).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={s.inlineDropdownRow}
                  onPress={() => { setInlineSelected(item); setInlineSearch(item.name); setInlineResults([]); }}
                >
                  <Text style={{ color: "#fff", fontSize: 14 }}>{item.name}</Text>
                  {item.type ? <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{SYMBOL_ICONS[item.type] ?? ""} {item.type}</Text> : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {inlineSelected ? (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, paddingHorizontal: 2 }}>
              <Text style={{ color: "#a78bfa", fontSize: 13 }}>✓ {inlineSelected.name}</Text>
              <TouchableOpacity onPress={() => { setInlineSelected(null); setInlineSearch(""); }} style={{ marginLeft: 10 }}>
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Clear</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* ④ Materials Table */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <GlassRow style={{ paddingHorizontal: 16 }}>
            {/* Table header */}
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderText, { flex: 1 }]}>Material</Text>
              <Text style={[s.tableHeaderText, { width: 68, textAlign: "right" }]}>Amount (g)</Text>
              <Text style={[s.tableHeaderText, { width: 44, textAlign: "right" }]}>%</Text>
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

      <EditHeaderModal
        visible={editHeaderVisible} formula={formula}
        onClose={() => setEditHeaderVisible(false)}
        onSaved={() => { setEditHeaderVisible(false); fetchData(); }}
      />
      <AddMoodItemModal
        visible={addMoodVisible} formulaId={formulaId}
        onClose={() => setAddMoodVisible(false)}
        onAdded={() => { setAddMoodVisible(false); fetchMoodItems(); }}
      />
    </GradientScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  navBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  back: { color: "#a78bfa", fontSize: 16 },
  deleteBtn: { color: "#f87171", fontSize: 16 },

  formulaName: { color: "#fff", fontSize: 26, fontWeight: "700", marginBottom: 4 },
  formulaDate: { color: "rgba(255,255,255,0.35)", fontSize: 13 },

  panel: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.13)", borderRadius: 16, padding: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: "#fff", fontWeight: "600", fontSize: 16 },

  addBtn: { backgroundColor: "#a78bfa", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  // Mood Board
  noteCard: { width: "100%", backgroundColor: "rgba(167,139,250,0.12)", borderWidth: 1, borderColor: "rgba(167,139,250,0.25)", borderRadius: 12, padding: 14, position: "relative" },
  noteText: { color: "#fff", fontSize: 14, lineHeight: 20, paddingRight: 24 },
  noteDeleteBtn: { position: "absolute", top: 10, right: 12 },
  imageCard: { width: "47%", aspectRatio: 4 / 3, borderRadius: 12, overflow: "hidden", position: "relative" },
  imageCaptionBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 8, paddingVertical: 6 },
  imageCaptionText: { color: "#fff", fontSize: 11, lineHeight: 14 },
  imageDeleteBtn: { position: "absolute", top: 6, right: 6 },
  imageDeleteBlur: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", overflow: "hidden" },

  // Formula Parameters
  paramLabel: { color: "rgba(255,255,255,0.45)", fontSize: 12, marginBottom: 6 },
  paramInput: { backgroundColor: "rgba(255,255,255,0.09)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: "#fff", fontSize: 15 },
  diluentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,0.09)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  paramCalc: { color: "rgba(255,255,255,0.38)", fontSize: 12, lineHeight: 18 },
  normalizeBtn: { marginTop: 12, backgroundColor: "rgba(167,139,250,0.12)", borderWidth: 1, borderColor: "rgba(167,139,250,0.35)", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  normalizeBtnText: { color: "#a78bfa", fontWeight: "600", fontSize: 14 },

  // Inline search
  searchBarInline: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11, color: "#fff", fontSize: 14 },
  amountInline: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 11, color: "#fff", fontSize: 14, width: 72, textAlign: "center" },
  inlineDropdown: { backgroundColor: "rgba(20,20,35,0.97)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 12, marginTop: 6, overflow: "hidden" },
  inlineDropdownRow: { paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  // Materials table
  tableHeader: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.12)" },
  tableHeaderText: { color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  lineRow: { flexDirection: "row", alignItems: "center", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  lineName: { color: "#fff", fontWeight: "500", fontSize: 14 },
  lineType: { color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 },
  lineAmount: { color: "#fff", fontSize: 14 },
  linePct: { color: "#a78bfa", fontSize: 12, marginTop: 2 },
  lineInput: { backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(167,139,250,0.6)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, color: "#fff", textAlign: "right", width: 80 },
  tableTotalRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)", marginTop: 2 },
  tableTotalLabel: { color: "#fff", fontWeight: "700", fontSize: 14 },
  tableTotalVal: { color: "#fff", fontWeight: "700", fontSize: 14 },
  tableUnderBy: { color: "rgba(255,165,0,0.85)", fontSize: 11 },

  // Formula Summary
  statVal: { color: "#fff", fontWeight: "700", fontSize: 17, marginBottom: 4, textAlign: "center" },
  statLabel: { color: "rgba(255,255,255,0.4)", fontSize: 11, textAlign: "center" },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.12)", marginVertical: 4 },

  // Notes collapsible
  notesHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.13)", borderRadius: 12 },
  notesBody: { backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.13)", borderTopWidth: 0, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, padding: 16 },
  notesText: { color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 21 },

  // Add Mood Modal
  tabRow: { flexDirection: "row", marginHorizontal: 24, marginTop: 16, marginBottom: 16, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 9 },
  tabActive: { backgroundColor: "#a78bfa" },
  tabText: { color: "rgba(255,255,255,0.5)", fontWeight: "600", fontSize: 14 },
  tabTextActive: { color: "#fff" },
  imagePickerEmpty: { height: 180, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },

  // Shared modal
  modal: { flex: 1, backgroundColor: "#0e1828" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  modalClose: { color: "rgba(255,255,255,0.5)", fontSize: 16 },
  fieldLabel: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: "#fff", fontSize: 15, marginBottom: 14 },
  saveBtn: { backgroundColor: "#a78bfa", borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
