import { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Modal, StyleSheet, Alert, Image,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { SpilsLogo } from "@/components/SpilsLogo";

const ACCENT = "#EC008C";

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

function formulaStatus(lineCount: number) {
  if (lineCount === 0) return "Draft";
  if (lineCount < 10) return "In Progress";
  return "Final";
}

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

type Material = { id: number; name: string; type: string | null; };
type PendingLine = { tempId: string; material: Material | null; name: string; amount: string; };

type PendingMoodItem =
  | { id: string; type: "note"; text: string }
  | { id: string; type: "image"; uri: string; mimeType: string }
  | { id: string; type: "audio"; uri: string; name: string };

type MoodTab = "image" | "note" | "audio";
const MOOD_TABS: { key: MoodTab; label: string }[] = [
  { key: "image", label: "Image / Video" },
  { key: "note", label: "Note" },
  { key: "audio", label: "Audio" },
];

function LocalAddMoodModal({ visible, onClose, onAdd }: {
  visible: boolean; onClose: () => void; onAdd: (item: PendingMoodItem) => void;
}) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState("image/jpeg");

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

  const handleAdd = () => {
    if (!imageUri) return;
    onAdd({ id: `${Date.now()}-${Math.random()}`, type: "image", uri: imageUri, mimeType: imageMimeType });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.moodBackdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill as any} activeOpacity={1} onPress={onClose} />
        <View style={s.moodSheet}>
          <TouchableOpacity style={s.captureBox} onPress={handleImageTap} activeOpacity={0.9}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={{ width: "100%", height: "100%", borderRadius: 14 }} resizeMode="cover" />
            ) : (
              <View style={{ alignItems: "center", paddingHorizontal: 20 }}>
                <Text style={s.captureText}>Tap to Capture</Text>
                <Text style={s.captureHint}>(Best if shot on clean background)</Text>
                <Text style={s.captureOr}>or</Text>
                <Text style={s.captureText}>Upload an Image</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={s.moodActions}>
            <TouchableOpacity style={s.moodCancelBtn} onPress={onClose}>
              <Text style={s.moodCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.moodAddBtn, !imageUri && { opacity: 0.4 }]} onPress={handleAdd} disabled={!imageUri}>
              <Text style={s.moodAddText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PendingLineRow({ line, totalG, onDelete, onUpdateAmount }: {
  line: PendingLine;
  totalG: number;
  onDelete: () => void;
  onUpdateAmount: (amount: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(line.amount);
  const amt = parseFloat(line.amount) || 0;
  const pct = totalG > 0 ? ((amt / totalG) * 100).toFixed(1) : "0.0";
  const symbol = line.material?.type ? (SYMBOL_ICONS[line.material.type] ?? "") : "";

  const commit = () => {
    const n = parseFloat(val);
    const final = Number.isFinite(n) && n >= 0 ? n.toFixed(3) : line.amount;
    setVal(final);
    onUpdateAmount(final);
    setEditing(false);
  };

  return (
    <View style={s.tableRow}>
      <Text style={s.lineSymbol}>{symbol}</Text>
      <View style={{ flex: 1, marginRight: 6 }}>
        <Text style={s.tableRowName} numberOfLines={1}>{line.name}</Text>
        {!line.material && (
          <Text style={{ color: ACCENT, fontSize: 10 }}>New → Organ</Text>
        )}
      </View>
      <View style={{ alignItems: "flex-end", marginRight: 2 }}>
        {editing ? (
          <TextInput
            style={s.lineAmountInput}
            value={val}
            onChangeText={setVal}
            keyboardType="decimal-pad"
            onBlur={commit}
            onSubmitEditing={commit}
            autoFocus
            selectTextOnFocus
          />
        ) : (
          <TouchableOpacity onPress={() => { setVal(line.amount); setEditing(true); }}>
            <Text style={s.tableRowAmount}>{amt.toFixed(3)}g</Text>
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

export default function NewFormula() {
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bottleSizeMl, setBottleSizeMl] = useState(15);
  const [concPercent, setConcPercent] = useState(20);
  const [diluent, setDiluent] = useState("Ethanol (EtOH)");
  const [diluentPickerVisible, setDiluentPickerVisible] = useState(false);
  const [concFocused, setConcFocused] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingMoodItems, setPendingMoodItems] = useState<PendingMoodItem[]>([]);
  const [addMoodVisible, setAddMoodVisible] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [statusVal, setStatusVal] = useState<string | null>(null);

  // Material inline add
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Material[]>([]);
  const [selected, setSelected] = useState<Material | null>(null);
  const [amount, setAmount] = useState("0.000");
  const [lines, setLines] = useState<PendingLine[]>([]);

  const totalG = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const targetConcentrateG = (bottleSizeMl * concPercent) / 100;
  const diluentMl = Math.max(0, bottleSizeMl - totalG).toFixed(1);
  const atTarget = Math.abs(totalG - targetConcentrateG) < 0.001;

  // Debounced search — user's Organ only
  useEffect(() => {
    if (!search.trim() || selected) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("materials")
        .select("id,name,type")
        .eq("user_id", user?.id)
        .ilike("name", `%${search}%`)
        .limit(10);
      setSearchResults((data as Material[]) ?? []);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, selected, user?.id]);

  const handleAddLine = () => {
    const matName = selected?.name ?? search.trim();
    if (!matName) return;
    setLines((prev) => [
      ...prev,
      { tempId: `${Date.now()}-${Math.random()}`, material: selected, name: matName, amount },
    ]);
    setSearch(""); setSelected(null); setAmount("0.000"); setSearchResults([]);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      // Store params in notes field (matches how [id].tsx reads them)
      const notesStr = `Bottle: ${bottleSizeMl}mL, Concentration: ${concPercent}%, Diluent: ${diluent}`;
      const { data: formula, error: fErr } = await supabase
        .from("formulas")
        .insert([{
          name: name.trim(),
          description: description.trim() || null,
          user_id: user?.id,
          notes: notesStr,
          status: statusVal,
        }])
        .select()
        .single();
      if (fErr || !formula) throw fErr ?? new Error("Failed to create formula");

      for (const line of lines) {
        let materialId = line.material?.id ?? null;
        if (!materialId) {
          // New material — auto-add to Organ
          const { data: mat, error: matErr } = await supabase
            .from("materials")
            .insert([{ name: line.name, user_id: user?.id }])
            .select("id")
            .single();
          if (matErr || !mat) continue;
          materialId = mat.id;
        }
        await supabase.from("formula_lines").insert([{
          formula_id: formula.id,
          material_id: materialId,
          amount_g: parseFloat(line.amount) || 0,
        }]);
      }

      // Upload pending moodboard items
      for (const item of pendingMoodItems) {
        try {
          if (item.type === "note") {
            await supabase.from("formula_moodboard_assets").insert({
              formula_id: formula.id, file_url: "EMPTY", media_type: "note", caption: item.text,
            });
          } else if (item.type === "image") {
            const isVideo = item.mimeType.startsWith("video/");
            const ext = item.mimeType.split("/")[1] || (isVideo ? "mp4" : "jpg");
            const fileName = `formula_${formula.id}/${Date.now()}-${isVideo ? "video" : "photo"}.${ext}`;
            const base64 = await FileSystem.readAsStringAsync(item.uri, { encoding: "base64" });
            await supabase.storage.from("moodboard").upload(fileName, decode(base64), { contentType: item.mimeType });
            await supabase.from("formula_moodboard_assets").insert({
              formula_id: formula.id, file_url: fileName, media_type: isVideo ? "video" : "image", caption: null,
            });
          } else if (item.type === "audio") {
            const ext = item.name.split(".").pop() ?? "mp3";
            const fileName = `formula_${formula.id}/${Date.now()}-audio.${ext}`;
            const base64 = await FileSystem.readAsStringAsync(item.uri, { encoding: "base64" });
            await supabase.storage.from("moodboard").upload(fileName, decode(base64), { contentType: `audio/${ext}` });
            await supabase.from("formula_moodboard_assets").insert({
              formula_id: formula.id, file_url: fileName, media_type: "audio", caption: item.name,
            });
          }
        } catch {}
      }

      router.replace("/(tabs)/formulas" as any);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to create formula");
    } finally {
      setSaving(false);
    }
  };

  const showDropdown = search.trim().length > 0 && !selected;
  const exactMatch = searchResults.some((r) => r.name.toLowerCase() === search.toLowerCase());
  const canAdd = !!(selected || search.trim());
  const moodImages = pendingMoodItems.filter((i) => i.type === "image");
  const sortedLines = [...lines].sort((a, b) => symbolRank(a.material?.type) - symbolRank(b.material?.type));
  const catG = (t: string) => lines.filter((l) => l.material?.type === t).reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
  const topG = catG("Top"), midG = catG("Mid"), baseG = catG("Base");
  const pctOf = (g: number) => (totalG > 0 ? Math.round((g / totalG) * 100) : 0);

  return (
    <DarkScreen>
      {/* Nav */}
      <View style={s.topNav}>
        <SpilsLogo height={22} color="#edff8d" />
        <TouchableOpacity style={s.profileBtn} onPress={() => router.push("/(tabs)/profile" as any)}>
          <Text style={s.profileIcon}>👤</Text>
        </TouchableOpacity>
      </View>

      {/* Back carrot + section header */}
      <View style={s.headerRow}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.backCarrot}>‹</Text>
        </TouchableOpacity>
        <Text style={s.pageTitle}>Lab</Text>
      </View>

      <KeyboardAwareScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled" enableOnAndroid extraScrollHeight={20}>

          {/* ── Main Notes card ── */}
          <View style={s.notesCard}>
            <View style={s.notesCardTop}>
              <TextInput
                style={[s.cardName, { flex: 1, marginRight: 8, padding: 0 }]}
                placeholder="Formula Name"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={name}
                onChangeText={setName}
                autoFocus
              />
              <Text style={s.cardDate}>
                {new Date().toLocaleDateString("en-US", { year: "2-digit", month: "2-digit", day: "2-digit" }).replace(/\//g, ".")}
              </Text>
            </View>
            <TextInput
              style={[s.cardNotes, { marginTop: 8, padding: 0 }]}
              placeholder="Tap to add notes..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={description}
              onChangeText={setDescription}
              multiline
            />
            <View style={s.cardBottom}>
              <View style={s.cardBottomLeft}>
                <View style={s.statusPill}>
                  <Text style={s.statusPillText}>{formulaStatus(lines.length).toUpperCase()}</Text>
                </View>
                <Text style={s.cardMeta}>{lines.length} MATERIALS</Text>
              </View>
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
                  <Text style={s.emptyHint}>No images yet.{"\n"}Tap Add to capture or upload (up to 3).</Text>
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {moodImages.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={s.moodImgCard}
                      activeOpacity={0.9}
                      onPress={() => setLightboxUrl((item as any).uri)}
                    >
                      <Image source={{ uri: (item as any).uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      <TouchableOpacity
                        style={s.imgDelBtn}
                        onPress={() => setPendingMoodItems((p) => p.filter((i) => i.id !== item.id))}
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
                    value={String(bottleSizeMl)}
                    onChangeText={(v) => setBottleSizeMl(parseFloat(v) || 0)}
                    keyboardType="decimal-pad"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                  />
                </View>
                <View style={s.paramColSm}>
                  <Text style={s.paramLabel}>Concentration (%)</Text>
                  <TextInput
                    style={s.paramInput}
                    value={concFocused ? String(concPercent) : `${concPercent}%`}
                    onChangeText={(v) => setConcPercent(parseFloat(v) || 0)}
                    onFocus={() => setConcFocused(true)}
                    onBlur={() => setConcFocused(false)}
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
                Target Concentrate: {targetConcentrateG.toFixed(3)}g  |  Diluent: {diluentMl}ml
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
                    value={search}
                    onChangeText={(v) => { setSearch(v); setSelected(null); }}
                  />
                  <TouchableOpacity
                    style={[s.searchAddBtn, !canAdd && { opacity: 0.4 }]}
                    onPress={handleAddLine}
                    disabled={!canAdd}
                  >
                    <Text style={s.searchAddText}>Add</Text>
                  </TouchableOpacity>
                </View>
                {/* Dropdown */}
                {showDropdown && (
                  <View style={s.dropdown}>
                    {searchResults.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={s.dropdownRow}
                        onPress={() => { setSelected(item); setSearch(item.name); setSearchResults([]); }}
                      >
                        <Text style={s.dropdownName}>{item.name}</Text>
                        {item.type ? (
                          <Text style={s.dropdownType}>{SYMBOL_ICONS[item.type] ?? ""} {item.type}</Text>
                        ) : null}
                      </TouchableOpacity>
                    ))}
                    {!exactMatch && (
                      <TouchableOpacity
                        style={[s.dropdownRow, { borderTopWidth: searchResults.length > 0 ? 1 : 0, borderTopColor: "rgba(255,255,255,0.1)" }]}
                        onPress={() => { setSearchResults([]); }}
                      >
                        <Text style={s.dropdownNew}>+ Add "{search}" to your Organ</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {selected && (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, paddingHorizontal: 2 }}>
                    <Text style={{ color: ACCENT, fontSize: 13 }}>✓ {selected.name} (from Organ)</Text>
                    <TouchableOpacity onPress={() => { setSelected(null); setSearch(""); }} style={{ marginLeft: 10 }}>
                      <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {!selected && search.trim() && !showDropdown && (
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, paddingHorizontal: 2 }}>
                    <Text style={{ color: ACCENT, fontSize: 13 }}>★ "{search}" will be added to your Organ</Text>
                  </View>
                )}
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
                  <Text style={s.emptyHint}>No materials yet. Search above to add.</Text>
                </View>
              ) : (
                sortedLines.map((line) => (
                  <PendingLineRow
                    key={line.tempId}
                    line={line}
                    totalG={totalG}
                    onDelete={() => setLines((p) => p.filter((l) => l.tempId !== line.tempId))}
                    onUpdateAmount={(amt) => setLines((p) => p.map((l) => l.tempId === line.tempId ? { ...l, amount: amt } : l))}
                  />
                ))
              )}
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
                  <Text style={s.statVal}>{diluentMl}ml</Text>
                  <Text style={s.statLabel}>DILUENT</Text>
                </View>
              </View>

              {lines.length > 0 && (
                <View style={s.breakdownRow}>
                  {topG > 0 && <View style={[s.bdPill, { backgroundColor: "#9BE24F" }]}><Text style={s.bdPillDark}>▲ {pctOf(topG)}%</Text></View>}
                  {midG > 0 && <View style={[s.bdPill, { backgroundColor: "#F06CA6" }]}><Text style={s.bdPillDark}>● {pctOf(midG)}%</Text></View>}
                  {baseG > 0 && <View style={[s.bdPill, { backgroundColor: "#4C7DF0" }]}><Text style={s.bdPillLight}>■ {pctOf(baseG)}%</Text></View>}
                </View>
              )}

              <TouchableOpacity style={{ alignSelf: "flex-end", marginTop: 16 }} onPress={() => setSummaryOpen(false)}>
                <Text style={s.sectionShow}>Hide</Text>
              </TouchableOpacity>
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

        <LocalAddMoodModal
          visible={addMoodVisible}
          onClose={() => setAddMoodVisible(false)}
          onAdd={(item) => setPendingMoodItems((p) => [...p, item])}
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

        {/* Diluent Picker */}
        <Modal visible={diluentPickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDiluentPickerVisible(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: "#0e1828" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" }}>
              <View style={{ width: 60 }} />
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>Select Diluent</Text>
              <TouchableOpacity onPress={() => setDiluentPickerVisible(false)}>
                <Text style={{ color: "#a78bfa", fontSize: 16, fontWeight: "600" }}>Done</Text>
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
    </DarkScreen>
  );
}

const s = StyleSheet.create({
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 30, paddingTop: 6, paddingBottom: 2 },
  back: { color: "#fff", fontSize: 16, fontWeight: "600" },
  profileBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  profileIcon: { fontSize: 16 },

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

  // ── Accordion section ──
  section: { marginHorizontal: 30, marginBottom: 12, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.6)", borderRadius: 14, overflow: "hidden" },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 18 },
  sectionHeadTitle: { color: "#fff", fontWeight: "600", fontSize: 16 },
  sectionShow: { color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: "500" },
  sectionBody: { paddingHorizontal: 18, paddingBottom: 20, paddingTop: 2 },
  sectionTitle: { color: "#fff", fontWeight: "600", fontSize: 16 },

  panel: { backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", borderRadius: 16, padding: 16 },
  addBtn: { backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: "#13131a", fontWeight: "600", fontSize: 14 },
  emptyHint: { color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center" },
  noteCard: { width: "100%", backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderRadius: 12, padding: 16, paddingBottom: 20, position: "relative", minHeight: 90, marginTop: 10 },
  noteText: { color: "#fff", fontSize: 14, lineHeight: 22, paddingRight: 24 },
  noteDeleteBtn: { position: "absolute", top: 10, right: 12 },

  // Mood Board
  addPill: { borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6 },
  addPillText: { color: "#fff", fontSize: 13, fontWeight: "500" },
  moodImgCard: { width: "31.5%", aspectRatio: 0.82, borderRadius: 10, overflow: "hidden", position: "relative", backgroundColor: "rgba(255,255,255,0.06)" },
  imgDelBtn: { position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  imgDelText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // Mood add pop-up
  moodBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", paddingHorizontal: 24 },
  moodSheet: { backgroundColor: "#0c0c0c", borderRadius: 16, borderWidth: 0.5, borderColor: "rgba(255,255,255,0.6)", padding: 18, width: "100%" },
  captureBox: { width: "100%", aspectRatio: 0.8, borderRadius: 14, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  captureText: { color: "#13131a", fontSize: 15, fontWeight: "600", textAlign: "center" },
  captureHint: { color: "rgba(19,19,26,0.45)", fontSize: 12, textAlign: "center", marginTop: 4 },
  captureOr: { color: "rgba(19,19,26,0.45)", fontSize: 13, marginVertical: 10 },
  moodActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  moodCancelBtn: { flex: 1, marginRight: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", borderRadius: 24, paddingVertical: 13, alignItems: "center" },
  moodCancelText: { color: "#fff", fontSize: 15, fontWeight: "500" },
  moodAddBtn: { flex: 1, marginLeft: 8, backgroundColor: "#EC008C", borderRadius: 24, paddingVertical: 13, alignItems: "center" },
  moodAddText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Lightbox
  lightboxBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  lightboxImg: { width: "92%", height: "80%" },
  lightboxClose: { position: "absolute", top: 60, right: 24, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  lightboxCloseText: { color: "#fff", fontSize: 16, fontWeight: "600" },

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

  searchBarInline: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11, color: "#fff", fontSize: 14 },
  amountInline: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 11, color: "#fff", fontSize: 14, width: 72, textAlign: "center" },

  dropdown: { backgroundColor: "#1a1a1a", borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", marginTop: 6, overflow: "hidden" },
  dropdownRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  dropdownName: { color: "#fff", fontSize: 14, flex: 1 },
  dropdownType: { color: "rgba(255,255,255,0.45)", fontSize: 12 },
  dropdownNew: { color: ACCENT, fontSize: 14, fontWeight: "600" },

  searchPillWrap: { flexDirection: "row", alignItems: "center", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.6)", borderRadius: 24, paddingLeft: 16, paddingRight: 5, paddingVertical: 5, backgroundColor: "rgba(255,255,255,0.04)" },
  searchPillInput: { flex: 1, fontSize: 14, color: "#fff", paddingVertical: 7, marginRight: 8 },
  searchAddBtn: { backgroundColor: "#fff", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 7 },
  searchAddText: { color: "#13131a", fontSize: 12, fontWeight: "600" },
  tableHeader: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.15)" },
  tableHeaderText: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  tableRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  lineSymbol: { width: 56, color: "rgba(255,255,255,0.85)", fontSize: 13, paddingLeft: 2 },
  tableRowName: { color: "#fff", fontSize: 14 },
  tableRowType: { color: "rgba(255,255,255,0.5)", fontSize: 13 },
  tableRowAmount: { color: "#fff", fontSize: 14, textAlign: "right" },
  linePct: { color: ACCENT, fontSize: 12, marginTop: 2, textAlign: "right" },
  lineAmountInput: { borderWidth: 1, borderColor: "rgba(236,0,140,0.6)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, fontSize: 14, color: "#fff", width: 72, textAlign: "right", backgroundColor: "rgba(255,255,255,0.1)" },
  tableTotalRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)", marginTop: 2 },
  tableTotalLabel: { color: "#fff", fontWeight: "700", fontSize: 13 },
  tableTotalVal: { color: "#fff", fontWeight: "700", fontSize: 14 },
  tableTotalPct: { color: ACCENT, fontWeight: "700", fontSize: 14 },

  statVal: { color: "#fff", fontWeight: "700", fontSize: 17, marginBottom: 4, textAlign: "center" },
  statLabel: { color: "rgba(255,255,255,0.45)", fontSize: 11, textAlign: "center" },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.15)", marginVertical: 4 },

  breakdownRow: { flexDirection: "row", gap: 10, marginTop: 20, justifyContent: "center" },
  bdPill: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 6 },
  bdPillDark: { color: "#13131a", fontSize: 13, fontWeight: "700" },
  bdPillLight: { color: "#fff", fontSize: 13, fontWeight: "700" },
  setStatusLabel: { color: "#fff", fontSize: 16, fontWeight: "600", marginBottom: 12 },
  statusChip: { borderWidth: 1, borderColor: "rgba(255,255,255,0.5)", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 9 },
  statusChipActive: { backgroundColor: "#fff", borderColor: "#fff" },
  statusChipText: { color: "#fff", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  statusChipTextActive: { color: "#13131a" },

  bottomRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 40, paddingVertical: 16 },
  cancelBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", borderRadius: 26, paddingHorizontal: 34, paddingVertical: 14 },
  cancelBtnText: { color: "#fff", fontSize: 15, fontWeight: "500" },
  saveBtn: { backgroundColor: "#D9F24E", borderRadius: 26, paddingHorizontal: 40, paddingVertical: 14 },
  saveBtnText: { color: "#13131a", fontSize: 15, fontWeight: "700" },
});
